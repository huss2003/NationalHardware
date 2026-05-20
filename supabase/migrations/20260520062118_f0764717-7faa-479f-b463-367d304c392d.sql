-- Set shop branding to "National Hardware and Plywood" across the app.
INSERT INTO public.app_settings (id, shop_name, address, gstin, state, invoice_prefix)
VALUES (true, 'National Hardware and Plywood', 'Main Road, Bengaluru, Karnataka 560001', '29ABCDE1234F1Z5', 'KA', 'NHP')
ON CONFLICT (id) DO UPDATE SET
  shop_name = EXCLUDED.shop_name,
  address = COALESCE(public.app_settings.address, EXCLUDED.address),
  gstin = COALESCE(public.app_settings.gstin, EXCLUDED.gstin),
  state = COALESCE(public.app_settings.state, EXCLUDED.state),
  invoice_prefix = COALESCE(NULLIF(public.app_settings.invoice_prefix,'INV'), EXCLUDED.invoice_prefix),
  updated_at = now();
