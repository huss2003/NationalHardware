-- Recreate door_orders policies to also allow anon role (the app uses local PIN auth, not Supabase Auth)
DROP POLICY IF EXISTS "auth read door_orders" ON public.door_orders;
DROP POLICY IF EXISTS "auth write door_orders" ON public.door_orders;
DROP POLICY IF EXISTS "auth update door_orders" ON public.door_orders;
DROP POLICY IF EXISTS "auth delete door_orders" ON public.door_orders;

CREATE POLICY "public read door_orders" ON public.door_orders FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public write door_orders" ON public.door_orders FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "public update door_orders" ON public.door_orders FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public delete door_orders" ON public.door_orders FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth read door_order_items" ON public.door_order_items;
DROP POLICY IF EXISTS "auth write door_order_items" ON public.door_order_items;
DROP POLICY IF EXISTS "auth update door_order_items" ON public.door_order_items;
DROP POLICY IF EXISTS "auth delete door_order_items" ON public.door_order_items;

CREATE POLICY "public read door_order_items" ON public.door_order_items FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public write door_order_items" ON public.door_order_items FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "public update door_order_items" ON public.door_order_items FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public delete door_order_items" ON public.door_order_items FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth read door_types" ON public.door_types;
DROP POLICY IF EXISTS "auth write door_types" ON public.door_types;
DROP POLICY IF EXISTS "auth update door_types" ON public.door_types;
DROP POLICY IF EXISTS "auth delete door_types" ON public.door_types;

CREATE POLICY "public read door_types" ON public.door_types FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public write door_types" ON public.door_types FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "public update door_types" ON public.door_types FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public delete door_types" ON public.door_types FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth read customers" ON public.customers;
DROP POLICY IF EXISTS "auth write customers" ON public.customers;
DROP POLICY IF EXISTS "auth update customers" ON public.customers;
DROP POLICY IF EXISTS "auth delete customers" ON public.customers;

CREATE POLICY "public read customers" ON public.customers FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public write customers" ON public.customers FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "public update customers" ON public.customers FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public delete customers" ON public.customers FOR DELETE TO anon, authenticated USING (true);