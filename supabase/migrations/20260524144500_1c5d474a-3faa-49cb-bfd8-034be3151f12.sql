
-- =========================================================
-- 1. Drop ALL anon and public policies on business tables
-- =========================================================

-- alerts
DROP POLICY IF EXISTS "anon delete alerts" ON public.alerts;
DROP POLICY IF EXISTS "anon insert alerts" ON public.alerts;
DROP POLICY IF EXISTS "anon read alerts" ON public.alerts;
DROP POLICY IF EXISTS "anon update alerts" ON public.alerts;

-- app_settings
DROP POLICY IF EXISTS "anon read app_settings" ON public.app_settings;

-- audit_log
DROP POLICY IF EXISTS "anon delete audit_log" ON public.audit_log;
DROP POLICY IF EXISTS "anon insert audit_log" ON public.audit_log;
DROP POLICY IF EXISTS "anon read audit_log" ON public.audit_log;
DROP POLICY IF EXISTS "anon update audit_log" ON public.audit_log;

-- customer_receipt_seq
DROP POLICY IF EXISTS "anon delete customer_receipt_seq" ON public.customer_receipt_seq;
DROP POLICY IF EXISTS "anon insert customer_receipt_seq" ON public.customer_receipt_seq;
DROP POLICY IF EXISTS "anon read customer_receipt_seq" ON public.customer_receipt_seq;
DROP POLICY IF EXISTS "anon update customer_receipt_seq" ON public.customer_receipt_seq;

-- customers
DROP POLICY IF EXISTS "public delete customers" ON public.customers;
DROP POLICY IF EXISTS "public read customers" ON public.customers;
DROP POLICY IF EXISTS "public update customers" ON public.customers;
DROP POLICY IF EXISTS "public write customers" ON public.customers;
CREATE POLICY "auth read customers" ON public.customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write customers" ON public.customers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update customers" ON public.customers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete customers" ON public.customers FOR DELETE TO authenticated USING (true);

-- door_order_items
DROP POLICY IF EXISTS "public delete door_order_items" ON public.door_order_items;
DROP POLICY IF EXISTS "public read door_order_items" ON public.door_order_items;
DROP POLICY IF EXISTS "public update door_order_items" ON public.door_order_items;
DROP POLICY IF EXISTS "public write door_order_items" ON public.door_order_items;
CREATE POLICY "auth read door_order_items" ON public.door_order_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write door_order_items" ON public.door_order_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update door_order_items" ON public.door_order_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete door_order_items" ON public.door_order_items FOR DELETE TO authenticated USING (true);

-- door_orders
DROP POLICY IF EXISTS "public delete door_orders" ON public.door_orders;
DROP POLICY IF EXISTS "public read door_orders" ON public.door_orders;
DROP POLICY IF EXISTS "public update door_orders" ON public.door_orders;
DROP POLICY IF EXISTS "public write door_orders" ON public.door_orders;
CREATE POLICY "auth read door_orders" ON public.door_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write door_orders" ON public.door_orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update door_orders" ON public.door_orders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete door_orders" ON public.door_orders FOR DELETE TO authenticated USING (true);

-- door_types
DROP POLICY IF EXISTS "public delete door_types" ON public.door_types;
DROP POLICY IF EXISTS "public read door_types" ON public.door_types;
DROP POLICY IF EXISTS "public update door_types" ON public.door_types;
DROP POLICY IF EXISTS "public write door_types" ON public.door_types;
CREATE POLICY "auth read door_types" ON public.door_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write door_types" ON public.door_types FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update door_types" ON public.door_types FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete door_types" ON public.door_types FOR DELETE TO authenticated USING (true);

-- godowns
DROP POLICY IF EXISTS "anon delete godowns" ON public.godowns;
DROP POLICY IF EXISTS "anon insert godowns" ON public.godowns;
DROP POLICY IF EXISTS "anon read godowns" ON public.godowns;
DROP POLICY IF EXISTS "anon update godowns" ON public.godowns;

-- id_sequences
DROP POLICY IF EXISTS "anon delete id_sequences" ON public.id_sequences;
DROP POLICY IF EXISTS "anon insert id_sequences" ON public.id_sequences;
DROP POLICY IF EXISTS "anon read id_sequences" ON public.id_sequences;
DROP POLICY IF EXISTS "anon update id_sequences" ON public.id_sequences;

-- item_history
DROP POLICY IF EXISTS "anon delete item_history" ON public.item_history;
DROP POLICY IF EXISTS "anon insert item_history" ON public.item_history;
DROP POLICY IF EXISTS "anon read item_history" ON public.item_history;
DROP POLICY IF EXISTS "anon update item_history" ON public.item_history;
DROP POLICY IF EXISTS "public read item_history" ON public.item_history;

-- item_instances
DROP POLICY IF EXISTS "anon delete item_instances" ON public.item_instances;
DROP POLICY IF EXISTS "anon insert item_instances" ON public.item_instances;
DROP POLICY IF EXISTS "anon read item_instances" ON public.item_instances;
DROP POLICY IF EXISTS "anon update item_instances" ON public.item_instances;
DROP POLICY IF EXISTS "public read item_instances" ON public.item_instances;

-- products
DROP POLICY IF EXISTS "anon update products" ON public.products;
DROP POLICY IF EXISTS "anon write products" ON public.products;
DROP POLICY IF EXISTS "public read products" ON public.products;
CREATE POLICY "auth read products" ON public.products FOR SELECT TO authenticated USING (true);

-- purchase_items
DROP POLICY IF EXISTS "anon delete purchase_items" ON public.purchase_items;
DROP POLICY IF EXISTS "anon insert purchase_items" ON public.purchase_items;
DROP POLICY IF EXISTS "anon read purchase_items" ON public.purchase_items;
DROP POLICY IF EXISTS "anon update purchase_items" ON public.purchase_items;

-- purchase_return_items
DROP POLICY IF EXISTS "anon delete purchase_return_items" ON public.purchase_return_items;
DROP POLICY IF EXISTS "anon insert purchase_return_items" ON public.purchase_return_items;
DROP POLICY IF EXISTS "anon read purchase_return_items" ON public.purchase_return_items;
DROP POLICY IF EXISTS "anon update purchase_return_items" ON public.purchase_return_items;

-- purchase_returns
DROP POLICY IF EXISTS "anon delete purchase_returns" ON public.purchase_returns;
DROP POLICY IF EXISTS "anon insert purchase_returns" ON public.purchase_returns;
DROP POLICY IF EXISTS "anon read purchase_returns" ON public.purchase_returns;
DROP POLICY IF EXISTS "anon update purchase_returns" ON public.purchase_returns;

-- purchases
DROP POLICY IF EXISTS "anon delete purchases" ON public.purchases;
DROP POLICY IF EXISTS "anon insert purchases" ON public.purchases;
DROP POLICY IF EXISTS "anon read purchases" ON public.purchases;
DROP POLICY IF EXISTS "anon update purchases" ON public.purchases;

-- receipts
DROP POLICY IF EXISTS "anon delete receipts" ON public.receipts;
DROP POLICY IF EXISTS "anon insert receipts" ON public.receipts;
DROP POLICY IF EXISTS "anon read receipts" ON public.receipts;
DROP POLICY IF EXISTS "anon update receipts" ON public.receipts;

-- recycle_bin
DROP POLICY IF EXISTS "anon delete recycle_bin" ON public.recycle_bin;
DROP POLICY IF EXISTS "anon insert recycle_bin" ON public.recycle_bin;
DROP POLICY IF EXISTS "anon read recycle_bin" ON public.recycle_bin;
DROP POLICY IF EXISTS "anon update recycle_bin" ON public.recycle_bin;

-- sales
DROP POLICY IF EXISTS "anon delete sales" ON public.sales;
DROP POLICY IF EXISTS "anon insert sales" ON public.sales;
DROP POLICY IF EXISTS "anon read sales" ON public.sales;
DROP POLICY IF EXISTS "anon update sales" ON public.sales;

-- sales_items
DROP POLICY IF EXISTS "anon delete sales_items" ON public.sales_items;
DROP POLICY IF EXISTS "anon insert sales_items" ON public.sales_items;
DROP POLICY IF EXISTS "anon read sales_items" ON public.sales_items;
DROP POLICY IF EXISTS "anon update sales_items" ON public.sales_items;

-- sales_return_items
DROP POLICY IF EXISTS "anon delete sales_return_items" ON public.sales_return_items;
DROP POLICY IF EXISTS "anon insert sales_return_items" ON public.sales_return_items;
DROP POLICY IF EXISTS "anon read sales_return_items" ON public.sales_return_items;
DROP POLICY IF EXISTS "anon update sales_return_items" ON public.sales_return_items;

-- sales_returns
DROP POLICY IF EXISTS "anon delete sales_returns" ON public.sales_returns;
DROP POLICY IF EXISTS "anon insert sales_returns" ON public.sales_returns;
DROP POLICY IF EXISTS "anon read sales_returns" ON public.sales_returns;
DROP POLICY IF EXISTS "anon update sales_returns" ON public.sales_returns;

-- shop_users
DROP POLICY IF EXISTS "anon delete shop_users" ON public.shop_users;
DROP POLICY IF EXISTS "anon insert shop_users" ON public.shop_users;
DROP POLICY IF EXISTS "anon read shop_users" ON public.shop_users;
DROP POLICY IF EXISTS "anon update shop_users" ON public.shop_users;

-- suppliers
DROP POLICY IF EXISTS "anon delete suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "anon insert suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "anon read suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "anon update suppliers" ON public.suppliers;

-- =========================================================
-- 2. Move pg_trgm from public to extensions schema
-- =========================================================
CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION pg_trgm SET SCHEMA extensions;
