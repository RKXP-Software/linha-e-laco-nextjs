-- Detailed production costing and reusable price tables for products and services.

alter table public.catalog_items add column if not exists material_cost numeric(12,2) not null default 0 check (material_cost >= 0);
alter table public.catalog_items add column if not exists labor_cost numeric(12,2) not null default 0 check (labor_cost >= 0);
alter table public.catalog_items add column if not exists overhead_cost numeric(12,2) not null default 0 check (overhead_cost >= 0);
alter table public.catalog_items add column if not exists production_cost numeric(12,2) not null default 0 check (production_cost >= 0);
alter table public.catalog_items add column if not exists price_table_id uuid;

create table if not exists public.price_tables (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  markup_percentage numeric(7,2) not null default 100 check (markup_percentage >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(owner_id, name)
);

alter table public.catalog_items drop constraint if exists catalog_items_price_table_id_fkey;
alter table public.catalog_items add constraint catalog_items_price_table_id_fkey foreign key (price_table_id) references public.price_tables(id) on delete set null;

create table if not exists public.product_materials (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  catalog_item_id uuid not null references public.catalog_items(id) on delete cascade,
  material_name text not null,
  unit text not null default 'un',
  quantity numeric(12,3) not null check (quantity > 0),
  unit_cost numeric(12,2) not null check (unit_cost >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.product_price_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  price_table_id uuid not null references public.price_tables(id) on delete cascade,
  catalog_item_id uuid not null references public.catalog_items(id) on delete cascade,
  production_cost_snapshot numeric(12,2) not null check (production_cost_snapshot >= 0),
  sale_price numeric(12,2) not null check (sale_price >= 0),
  created_at timestamptz not null default now(),
  unique(price_table_id, catalog_item_id)
);

alter table public.price_tables enable row level security;
alter table public.product_materials enable row level security;
alter table public.product_price_entries enable row level security;

do $$
declare table_name text;
begin
  foreach table_name in array array['price_tables','product_materials','product_price_entries'] loop
    execute format('drop policy if exists owner_access on public.%I', table_name);
    execute format('create policy owner_access on public.%I for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))', table_name);
  end loop;
end;
$$;

create index if not exists product_materials_catalog_item_id_idx on public.product_materials(catalog_item_id);
create index if not exists product_price_entries_catalog_item_id_idx on public.product_price_entries(catalog_item_id);
