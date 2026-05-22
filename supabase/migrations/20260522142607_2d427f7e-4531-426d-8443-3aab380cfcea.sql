-- Drop production / BOM module entirely
DROP FUNCTION IF EXISTS public.consume_material(uuid, text, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.complete_production(uuid, uuid) CASCADE;

DROP TABLE IF EXISTS public.produced_items CASCADE;
DROP TABLE IF EXISTS public.production_materials CASCADE;
DROP TABLE IF EXISTS public.production_orders CASCADE;
DROP TABLE IF EXISTS public.bom_items CASCADE;
DROP TABLE IF EXISTS public.bom CASCADE;