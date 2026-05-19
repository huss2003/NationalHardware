
-- ============================================================
-- 1. Roles + Profiles infrastructure
-- ============================================================

do $$ begin
  create type public.app_role as enum ('admin','billing','store','production');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.user_roles where user_id=_user_id and role=_role) $$;

create or replace function public.current_user_is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select public.has_role(auth.uid(), 'admin'::public.app_role) $$;

-- Auto-create profile + assign default role (first user => admin)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare is_first boolean;
begin
  insert into public.profiles(id, display_name)
    values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));
  select count(*) = 0 into is_first from public.user_roles;
  insert into public.user_roles(user_id, role)
    values (new.id, case when is_first then 'admin'::public.app_role else 'billing'::public.app_role end);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS for profiles & user_roles
drop policy if exists "profiles self read" on public.profiles;
drop policy if exists "profiles read all signed in" on public.profiles;
drop policy if exists "profiles self update" on public.profiles;
create policy "profiles read all signed in" on public.profiles
  for select to authenticated using (true);
create policy "profiles self update" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "user_roles read all signed in" on public.user_roles;
drop policy if exists "user_roles admin manage" on public.user_roles;
create policy "user_roles read all signed in" on public.user_roles
  for select to authenticated using (true);
create policy "user_roles admin manage" on public.user_roles
  for all to authenticated
  using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

-- ============================================================
-- 2. Drop ALL anon policies on every business table
-- ============================================================

drop policy if exists "anon all shop_users" on public.shop_users;
drop policy if exists "anon all suppliers" on public.suppliers;
drop policy if exists "anon all customers" on public.customers;
drop policy if exists "anon all products" on public.products;
drop policy if exists "anon all id_sequences" on public.id_sequences;
drop policy if exists "anon all purchases" on public.purchases;
drop policy if exists "anon all purchase_items" on public.purchase_items;
drop policy if exists "anon all item_instances" on public.item_instances;
drop policy if exists "anon insert item_history" on public.item_history;
drop policy if exists "anon read item_history" on public.item_history;
drop policy if exists "anon all sales" on public.sales;
drop policy if exists "anon all sales_items" on public.sales_items;
drop policy if exists "anon all bom" on public.bom;
drop policy if exists "anon all bom_items" on public.bom_items;
drop policy if exists "anon all production_orders" on public.production_orders;
drop policy if exists "anon all production_materials" on public.production_materials;
drop policy if exists "anon all produced_items" on public.produced_items;
drop policy if exists "anon insert audit_log" on public.audit_log;
drop policy if exists "anon read audit_log" on public.audit_log;
drop policy if exists "anon all recycle_bin" on public.recycle_bin;
drop policy if exists "anon all alerts" on public.alerts;
drop policy if exists "anon all app_settings" on public.app_settings;

-- ============================================================
-- 3. Tighten admin-only writes on sensitive tables
-- ============================================================

-- app_settings: read for all signed-in, mutate only admin
drop policy if exists "auth update app_settings" on public.app_settings;
drop policy if exists "auth write app_settings" on public.app_settings;
drop policy if exists "auth delete app_settings" on public.app_settings;
create policy "admin update app_settings" on public.app_settings
  for update to authenticated using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));
create policy "admin insert app_settings" on public.app_settings
  for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "admin delete app_settings" on public.app_settings
  for delete to authenticated using (public.has_role(auth.uid(),'admin'));

-- recycle_bin: admin only mutate
drop policy if exists "auth update recycle_bin" on public.recycle_bin;
drop policy if exists "auth delete recycle_bin" on public.recycle_bin;
create policy "admin update recycle_bin" on public.recycle_bin
  for update to authenticated using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));
create policy "admin delete recycle_bin" on public.recycle_bin
  for delete to authenticated using (public.has_role(auth.uid(),'admin'));

-- shop_users: admin only (legacy table retained for now)
drop policy if exists "auth update shop_users" on public.shop_users;
drop policy if exists "auth write shop_users" on public.shop_users;
drop policy if exists "auth delete shop_users" on public.shop_users;
create policy "admin manage shop_users" on public.shop_users
  for all to authenticated
  using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

-- ============================================================
-- 4. Drop legacy PIN functions
-- ============================================================
drop function if exists public.verify_pin(text, text);
drop function if exists public.set_shop_user_pin(uuid, text);
drop function if exists public.hash_pin(text);

-- ============================================================
-- 5. Harden remaining SECURITY DEFINER functions
-- ============================================================
create or replace function public.is_signed_in()
returns boolean language sql stable set search_path = public
as $$ select auth.role() = 'authenticated' $$;

-- Revoke broad EXECUTE from anon; allow authenticated where the app needs it
revoke execute on function public.mint_item_instances(uuid, uuid) from public, anon;
grant execute on function public.mint_item_instances(uuid, uuid) to authenticated;

revoke execute on function public.record_sale(jsonb, uuid) from public, anon;
grant execute on function public.record_sale(jsonb, uuid) to authenticated;

revoke execute on function public.mark_damaged(text, text, uuid) from public, anon;
grant execute on function public.mark_damaged(text, text, uuid) to authenticated;

revoke execute on function public.consume_material(uuid, text, uuid) from public, anon;
grant execute on function public.consume_material(uuid, text, uuid) to authenticated;

revoke execute on function public.complete_production(uuid, uuid) from public, anon;
grant execute on function public.complete_production(uuid, uuid) to authenticated;

revoke execute on function public.soft_delete_invoice(uuid, text, uuid) from public, anon;
grant execute on function public.soft_delete_invoice(uuid, text, uuid) to authenticated;

revoke execute on function public.next_item_id(text) from public, anon;
grant execute on function public.next_item_id(text) to authenticated;

revoke execute on function public.shop_user_has_role(uuid, public.user_role) from public, anon;

revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;

-- ============================================================
-- 6. Storage: DELETE policies + remove anonymous access to private buckets
-- ============================================================

drop policy if exists "auth delete bill-images" on storage.objects;
create policy "auth delete bill-images" on storage.objects
  for delete to authenticated using (bucket_id = 'bill-images');

drop policy if exists "auth delete invoices" on storage.objects;
create policy "auth delete invoices" on storage.objects
  for delete to authenticated using (bucket_id = 'invoices');

drop policy if exists "auth delete product-images" on storage.objects;
create policy "auth delete product-images" on storage.objects
  for delete to authenticated using (bucket_id = 'product-images');
