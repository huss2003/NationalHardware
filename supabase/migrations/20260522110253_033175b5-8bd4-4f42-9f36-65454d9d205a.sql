
CREATE TABLE public.door_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.door_orders(id) ON DELETE CASCADE,
  party_door_size text,
  front_mica text,
  back_mica text,
  door_taken_size text,
  door_type_id uuid,
  door_type_name text,
  door_made text,
  qty integer NOT NULL DEFAULT 1,
  party_sqft numeric NOT NULL DEFAULT 0,
  taken_sqft numeric NOT NULL DEFAULT 0,
  billable_sqft numeric NOT NULL DEFAULT 0,
  rate_per_sqft numeric NOT NULL DEFAULT 0,
  line_total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_door_order_items_order_id ON public.door_order_items(order_id);

ALTER TABLE public.door_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read door_order_items" ON public.door_order_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write door_order_items" ON public.door_order_items
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update door_order_items" ON public.door_order_items
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete door_order_items" ON public.door_order_items
  FOR DELETE TO authenticated USING (true);

-- Ensure standard door types exist (name is not unique today; guard with NOT EXISTS)
INSERT INTO public.door_types (name, rate, active)
SELECT v.name, 0, true
FROM (VALUES ('F-Hard'), ('F-Pine'), ('WF-Pine'), ('WF-Hard')) AS v(name)
WHERE NOT EXISTS (
  SELECT 1 FROM public.door_types dt WHERE dt.name = v.name
);
