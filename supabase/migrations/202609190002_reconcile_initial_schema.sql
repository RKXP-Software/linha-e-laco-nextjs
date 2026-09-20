create extension if not exists pgcrypto;

-- Safe recovery for an initial migration that stopped after creating enum types.
do $$ begin create type public.catalog_kind as enum ('service', 'garment'); exception when duplicate_object then null; end $$;
do $$ begin create type public.order_status as enum ('quoted', 'approved', 'in_production', 'ready', 'delivered', 'cancelled'); exception when duplicate_object then null; end $$;
do $$ begin create type public.installment_status as enum ('open', 'paid', 'overdue'); exception when duplicate_object then null; end $$;

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(), name text not null, cpf text, email text, phone text,
  address jsonb, notes text, created_at timestamptz not null default now()
);
create table if not exists public.client_measurement_profiles (
  id uuid primary key default gen_random_uuid(), client_id uuid not null references public.clients(id) on delete cascade,
  name text not null default 'Padrão', measurements jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create table if not exists public.catalog_items (
  id uuid primary key default gen_random_uuid(), kind public.catalog_kind not null, name text not null,
  description text not null default '', base_price numeric(12,2) not null check (base_price >= 0),
  estimated_days integer not null default 0 check (estimated_days >= 0), service_detail jsonb, garment_detail jsonb,
  active boolean not null default true, created_at timestamptz not null default now(),
  check ((kind = 'service' and service_detail is not null and garment_detail is null) or
         (kind = 'garment' and garment_detail is not null and service_detail is null))
);
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(), number text not null unique,
  client_id uuid not null references public.clients(id), status public.order_status not null default 'quoted',
  promised_for date, notes text, measurement_snapshot jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
  catalog_item_id uuid references public.catalog_items(id), name_snapshot text not null, kind public.catalog_kind not null,
  unit_price numeric(12,2) not null check (unit_price >= 0), quantity integer not null check (quantity > 0),
  notes text, technical_sheet jsonb not null default '{}'::jsonb
);
create table if not exists public.order_attachments (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
  storage_path text not null, file_name text not null, created_at timestamptz not null default now()
);
create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
  status public.order_status not null, changed_at timestamptz not null default now()
);
create table if not exists public.payment_installments (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
  installment_number integer not null, amount numeric(12,2) not null check (amount > 0), due_date date not null,
  paid_at date, status public.installment_status not null default 'open', unique(order_id, installment_number)
);
create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id),
  storage_path text not null, created_at timestamptz not null default now()
);
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(), text text not null, is_done boolean not null default false,
  created_at timestamptz not null default now()
);

alter table if exists public.clients enable row level security;
alter table if exists public.client_measurement_profiles enable row level security;
alter table if exists public.catalog_items enable row level security;
alter table if exists public.orders enable row level security;
alter table if exists public.order_items enable row level security;
alter table if exists public.order_attachments enable row level security;
alter table if exists public.order_status_history enable row level security;
alter table if exists public.payment_installments enable row level security;
alter table if exists public.receipts enable row level security;
alter table if exists public.notes enable row level security;
