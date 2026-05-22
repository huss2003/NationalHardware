
create table public.door_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  rate numeric not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.door_types enable row level security;
create policy "anon all door_types" on public.door_types for all to anon using (true) with check (true);
create policy "auth read door_types" on public.door_types for select to authenticated using (true);
create policy "auth write door_types" on public.door_types for insert to authenticated with check (true);
create policy "auth update door_types" on public.door_types for update to authenticated using (true) with check (true);
create policy "auth delete door_types" on public.door_types for delete to authenticated using (true);

create table public.door_orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null,
  order_date timestamptz not null default now(),
  category text not null check (category in ('general','vypaari')),
  customer_name text not null,
  party_door_size text,
  front_mica text,
  back_mica text,
  door_taken_size text,
  door_type_id uuid references public.door_types(id) on delete set null,
  door_type_name text,
  rate numeric not null default 0,
  total numeric not null default 0,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.door_orders enable row level security;
create policy "anon all door_orders" on public.door_orders for all to anon using (true) with check (true);
create policy "auth read door_orders" on public.door_orders for select to authenticated using (true);
create policy "auth write door_orders" on public.door_orders for insert to authenticated with check (true);
create policy "auth update door_orders" on public.door_orders for update to authenticated using (true) with check (true);
create policy "auth delete door_orders" on public.door_orders for delete to authenticated using (true);

create trigger door_types_updated_at before update on public.door_types for each row execute function public.tg_set_updated_at();
create trigger door_orders_updated_at before update on public.door_orders for each row execute function public.tg_set_updated_at();
