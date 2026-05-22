
-- Helper: grant full anon access to a table (mirrors existing public customers/products pattern)
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'sales','sales_items','sales_returns','sales_return_items',
    'purchases','purchase_items','purchase_returns','purchase_return_items',
    'receipts','godowns','suppliers','alerts','audit_log',
    'item_instances','item_history','recycle_bin','shop_users',
    'id_sequences','customer_receipt_seq'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "anon read %I" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "anon read %I" ON public.%I FOR SELECT TO anon USING (true)', t, t);

    EXECUTE format('DROP POLICY IF EXISTS "anon insert %I" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "anon insert %I" ON public.%I FOR INSERT TO anon WITH CHECK (true)', t, t);

    EXECUTE format('DROP POLICY IF EXISTS "anon update %I" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "anon update %I" ON public.%I FOR UPDATE TO anon USING (true) WITH CHECK (true)', t, t);

    EXECUTE format('DROP POLICY IF EXISTS "anon delete %I" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "anon delete %I" ON public.%I FOR DELETE TO anon USING (true)', t, t);
  END LOOP;
END $$;

-- App settings: read for everyone, no writes from anon (admin-only writes preserved)
DROP POLICY IF EXISTS "anon read app_settings" ON public.app_settings;
CREATE POLICY "anon read app_settings" ON public.app_settings FOR SELECT TO anon USING (true);
