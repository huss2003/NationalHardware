DROP POLICY IF EXISTS "auth read products" ON public.products;
CREATE POLICY "public read products" ON public.products FOR SELECT TO anon, authenticated USING (true);