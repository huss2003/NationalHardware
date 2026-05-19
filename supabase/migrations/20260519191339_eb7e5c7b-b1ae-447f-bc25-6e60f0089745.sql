ALTER TABLE public.item_instances
  ADD COLUMN IF NOT EXISTS length_value numeric,
  ADD COLUMN IF NOT EXISTS width_value numeric,
  ADD COLUMN IF NOT EXISTS dimension_unit text,
  ADD COLUMN IF NOT EXISTS area_sqft numeric;