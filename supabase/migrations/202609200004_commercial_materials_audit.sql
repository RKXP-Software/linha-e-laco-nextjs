-- Commercial quotes, reusable materials and immutable audit history.

do $$ begin
  create type public.measurement_unit as enum ('mm', 'cm', 'm', 'mg', 'g', 'kg', 'ml', 'L', 'un');
exception when duplicate_object then null;
end $$;

create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  description text not null default '',
  price_unit public.measurement_unit not null default 'un',
  price_per_unit numeric(12,4) not null check (price_per_unit >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, name)
);

alter table public.catalog_items add column if not exists pricing_markup_percentage numeric(7,2) not null default 0 check (pricing_markup_percentage >= 0);
alter table public.orders add column if not exists customer_name_snapshot text;
alter table public.orders add column if not exists quote_issued_on date not null default current_date;
alter table public.orders add column if not exists quote_valid_until date;
alter table public.orders add column if not exists discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0);
alter table public.orders add column if not exists payment_terms text not null default '';
alter table public.order_attachments add column if not exists caption text not null default '';
alter table public.order_attachments add column if not exists mime_type text;
alter table public.order_attachments add column if not exists size_bytes bigint;
alter table public.order_attachments add column if not exists include_in_quote boolean not null default true;
alter table public.product_materials add column if not exists material_id uuid;
alter table public.product_materials add column if not exists usage_unit public.measurement_unit not null default 'un';
alter table public.product_materials add column if not exists material_name_snapshot text;
alter table public.product_materials add column if not exists unit_cost_snapshot numeric(12,4) not null default 0;

update public.orders o
set customer_name_snapshot = coalesce(o.customer_name_snapshot, c.name)
from public.clients c
where o.client_id = c.id and o.customer_name_snapshot is null;

update public.catalog_items
set pricing_markup_percentage = case
  when production_cost > 0 then greatest(0, round(((base_price / production_cost) - 1) * 100, 2))
  else 0
end
where pricing_markup_percentage = 0;

-- Legacy recipe rows become reusable materials without discarding their snapshots.
insert into public.materials (owner_id, name, price_unit, price_per_unit)
select distinct on (pm.owner_id, pm.material_name, pm.unit, pm.unit_cost)
  pm.owner_id,
  pm.material_name,
  case when pm.unit in ('mm', 'cm', 'm', 'mg', 'g', 'kg', 'ml', 'L', 'un') then pm.unit::public.measurement_unit else 'un'::public.measurement_unit end,
  pm.unit_cost
from public.product_materials pm
where coalesce(trim(pm.material_name), '') <> ''
on conflict (owner_id, name) do nothing;

update public.product_materials pm
set material_id = m.id,
    usage_unit = case when pm.unit in ('mm', 'cm', 'm', 'mg', 'g', 'kg', 'ml', 'L', 'un') then pm.unit::public.measurement_unit else 'un'::public.measurement_unit end,
    material_name_snapshot = coalesce(pm.material_name_snapshot, pm.material_name),
    unit_cost_snapshot = pm.unit_cost
from public.materials m
where pm.material_id is null
  and m.owner_id = pm.owner_id
  and m.name = pm.material_name;

alter table public.product_materials drop constraint if exists product_materials_material_id_fkey;
alter table public.product_materials add constraint product_materials_material_id_fkey foreign key (material_id) references public.materials(id) on delete set null;
alter table public.orders drop constraint if exists orders_client_id_fkey;
alter table public.orders alter column client_id drop not null;
alter table public.orders add constraint orders_client_id_fkey foreign key (client_id) references public.clients(id) on delete set null;
alter table public.order_items drop constraint if exists order_items_catalog_item_id_fkey;
alter table public.order_items add constraint order_items_catalog_item_id_fkey foreign key (catalog_item_id) references public.catalog_items(id) on delete set null;

create or replace function public.unit_family(unit_value public.measurement_unit) returns text language sql immutable as $$
  select case unit_value
    when 'mm' then 'length' when 'cm' then 'length' when 'm' then 'length'
    when 'mg' then 'weight' when 'g' then 'weight' when 'kg' then 'weight'
    when 'ml' then 'volume' when 'L' then 'volume' else 'count'
  end
$$;

create or replace function public.unit_factor(unit_value public.measurement_unit) returns numeric language sql immutable as $$
  select case unit_value
    when 'mm' then 0.001 when 'cm' then 0.01 when 'm' then 1
    when 'mg' then 0.001 when 'g' then 1 when 'kg' then 1000
    when 'ml' then 0.001 when 'L' then 1 else 1
  end
$$;

create or replace function public.recalculate_catalog_item_cost(item_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare
  material_total numeric := 0;
  labor_total numeric := 0;
  overhead_total numeric := 0;
  markup numeric := 0;
begin
  select coalesce(sum(pm.quantity * m.price_per_unit * public.unit_factor(pm.usage_unit) / public.unit_factor(m.price_unit)), 0)
  into material_total
  from public.product_materials pm
  join public.materials m on m.id = pm.material_id
  where pm.catalog_item_id = item_id
    and public.unit_family(pm.usage_unit) = public.unit_family(m.price_unit);

  select ci.labor_cost, ci.overhead_cost, coalesce(pt.markup_percentage, ci.pricing_markup_percentage)
  into labor_total, overhead_total, markup
  from public.catalog_items ci
  left join public.price_tables pt on pt.id = ci.price_table_id
  where ci.id = item_id;

  update public.catalog_items
  set material_cost = material_total,
      production_cost = material_total + coalesce(labor_total, 0) + coalesce(overhead_total, 0),
      base_price = round((material_total + coalesce(labor_total, 0) + coalesce(overhead_total, 0)) * (1 + coalesce(markup, 0) / 100), 2)
  where id = item_id;
end;
$$;

create or replace function public.refresh_catalog_item_cost() returns trigger language plpgsql security definer set search_path = public as $$
declare
  affected_item_id uuid;
  affected_material_id uuid;
begin
  if tg_table_name = 'materials' then
    affected_material_id := case when tg_op = 'DELETE' then old.id else new.id end;
    for affected_item_id in select distinct catalog_item_id from public.product_materials where material_id = affected_material_id loop
      perform public.recalculate_catalog_item_cost(affected_item_id);
    end loop;
  else
    affected_item_id := case when tg_op = 'DELETE' then old.catalog_item_id else new.catalog_item_id end;
    perform public.recalculate_catalog_item_cost(affected_item_id);
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists materials_recalculate_products on public.materials;
create trigger materials_recalculate_products after update of price_per_unit, price_unit on public.materials for each row execute function public.refresh_catalog_item_cost();
drop trigger if exists product_materials_recalculate_product on public.product_materials;
create trigger product_materials_recalculate_product after insert or update or delete on public.product_materials for each row execute function public.refresh_catalog_item_cost();
drop trigger if exists materials_updated_at on public.materials;
create trigger materials_updated_at before update on public.materials for each row execute function public.set_updated_at();

create table if not exists public.system_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  entity_type text not null,
  entity_id uuid not null,
  action text not null check (action in ('created', 'updated', 'deleted', 'quote_exported')),
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.audit_business_change() returns trigger language plpgsql security definer set search_path = public as $$
declare
  previous_data jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  next_data jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  record_owner text;
  record_id text;
begin
  record_owner := coalesce(next_data ->> 'owner_id', previous_data ->> 'owner_id', auth.uid()::text);
  record_id := coalesce(next_data ->> 'id', previous_data ->> 'id');
  if record_owner is not null and record_id is not null then
    insert into public.system_logs (owner_id, actor_id, entity_type, entity_id, action, before_data, after_data)
    values (record_owner::uuid, auth.uid(), tg_table_name, record_id::uuid,
      case tg_op when 'INSERT' then 'created' when 'UPDATE' then 'updated' else 'deleted' end,
      previous_data, next_data);
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array['materials','product_materials','catalog_items','product_categories','price_tables','clients','orders','order_items','order_attachments','payments','notes','business_settings'] loop
    execute format('drop trigger if exists %I on public.%I', 'audit_' || table_name, table_name);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_business_change()', 'audit_' || table_name, table_name);
  end loop;
end;
$$;

alter table public.materials enable row level security;
alter table public.system_logs enable row level security;
drop policy if exists owner_access on public.materials;
create policy owner_access on public.materials for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists logs_owner_read on public.system_logs;
create policy logs_owner_read on public.system_logs for select to authenticated using (owner_id = (select auth.uid()));

create or replace function public.record_quote_export(order_id_value uuid) returns void language plpgsql security definer set search_path = public as $$
declare order_owner uuid;
begin
  select owner_id into order_owner from public.orders where id = order_id_value;
  if order_owner is null or order_owner <> auth.uid() then
    raise exception 'Pedido não encontrado';
  end if;
  insert into public.system_logs (owner_id, actor_id, entity_type, entity_id, action, after_data)
  values (order_owner, auth.uid(), 'orders', order_id_value, 'quote_exported', jsonb_build_object('number', (select number from public.orders where id = order_id_value)));
end;
$$;

create index if not exists materials_owner_name_idx on public.materials(owner_id, name);
create index if not exists system_logs_owner_created_idx on public.system_logs(owner_id, created_at desc);