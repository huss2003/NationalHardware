ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS item_group text,
  ADD COLUMN IF NOT EXISTS finish text;

CREATE INDEX IF NOT EXISTS idx_products_item_group ON public.products (item_group);