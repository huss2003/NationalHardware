ALTER TABLE public.door_order_items ADD COLUMN IF NOT EXISTS mica_addon numeric NOT NULL DEFAULT 0;
INSERT INTO public.door_types (name, rate, active)
SELECT v.name, 0, true FROM (VALUES ('F-Hard'),('F-Pine'),('WF-Pine'),('WF-Hard')) AS v(name)
WHERE NOT EXISTS (SELECT 1 FROM public.door_types dt WHERE dt.name = v.name);