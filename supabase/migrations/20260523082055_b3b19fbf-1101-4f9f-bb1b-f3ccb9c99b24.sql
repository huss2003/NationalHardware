INSERT INTO public.products (name, prefix, category, unit, gst_rate, default_price, active)
SELECT 'Door (Custom)', 'DOOR', 'door'::product_category, 'pcs', 18, 0, true
WHERE NOT EXISTS (SELECT 1 FROM public.products WHERE prefix = 'DOOR');

CREATE POLICY "anon write products"
ON public.products
FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "anon update products"
ON public.products
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);