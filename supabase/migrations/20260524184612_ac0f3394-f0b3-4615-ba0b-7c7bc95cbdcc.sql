-- Create product_subcategories table
CREATE TABLE public.product_subcategories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category product_category NOT NULL,
  name text NOT NULL,
  dimension_label text,
  default_price_per_sqft numeric,
  default_price_per_pc numeric,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX product_subcategories_cat_name_uniq
  ON public.product_subcategories (category, lower(name));

ALTER TABLE public.product_subcategories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read product_subcategories" ON public.product_subcategories
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write product_subcategories" ON public.product_subcategories
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update product_subcategories" ON public.product_subcategories
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete product_subcategories" ON public.product_subcategories
  FOR DELETE TO authenticated USING (true);

CREATE TRIGGER set_updated_at_product_subcategories
  BEFORE UPDATE ON public.product_subcategories
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Add subcategory_id to products
ALTER TABLE public.products
  ADD COLUMN subcategory_id uuid REFERENCES public.product_subcategories(id) ON DELETE SET NULL;

CREATE INDEX products_subcategory_id_idx ON public.products(subcategory_id);
