
-- Drop all "anon all" RLS policies on application tables
DROP POLICY IF EXISTS "anon all alerts" ON public.alerts;
DROP POLICY IF EXISTS "anon all app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "anon all audit_log" ON public.audit_log;
DROP POLICY IF EXISTS "anon all bom" ON public.bom;
DROP POLICY IF EXISTS "anon all bom_items" ON public.bom_items;
DROP POLICY IF EXISTS "anon all customer_receipt_seq" ON public.customer_receipt_seq;
DROP POLICY IF EXISTS "anon all customers" ON public.customers;
DROP POLICY IF EXISTS "anon all door_orders" ON public.door_orders;
DROP POLICY IF EXISTS "anon all door_types" ON public.door_types;
DROP POLICY IF EXISTS "anon all godowns" ON public.godowns;
DROP POLICY IF EXISTS "anon all id_sequences" ON public.id_sequences;
DROP POLICY IF EXISTS "anon all item_history" ON public.item_history;
DROP POLICY IF EXISTS "anon all item_instances" ON public.item_instances;
DROP POLICY IF EXISTS "anon all produced_items" ON public.produced_items;
DROP POLICY IF EXISTS "anon all production_materials" ON public.production_materials;
DROP POLICY IF EXISTS "anon all production_orders" ON public.production_orders;
DROP POLICY IF EXISTS "anon all products" ON public.products;
DROP POLICY IF EXISTS "anon all profiles" ON public.profiles;
DROP POLICY IF EXISTS "anon all purchase_items" ON public.purchase_items;
DROP POLICY IF EXISTS "anon all purchase_return_items" ON public.purchase_return_items;
DROP POLICY IF EXISTS "anon all purchase_returns" ON public.purchase_returns;
DROP POLICY IF EXISTS "anon all purchases" ON public.purchases;
DROP POLICY IF EXISTS "anon all receipts" ON public.receipts;
DROP POLICY IF EXISTS "anon all recycle_bin" ON public.recycle_bin;
DROP POLICY IF EXISTS "anon all sales" ON public.sales;
DROP POLICY IF EXISTS "anon all sales_items" ON public.sales_items;
DROP POLICY IF EXISTS "anon all sales_return_items" ON public.sales_return_items;
DROP POLICY IF EXISTS "anon all sales_returns" ON public.sales_returns;
DROP POLICY IF EXISTS "anon all shop_users" ON public.shop_users;
DROP POLICY IF EXISTS "anon all suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "anon all user_roles" ON public.user_roles;

-- Drop anon storage policies for private buckets
DROP POLICY IF EXISTS "anon all bill-images" ON storage.objects;
DROP POLICY IF EXISTS "anon all invoices" ON storage.objects;
