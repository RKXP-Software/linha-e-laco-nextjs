-- Unifies Linha & Laço around a single authenticated Next.js application.
-- Existing legacy rows remain intact; set their owner_id to the first authenticated owner during the controlled migration.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_settings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  business_name text not null default 'Linha & Laço',
  phone text,
  currency_code text not null default 'BRL',
  logo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id)
);

create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique(owner_id, name)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  paid_at date not null default current_date,
  payment_method text,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.clients add column if not exists owner_id uuid default auth.uid() references auth.users(id) on delete cascade;
alter table public.catalog_items add column if not exists owner_id uuid default auth.uid() references auth.users(id) on delete cascade;
alter table public.catalog_items add column if not exists category_id uuid references public.product_categories(id) on delete set null;
alter table public.orders add column if not exists owner_id uuid default auth.uid() references auth.users(id) on delete cascade;
alter table public.order_items add column if not exists owner_id uuid default auth.uid() references auth.users(id) on delete cascade;
alter table public.order_status_history add column if not exists owner_id uuid default auth.uid() references auth.users(id) on delete cascade;
alter table public.payment_installments add column if not exists owner_id uuid default auth.uid() references auth.users(id) on delete cascade;
alter table public.order_attachments add column if not exists owner_id uuid default auth.uid() references auth.users(id) on delete cascade;
alter table public.receipts add column if not exists owner_id uuid default auth.uid() references auth.users(id) on delete cascade;
alter table public.notes add column if not exists owner_id uuid default auth.uid() references auth.users(id) on delete cascade;
alter table public.notes add column if not exists title text;
alter table public.notes add column if not exists content jsonb not null default '{}'::jsonb;
alter table public.notes add column if not exists updated_at timestamptz not null default now();
alter table public.client_measurement_profiles add column if not exists owner_id uuid default auth.uid() references auth.users(id) on delete cascade;

create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists business_settings_updated_at on public.business_settings;
create trigger business_settings_updated_at before update on public.business_settings for each row execute function public.set_updated_at();
drop trigger if exists notes_updated_at on public.notes;
create trigger notes_updated_at before update on public.notes for each row execute function public.set_updated_at();

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name) values (new.id, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1))) on conflict (id) do nothing;
  insert into public.business_settings (owner_id) values (new.id) on conflict (owner_id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.business_settings enable row level security;
alter table public.product_categories enable row level security;
alter table public.payments enable row level security;
alter table public.clients enable row level security;
alter table public.client_measurement_profiles enable row level security;
alter table public.catalog_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_attachments enable row level security;
alter table public.order_status_history enable row level security;
alter table public.payment_installments enable row level security;
alter table public.receipts enable row level security;
alter table public.notes enable row level security;

-- A user can access only their own business data. New rows receive auth.uid() through defaults.
drop policy if exists profiles_owner on public.profiles;
create policy profiles_owner on public.profiles for all to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

do $$
declare table_name text;
begin
  foreach table_name in array array['business_settings','product_categories','payments','clients','client_measurement_profiles','catalog_items','orders','order_items','order_attachments','order_status_history','payment_installments','receipts','notes'] loop
    execute format('drop policy if exists owner_access on public.%I', table_name);
    execute format('create policy owner_access on public.%I for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))', table_name);
  end loop;
end;
$$;

-- Dedicated private bucket for future customer/order attachments.
insert into storage.buckets (id, name, public) values ('linha-e-laco-attachments', 'linha-e-laco-attachments', false) on conflict (id) do nothing;
drop policy if exists attachments_owner_access on storage.objects;
create policy attachments_owner_access on storage.objects for all to authenticated using (bucket_id = 'linha-e-laco-attachments' and owner_id = (select auth.uid())) with check (bucket_id = 'linha-e-laco-attachments' and owner_id = (select auth.uid()));
