-- Phase 1: performance indexes + helper RPCs
-- Safe: additive only, no data changes, no policy changes.

create extension if not exists pg_trgm;

-- sales / sales_items
create index if not exists idx_sales_customer_invoice_date
  on public.sales (customer_id, invoice_date desc) where deleted_at is null;
create index if not exists idx_sales_invoice_date
  on public.sales (invoice_date desc) where deleted_at is null;
create index if not exists idx_sales_invoice_no on public.sales (invoice_no);
create index if not exists idx_sales_items_sale on public.sales_items (sale_id);
create index if not exists idx_sales_items_product on public.sales_items (product_id);
create index if not exists idx_sales_items_instance on public.sales_items (item_instance_id);

-- purchases / purchase_items
create index if not exists idx_purchases_supplier_bill_date
  on public.purchases (supplier_id, bill_date desc) where deleted_at is null;
create index if not exists idx_purchases_bill_date
  on public.purchases (bill_date desc) where deleted_at is null;
create index if not exists idx_purchase_items_purchase on public.purchase_items (purchase_id);
create index if not exists idx_purchase_items_product on public.purchase_items (product_id);

-- receipts
create index if not exists idx_receipts_customer_created
  on public.receipts (customer_id, created_at desc);
create index if not exists idx_receipts_sale on public.receipts (sale_id);

-- item_instances (stock lookups)
create index if not exists idx_item_instances_product_status
  on public.item_instances (product_id, status);
create index if not exists idx_item_instances_available
  on public.item_instances (product_id) where status = 'available';
create index if not exists idx_item_instances_barcode
  on public.item_instances (barcode_payload);
create index if not exists idx_item_instances_godown on public.item_instances (godown_id);

-- item_history
create index if not exists idx_item_history_item_created
  on public.item_history (item_id, created_at desc);
create index if not exists idx_item_history_ref
  on public.item_history (ref_table, ref_id);

-- door
create index if not exists idx_door_orders_customer_date
  on public.door_orders (customer_name, order_date desc);
create index if not exists idx_door_orders_order_date
  on public.door_orders (order_date desc);
create index if not exists idx_door_order_items_order on public.door_order_items (order_id);

-- returns
create index if not exists idx_sales_returns_customer
  on public.sales_returns (customer_id, return_date desc) where deleted_at is null;
create index if not exists idx_sales_returns_sale on public.sales_returns (sale_id);
create index if not exists idx_sales_return_items_return on public.sales_return_items (return_id);
create index if not exists idx_purchase_returns_supplier
  on public.purchase_returns (supplier_id, return_date desc) where deleted_at is null;
create index if not exists idx_purchase_returns_purchase on public.purchase_returns (purchase_id);
create index if not exists idx_purchase_return_items_return on public.purchase_return_items (return_id);

-- audit / alerts
create index if not exists idx_audit_log_ref on public.audit_log (ref_table, ref_id);
create index if not exists idx_audit_log_created on public.audit_log (created_at desc);
create index if not exists idx_alerts_unread on public.alerts (created_at desc) where read_at is null;

-- text search (trigram for fast ILIKE %q%)
create index if not exists idx_products_name_trgm on public.products using gin (name gin_trgm_ops);
create index if not exists idx_products_sku_trgm on public.products using gin (sku gin_trgm_ops);
create index if not exists idx_customers_name_trgm on public.customers using gin (name gin_trgm_ops);
create index if not exists idx_customers_phone_trgm on public.customers using gin (phone gin_trgm_ops);
create index if not exists idx_suppliers_name_trgm on public.suppliers using gin (name gin_trgm_ops);

-- RPC 1: aggregate stock per product in one server-side query
create or replace function public.stock_by_product()
returns table (product_id uuid, available_qty bigint)
language sql
stable
security definer
set search_path = public
as $$
  select product_id, coalesce(sum(qty_on_hand), 0)::bigint as available_qty
  from public.item_instances
  where status = 'available'
  group by product_id
$$;
grant execute on function public.stock_by_product() to anon, authenticated;

-- RPC 2: dashboard summary (single round trip)
create or replace function public.dashboard_summary(_since timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  with
    sales_agg as (
      select
        coalesce(sum(grand_total), 0) as total,
        coalesce(sum(paid_amount), 0) as paid,
        count(*) as cnt
      from public.sales
      where deleted_at is null and invoice_date >= _since
    ),
    purchases_agg as (
      select coalesce(sum(grand_total), 0) as total, count(*) as cnt
      from public.purchases
      where deleted_at is null and created_at >= _since
    ),
    stock_value as (
      select coalesce(sum(cost_price * qty_on_hand), 0) as v
      from public.item_instances where status = 'available'
    ),
    production_agg as (
      select count(*) as cnt from public.production_orders where created_at >= _since
    ),
    low_stock as (
      select count(*) as cnt
      from public.products p
      left join (
        select product_id, sum(qty_on_hand) as q
        from public.item_instances where status='available' group by product_id
      ) s on s.product_id = p.id
      where p.active and coalesce(s.q,0) <= p.reorder_level
    ),
    unread_alerts as (
      select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at desc), '[]'::jsonb) as items
      from (
        select id, type, severity, payload, created_at
        from public.alerts where read_at is null
        order by created_at desc limit 5
      ) a
    ),
    daily as (
      select coalesce(jsonb_agg(jsonb_build_object('d', d, 'total', total) order by d), '[]'::jsonb) as series
      from (
        select date_trunc('day', invoice_date)::date as d, sum(grand_total) as total
        from public.sales
        where deleted_at is null and invoice_date >= _since
        group by 1 order by 1
      ) x
    )
  select jsonb_build_object(
    'sales', (select to_jsonb(sales_agg) from sales_agg),
    'purchases', (select to_jsonb(purchases_agg) from purchases_agg),
    'stock_value', (select v from stock_value),
    'production_count', (select cnt from production_agg),
    'low_stock_count', (select cnt from low_stock),
    'alerts', (select items from unread_alerts),
    'daily_sales', (select series from daily)
  ) into result;
  return result;
end;
$$;
grant execute on function public.dashboard_summary(timestamptz) to anon, authenticated;