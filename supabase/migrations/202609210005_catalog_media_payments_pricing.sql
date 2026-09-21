-- Catalog gallery, simplified product pricing and reusable payment methods.

alter table public.catalog_items
  add column if not exists notes text not null default '',
  add column if not exists pricing_mode text not null default 'material_cost',
  add column if not exists fixed_price numeric(12,2);

alter table public.catalog_items drop constraint if exists catalog_items_pricing_mode_check;
alter table public.catalog_items add constraint catalog_items_pricing_mode_check check (pricing_mode in ('material_cost', 'fixed_price'));
alter table public.catalog_items add constraint catalog_items_fixed_price_check check (fixed_price is null or fixed_price >= 0);

-- Keep the active price-table margin as the item's own margin, then retire the legacy catalogs.
update public.catalog_items ci
set pricing_markup_percentage = coalesce(pt.markup_percentage, ci.pricing_markup_percentage),
    price_table_id = null
from public.price_tables pt
where ci.price_table_id = pt.id;

alter table public.product_categories add column if not exists active boolean not null default true;
update public.product_categories set active = false;
update public.price_tables set active = false;

create table if not exists public.catalog_media (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  catalog_item_id uuid references public.catalog_items(id) on delete cascade,
  material_id uuid references public.materials(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  sort_order integer not null default 0,
  is_cover boolean not null default false,
  created_at timestamptz not null default now(),
  check (((catalog_item_id is not null)::integer + (material_id is not null)::integer) = 1)
);

create unique index if not exists catalog_media_one_product_cover_idx on public.catalog_media(catalog_item_id) where is_cover;
create unique index if not exists catalog_media_one_material_cover_idx on public.catalog_media(material_id) where is_cover;
create index if not exists catalog_media_product_order_idx on public.catalog_media(catalog_item_id, sort_order);
create index if not exists catalog_media_material_order_idx on public.catalog_media(material_id, sort_order);

create or replace function public.normalize_catalog_media_cover() returns trigger language plpgsql security definer set search_path = public as $$
declare
  target_product uuid;
  target_material uuid;
begin
  if tg_op = 'DELETE' then
    target_product := old.catalog_item_id;
    target_material := old.material_id;
  else
    target_product := new.catalog_item_id;
    target_material := new.material_id;
  end if;
  if target_product is not null and not exists (select 1 from public.catalog_media where catalog_item_id = target_product and is_cover) then
    update public.catalog_media set is_cover = true where id = (
      select id from public.catalog_media where catalog_item_id = target_product order by sort_order, created_at limit 1
    );
  end if;
  if target_material is not null and not exists (select 1 from public.catalog_media where material_id = target_material and is_cover) then
    update public.catalog_media set is_cover = true where id = (
      select id from public.catalog_media where material_id = target_material order by sort_order, created_at limit 1
    );
  end if;
  return null;
end;
$$;

drop trigger if exists catalog_media_normalize_cover on public.catalog_media;
create trigger catalog_media_normalize_cover after insert or update or delete on public.catalog_media for each row execute function public.normalize_catalog_media_cover();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('linha-e-laco-catalog-media', 'linha-e-laco-catalog-media', false, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists catalog_media_owner_access on storage.objects;
create policy catalog_media_owner_access on storage.objects for all to authenticated
using (bucket_id = 'linha-e-laco-catalog-media' and (storage.foldername(name))[1] = (select auth.uid()::text))
with check (bucket_id = 'linha-e-laco-catalog-media' and (storage.foldername(name))[1] = (select auth.uid()::text));

create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, name)
);

alter table public.payments add column if not exists payment_method_id uuid references public.payment_methods(id) on delete set null;
alter table public.payments add column if not exists payment_method_name_snapshot text not null default '';
update public.payments set payment_method_name_snapshot = coalesce(nullif(payment_method_name_snapshot, ''), payment_method, 'Não informado');

insert into public.payment_methods (owner_id, name, sort_order)
select u.id, defaults.name, defaults.sort_order
from auth.users u
cross join (values ('Pix', 1), ('Dinheiro', 2), ('Cartão de crédito', 3), ('Cartão de débito', 4), ('Transferência', 5)) as defaults(name, sort_order)
on conflict (owner_id, name) do nothing;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name) values (new.id, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1))) on conflict (id) do nothing;
  insert into public.business_settings (owner_id, business_name) values (new.id, 'Linha & Laço') on conflict (owner_id) do nothing;
  insert into public.payment_methods (owner_id, name, sort_order)
  values (new.id, 'Pix', 1), (new.id, 'Dinheiro', 2), (new.id, 'Cartão de crédito', 3), (new.id, 'Cartão de débito', 4), (new.id, 'Transferência', 5)
  on conflict (owner_id, name) do nothing;
  return new;
end;
$$;

create or replace function public.recalculate_catalog_item_cost(item_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare material_total numeric := 0; labor_total numeric := 0; overhead_total numeric := 0; markup numeric := 0; mode text := 'material_cost'; fixed numeric := null;
begin
  select coalesce(sum(pm.quantity * m.price_per_unit * public.unit_factor(pm.usage_unit) / public.unit_factor(m.price_unit)), 0)
  into material_total from public.product_materials pm join public.materials m on m.id = pm.material_id
  where pm.catalog_item_id = item_id and public.unit_family(pm.usage_unit) = public.unit_family(m.price_unit);
  select labor_cost, overhead_cost, pricing_markup_percentage, pricing_mode, fixed_price
  into labor_total, overhead_total, markup, mode, fixed from public.catalog_items where id = item_id;
  update public.catalog_items set material_cost = material_total, production_cost = material_total + coalesce(labor_total, 0) + coalesce(overhead_total, 0),
    base_price = case when mode = 'fixed_price' then coalesce(fixed, base_price) else round((material_total + coalesce(labor_total, 0) + coalesce(overhead_total, 0)) * (1 + coalesce(markup, 0) / 100), 2) end
  where id = item_id;
end;
$$;

alter table public.catalog_media enable row level security;
alter table public.payment_methods enable row level security;
drop policy if exists owner_access on public.catalog_media;
create policy owner_access on public.catalog_media for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists owner_access on public.payment_methods;
create policy owner_access on public.payment_methods for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

drop trigger if exists payment_methods_updated_at on public.payment_methods;
create trigger payment_methods_updated_at before update on public.payment_methods for each row execute function public.set_updated_at();
drop trigger if exists audit_catalog_media on public.catalog_media;
create trigger audit_catalog_media after insert or update or delete on public.catalog_media for each row execute function public.audit_business_change();
drop trigger if exists audit_payment_methods on public.payment_methods;
create trigger audit_payment_methods after insert or update or delete on public.payment_methods for each row execute function public.audit_business_change();