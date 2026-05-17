
-- =========================================================================
-- ENUMS
-- =========================================================================
create type public.user_role as enum ('admin','billing','store','production');
create type public.product_category as enum ('plywood','hardware','door','other');
create type public.item_status as enum ('available','sold','damaged','used_in_production','returned','reserved');
create type public.payment_mode as enum ('cash','credit','upi','card');
create type public.production_status as enum ('open','in_progress','completed','cancelled');
create type public.alert_severity as enum ('info','warning','critical');
create type public.history_event as enum (
  'purchased','sold','damaged','used_in_production','returned','reserved','moved','restored'
);

-- =========================================================================
-- UTIL: updated_at trigger
-- =========================================================================
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- =========================================================================
-- SHOP USERS (PIN auth) — separate from auth.users (device login is shared)
-- =========================================================================
create table public.shop_users (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  pin_hash text not null,
  role public.user_role not null default 'billing',
  active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_shop_users_updated before update on public.shop_users
  for each row execute function public.tg_set_updated_at();

-- Helper: is current auth user an admin device? For shared-PIN model we keep
-- it simple — any signed-in auth user can access; role enforcement happens
-- via the actor_user_id passed into RPCs and policies below.
create or replace function public.is_signed_in() returns boolean
language sql stable as $$ select auth.role() = 'authenticated' $$;

create or replace function public.shop_user_has_role(_user_id uuid, _role public.user_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.shop_users where id = _user_id and role = _role and active);
$$;

-- =========================================================================
-- ID SEQUENCES (human-readable IDs)
-- =========================================================================
create table public.id_sequences (
  prefix text primary key,
  next_value bigint not null default 1
);

create or replace function public.next_item_id(_prefix text)
returns text language plpgsql security definer set search_path = public as $$
declare v bigint;
begin
  insert into public.id_sequences(prefix, next_value) values (_prefix, 1)
    on conflict (prefix) do nothing;
  update public.id_sequences set next_value = next_value + 1
    where prefix = _prefix returning next_value - 1 into v;
  return _prefix || '-' || lpad(v::text, 6, '0');
end $$;

-- =========================================================================
-- DIRECTORIES
-- =========================================================================
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text, gstin text, address text, state text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_suppliers_updated before update on public.suppliers
  for each row execute function public.tg_set_updated_at();

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text, gstin text, address text, state text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_customers_updated before update on public.customers
  for each row execute function public.tg_set_updated_at();

-- =========================================================================
-- PRODUCTS
-- =========================================================================
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text unique,
  category public.product_category not null default 'other',
  prefix text not null,
  hsn text,
  gst_rate numeric(5,2) not null default 18,
  unit text not null default 'pcs',
  image_url text,
  reorder_level int not null default 5,
  default_cost numeric(12,2) not null default 0,
  default_price numeric(12,2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_products_updated before update on public.products
  for each row execute function public.tg_set_updated_at();

-- =========================================================================
-- PURCHASES
-- =========================================================================
create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references public.suppliers(id),
  bill_no text,
  bill_date date not null default current_date,
  bill_image_url text,
  notes text,
  subtotal numeric(14,2) not null default 0,
  tax_total numeric(14,2) not null default 0,
  grand_total numeric(14,2) not null default 0,
  created_by uuid references public.shop_users(id),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_purchases_updated before update on public.purchases
  for each row execute function public.tg_set_updated_at();

create table public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  product_id uuid not null references public.products(id),
  qty int not null check (qty > 0),
  rate numeric(12,2) not null default 0,
  gst_rate numeric(5,2) not null default 18,
  line_total numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);

-- =========================================================================
-- ITEM INSTANCES (unit-level)
-- =========================================================================
create table public.item_instances (
  id text primary key,  -- e.g. PLY-000123
  product_id uuid not null references public.products(id),
  source_purchase_item_id uuid references public.purchase_items(id),
  status public.item_status not null default 'available',
  location text,
  cost_price numeric(12,2) not null default 0,
  barcode_payload text not null,
  qr_payload jsonb not null,
  produced_by_order_id uuid,  -- set if minted by production
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_item_instances_product on public.item_instances(product_id);
create index idx_item_instances_status on public.item_instances(status);
create trigger trg_item_instances_updated before update on public.item_instances
  for each row execute function public.tg_set_updated_at();

-- =========================================================================
-- ITEM HISTORY (append-only)
-- =========================================================================
create table public.item_history (
  id bigserial primary key,
  item_id text not null references public.item_instances(id) on delete cascade,
  event public.history_event not null,
  ref_table text,
  ref_id text,
  actor_user_id uuid references public.shop_users(id),
  notes text,
  created_at timestamptz not null default now()
);
create index idx_item_history_item on public.item_history(item_id, created_at desc);

-- =========================================================================
-- SALES
-- =========================================================================
create table public.sales (
  id uuid primary key default gen_random_uuid(),
  invoice_no text unique,
  customer_id uuid references public.customers(id),
  invoice_date timestamptz not null default now(),
  subtotal numeric(14,2) not null default 0,
  discount numeric(14,2) not null default 0,
  cgst numeric(14,2) not null default 0,
  sgst numeric(14,2) not null default 0,
  igst numeric(14,2) not null default 0,
  grand_total numeric(14,2) not null default 0,
  payment_mode public.payment_mode not null default 'cash',
  paid_amount numeric(14,2) not null default 0,
  notes text,
  created_by uuid references public.shop_users(id),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_sales_updated before update on public.sales
  for each row execute function public.tg_set_updated_at();

create table public.sales_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid not null references public.products(id),
  item_instance_id text references public.item_instances(id),
  qty int not null default 1,
  rate numeric(12,2) not null default 0,
  gst_rate numeric(5,2) not null default 18,
  line_total numeric(14,2) not null default 0
);
create index idx_sales_items_sale on public.sales_items(sale_id);

-- =========================================================================
-- BOM
-- =========================================================================
create table public.bom (
  id uuid primary key default gen_random_uuid(),
  finished_product_id uuid not null references public.products(id) on delete cascade,
  version int not null default 1,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (finished_product_id, version)
);

create table public.bom_items (
  id uuid primary key default gen_random_uuid(),
  bom_id uuid not null references public.bom(id) on delete cascade,
  component_product_id uuid not null references public.products(id),
  qty int not null check (qty > 0)
);

-- =========================================================================
-- PRODUCTION
-- =========================================================================
create table public.production_orders (
  id uuid primary key default gen_random_uuid(),
  finished_product_id uuid not null references public.products(id),
  bom_id uuid references public.bom(id),
  qty int not null default 1 check (qty > 0),
  status public.production_status not null default 'open',
  assigned_to uuid references public.shop_users(id),
  notes text,
  created_by uuid references public.shop_users(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);
create trigger trg_production_orders_updated before update on public.production_orders
  for each row execute function public.tg_set_updated_at();

create table public.production_materials (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.production_orders(id) on delete cascade,
  item_instance_id text not null references public.item_instances(id),
  product_id uuid not null references public.products(id),
  consumed_at timestamptz not null default now(),
  actor_user_id uuid references public.shop_users(id)
);

create table public.produced_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.production_orders(id) on delete cascade,
  item_instance_id text not null references public.item_instances(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- =========================================================================
-- AUDIT / RECYCLE / ALERTS / SETTINGS
-- =========================================================================
create table public.audit_log (
  id bigserial primary key,
  actor_user_id uuid references public.shop_users(id),
  action text not null,
  ref_table text,
  ref_id text,
  details jsonb,
  created_at timestamptz not null default now()
);

create table public.recycle_bin (
  id uuid primary key default gen_random_uuid(),
  ref_table text not null,
  ref_id text not null,
  payload jsonb not null,
  reason text,
  deleted_by uuid references public.shop_users(id),
  created_at timestamptz not null default now()
);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  severity public.alert_severity not null default 'info',
  payload jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.app_settings (
  id boolean primary key default true check (id = true),
  shop_name text not null default 'My Shop',
  gstin text,
  state text,
  address text,
  default_label_format text not null default 'thermal_50x25',
  invoice_prefix text not null default 'INV',
  invoice_counter bigint not null default 1,
  updated_at timestamptz not null default now()
);
insert into public.app_settings(id) values (true);
create trigger trg_app_settings_updated before update on public.app_settings
  for each row execute function public.tg_set_updated_at();

-- Seed default prefixes
insert into public.id_sequences(prefix, next_value) values
  ('PLY', 1), ('HDR', 1), ('DOR', 1), ('OTH', 1)
  on conflict do nothing;

-- =========================================================================
-- CORE FUNCTIONS
-- =========================================================================

-- Hash helper: pgcrypto digest
create extension if not exists pgcrypto;

create or replace function public.hash_pin(_pin text)
returns text language sql immutable as $$
  select encode(digest('lovable-erp-salt:' || _pin, 'sha256'), 'hex')
$$;

create or replace function public.verify_pin(_name text, _pin text)
returns table(user_id uuid, name text, role public.user_role)
language plpgsql security definer set search_path = public as $$
declare u public.shop_users;
begin
  select * into u from public.shop_users
    where lower(name) = lower(_name) and active and pin_hash = public.hash_pin(_pin);
  if not found then
    return;
  end if;
  update public.shop_users set last_login_at = now() where id = u.id;
  return query select u.id, u.name, u.role;
end $$;

create or replace function public.set_shop_user_pin(_user_id uuid, _pin text)
returns void language sql security definer set search_path = public as $$
  update public.shop_users set pin_hash = public.hash_pin(_pin), updated_at = now()
    where id = _user_id;
$$;

-- Mint N item_instances for a purchase line
create or replace function public.mint_item_instances(
  _purchase_item_id uuid, _actor_user_id uuid
) returns setof public.item_instances
language plpgsql security definer set search_path = public as $$
declare
  pi public.purchase_items;
  p public.products;
  i int;
  new_id text;
  new_row public.item_instances;
  qr jsonb;
  bill_no text;
  sup_name text;
begin
  select * into pi from public.purchase_items where id = _purchase_item_id;
  if not found then raise exception 'purchase_item not found'; end if;
  select * into p from public.products where id = pi.product_id;
  select pu.bill_no, s.name into bill_no, sup_name
    from public.purchases pu left join public.suppliers s on s.id = pu.supplier_id
    where pu.id = pi.purchase_id;
  for i in 1..pi.qty loop
    new_id := public.next_item_id(p.prefix);
    qr := jsonb_build_object(
      'id', new_id, 'name', p.name, 'bill_no', bill_no,
      'supplier', sup_name, 'date', current_date, 'status', 'available'
    );
    insert into public.item_instances(id, product_id, source_purchase_item_id,
      status, cost_price, barcode_payload, qr_payload)
      values (new_id, p.id, pi.id, 'available', pi.rate, new_id, qr)
      returning * into new_row;
    insert into public.item_history(item_id, event, ref_table, ref_id, actor_user_id, notes)
      values (new_id, 'purchased', 'purchases', pi.purchase_id::text, _actor_user_id, 'Purchase mint');
    return next new_row;
  end loop;
end $$;

-- Record a sale atomically
create or replace function public.record_sale(_payload jsonb, _actor_user_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  sale_id uuid := gen_random_uuid();
  inv_no text;
  s public.app_settings;
  line jsonb;
  iid text;
  same_state boolean;
  cust_state text;
  total_sub numeric := 0;
  total_cgst numeric := 0;
  total_sgst numeric := 0;
  total_igst numeric := 0;
  total_disc numeric := coalesce((_payload->>'discount')::numeric, 0);
  ln_total numeric;
  ln_tax numeric;
  ln_gst numeric;
begin
  select * into s from public.app_settings where id = true;
  update public.app_settings set invoice_counter = invoice_counter + 1 where id = true
    returning invoice_prefix || '-' || lpad((invoice_counter - 1)::text, 6, '0') into inv_no;

  cust_state := _payload->>'customer_state';
  same_state := coalesce(cust_state, s.state) is not distinct from s.state and s.state is not null;

  insert into public.sales(id, invoice_no, customer_id, payment_mode, paid_amount, notes,
    discount, created_by)
    values (sale_id, inv_no,
      nullif(_payload->>'customer_id','')::uuid,
      coalesce(_payload->>'payment_mode','cash')::public.payment_mode,
      coalesce((_payload->>'paid_amount')::numeric, 0),
      _payload->>'notes', total_disc, _actor_user_id);

  for line in select * from jsonb_array_elements(_payload->'items') loop
    iid := line->>'item_instance_id';
    ln_gst := coalesce((line->>'gst_rate')::numeric, 18);
    ln_total := coalesce((line->>'qty')::numeric,1) * coalesce((line->>'rate')::numeric,0);
    ln_tax := round(ln_total * ln_gst / 100, 2);
    insert into public.sales_items(sale_id, product_id, item_instance_id, qty, rate, gst_rate, line_total)
      values (sale_id, (line->>'product_id')::uuid, iid,
        coalesce((line->>'qty')::int, 1),
        coalesce((line->>'rate')::numeric, 0),
        ln_gst, ln_total);
    total_sub := total_sub + ln_total;
    if same_state then
      total_cgst := total_cgst + ln_tax/2;
      total_sgst := total_sgst + ln_tax/2;
    else
      total_igst := total_igst + ln_tax;
    end if;

    if iid is not null then
      update public.item_instances set status = 'sold' where id = iid and status = 'available';
      if not found then
        raise exception 'Item % is not available for sale', iid;
      end if;
      insert into public.item_history(item_id, event, ref_table, ref_id, actor_user_id)
        values (iid, 'sold', 'sales', sale_id::text, _actor_user_id);
    end if;
  end loop;

  update public.sales set subtotal = total_sub, cgst = total_cgst, sgst = total_sgst,
    igst = total_igst,
    grand_total = total_sub - total_disc + total_cgst + total_sgst + total_igst
    where id = sale_id;

  insert into public.audit_log(actor_user_id, action, ref_table, ref_id, details)
    values (_actor_user_id, 'sale.create', 'sales', sale_id::text, _payload);

  return sale_id;
end $$;

create or replace function public.mark_damaged(_item_id text, _reason text, _actor_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.item_instances set status='damaged' where id=_item_id;
  insert into public.item_history(item_id, event, actor_user_id, notes)
    values (_item_id, 'damaged', _actor_user_id, _reason);
  insert into public.alerts(type, severity, payload)
    values ('damaged_item','warning', jsonb_build_object('item_id',_item_id,'reason',_reason));
end $$;

create or replace function public.consume_material(_order_id uuid, _item_id text, _actor_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  select product_id into pid from public.item_instances where id = _item_id and status = 'available';
  if pid is null then raise exception 'Item % not available', _item_id; end if;
  update public.item_instances set status='used_in_production' where id=_item_id;
  insert into public.production_materials(order_id, item_instance_id, product_id, actor_user_id)
    values (_order_id, _item_id, pid, _actor_user_id);
  insert into public.item_history(item_id, event, ref_table, ref_id, actor_user_id)
    values (_item_id, 'used_in_production', 'production_orders', _order_id::text, _actor_user_id);
end $$;

create or replace function public.complete_production(_order_id uuid, _actor_user_id uuid)
returns setof public.item_instances
language plpgsql security definer set search_path = public as $$
declare
  o public.production_orders;
  p public.products;
  i int;
  new_id text;
  qr jsonb;
  new_row public.item_instances;
begin
  select * into o from public.production_orders where id = _order_id;
  if o.status = 'completed' then raise exception 'Already completed'; end if;
  select * into p from public.products where id = o.finished_product_id;
  for i in 1..o.qty loop
    new_id := public.next_item_id(p.prefix);
    qr := jsonb_build_object('id', new_id, 'name', p.name, 'produced', true,
      'order_id', _order_id, 'date', current_date, 'status','available');
    insert into public.item_instances(id, product_id, status, cost_price, barcode_payload, qr_payload, produced_by_order_id)
      values (new_id, p.id, 'available', p.default_cost, new_id, qr, _order_id)
      returning * into new_row;
    insert into public.produced_items(order_id, item_instance_id) values (_order_id, new_id);
    insert into public.item_history(item_id, event, ref_table, ref_id, actor_user_id, notes)
      values (new_id, 'purchased', 'production_orders', _order_id::text, _actor_user_id, 'Produced');
    return next new_row;
  end loop;
  update public.production_orders set status='completed', completed_at = now() where id = _order_id;
end $$;

create or replace function public.soft_delete_invoice(_sale_id uuid, _reason text, _actor_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare payload jsonb;
begin
  if not public.shop_user_has_role(_actor_user_id, 'admin') then
    raise exception 'Admin only';
  end if;
  select to_jsonb(s) into payload from public.sales s where s.id = _sale_id;
  insert into public.recycle_bin(ref_table, ref_id, payload, reason, deleted_by)
    values ('sales', _sale_id::text, payload, _reason, _actor_user_id);
  update public.sales set deleted_at = now() where id = _sale_id;
  -- restore item statuses for scanned units
  update public.item_instances ii set status='available'
    from public.sales_items si
    where si.sale_id = _sale_id and si.item_instance_id = ii.id and ii.status = 'sold';
end $$;

-- =========================================================================
-- RLS
-- =========================================================================
alter table public.shop_users enable row level security;
alter table public.suppliers enable row level security;
alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.id_sequences enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.item_instances enable row level security;
alter table public.item_history enable row level security;
alter table public.sales enable row level security;
alter table public.sales_items enable row level security;
alter table public.bom enable row level security;
alter table public.bom_items enable row level security;
alter table public.production_orders enable row level security;
alter table public.production_materials enable row level security;
alter table public.produced_items enable row level security;
alter table public.audit_log enable row level security;
alter table public.recycle_bin enable row level security;
alter table public.alerts enable row level security;
alter table public.app_settings enable row level security;

-- Shared-device model: any authenticated session may read/write. PIN-level
-- role enforcement happens inside SECURITY DEFINER RPCs above.
do $$
declare t text;
begin
  for t in select unnest(array[
    'shop_users','suppliers','customers','products','id_sequences',
    'purchases','purchase_items','item_instances','item_history',
    'sales','sales_items','bom','bom_items','production_orders',
    'production_materials','produced_items','audit_log','recycle_bin',
    'alerts','app_settings'
  ]) loop
    execute format('create policy "auth read %1$s" on public.%1$s for select to authenticated using (true);', t);
    execute format('create policy "auth write %1$s" on public.%1$s for insert to authenticated with check (true);', t);
    execute format('create policy "auth update %1$s" on public.%1$s for update to authenticated using (true) with check (true);', t);
    execute format('create policy "auth delete %1$s" on public.%1$s for delete to authenticated using (true);', t);
  end loop;
end $$;

-- Block updates/deletes on append-only tables (overrides above for those tables)
drop policy "auth update item_history" on public.item_history;
drop policy "auth delete item_history" on public.item_history;
drop policy "auth update audit_log" on public.audit_log;
drop policy "auth delete audit_log" on public.audit_log;

-- =========================================================================
-- STORAGE BUCKETS
-- =========================================================================
insert into storage.buckets (id, name, public) values
  ('bill-images', 'bill-images', false),
  ('product-images', 'product-images', true),
  ('invoices', 'invoices', false)
  on conflict do nothing;

create policy "auth read bill-images" on storage.objects for select to authenticated
  using (bucket_id = 'bill-images');
create policy "auth write bill-images" on storage.objects for insert to authenticated
  with check (bucket_id = 'bill-images');

create policy "public read product-images" on storage.objects for select to public
  using (bucket_id = 'product-images');
create policy "auth write product-images" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images');
create policy "auth update product-images" on storage.objects for update to authenticated
  using (bucket_id = 'product-images');

create policy "auth read invoices" on storage.objects for select to authenticated
  using (bucket_id = 'invoices');
create policy "auth write invoices" on storage.objects for insert to authenticated
  with check (bucket_id = 'invoices');

-- =========================================================================
-- SEED: a default admin shop user with PIN 1234 (rename/change immediately)
-- =========================================================================
insert into public.shop_users(name, pin_hash, role)
  values ('Admin', public.hash_pin('1234'), 'admin')
  on conflict (name) do nothing;
