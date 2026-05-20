
-- =========================================
-- Sales Returns
-- =========================================
CREATE TABLE IF NOT EXISTS public.sales_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  return_no text,
  return_date timestamptz NOT NULL DEFAULT now(),
  reason text,
  subtotal numeric NOT NULL DEFAULT 0,
  tax_total numeric NOT NULL DEFAULT 0,
  grand_total numeric NOT NULL DEFAULT 0,
  refund_amount numeric NOT NULL DEFAULT 0,
  refund_mode text NOT NULL DEFAULT 'cash',
  status text NOT NULL DEFAULT 'completed',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.sales_return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES public.sales_returns(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  item_instance_id text,
  qty integer NOT NULL DEFAULT 1,
  rate numeric NOT NULL DEFAULT 0,
  gst_rate numeric NOT NULL DEFAULT 0,
  line_total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sales_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_return_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon all sales_returns" ON public.sales_returns FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "auth read sales_returns" ON public.sales_returns FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write sales_returns" ON public.sales_returns FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update sales_returns" ON public.sales_returns FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete sales_returns" ON public.sales_returns FOR DELETE TO authenticated USING (true);

CREATE POLICY "anon all sales_return_items" ON public.sales_return_items FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "auth read sales_return_items" ON public.sales_return_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write sales_return_items" ON public.sales_return_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update sales_return_items" ON public.sales_return_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete sales_return_items" ON public.sales_return_items FOR DELETE TO authenticated USING (true);

-- =========================================
-- Purchase Returns
-- =========================================
CREATE TABLE IF NOT EXISTS public.purchase_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid REFERENCES public.purchases(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  return_no text,
  return_date timestamptz NOT NULL DEFAULT now(),
  reason text,
  subtotal numeric NOT NULL DEFAULT 0,
  tax_total numeric NOT NULL DEFAULT 0,
  grand_total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'sent',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.purchase_return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES public.purchase_returns(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  item_instance_id text,
  qty integer NOT NULL DEFAULT 1,
  rate numeric NOT NULL DEFAULT 0,
  gst_rate numeric NOT NULL DEFAULT 0,
  line_total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.purchase_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_return_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon all purchase_returns" ON public.purchase_returns FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "auth read purchase_returns" ON public.purchase_returns FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write purchase_returns" ON public.purchase_returns FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update purchase_returns" ON public.purchase_returns FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete purchase_returns" ON public.purchase_returns FOR DELETE TO authenticated USING (true);

CREATE POLICY "anon all purchase_return_items" ON public.purchase_return_items FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "auth read purchase_return_items" ON public.purchase_return_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write purchase_return_items" ON public.purchase_return_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update purchase_return_items" ON public.purchase_return_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete purchase_return_items" ON public.purchase_return_items FOR DELETE TO authenticated USING (true);

-- =========================================
-- Godowns (storage locations)
-- =========================================
CREATE TABLE IF NOT EXISTS public.godowns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE,
  address text,
  manager_name text,
  phone text,
  capacity integer,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.godowns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon all godowns" ON public.godowns FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "auth read godowns" ON public.godowns FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write godowns" ON public.godowns FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update godowns" ON public.godowns FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete godowns" ON public.godowns FOR DELETE TO authenticated USING (true);

-- Link stock units to a godown
ALTER TABLE public.item_instances
  ADD COLUMN IF NOT EXISTS godown_id uuid REFERENCES public.godowns(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_item_instances_godown ON public.item_instances(godown_id);
CREATE INDEX IF NOT EXISTS idx_sales_returns_sale ON public.sales_returns(sale_id);
CREATE INDEX IF NOT EXISTS idx_purchase_returns_purchase ON public.purchase_returns(purchase_id);

-- Seed a default "Main Godown" so units have a home
INSERT INTO public.godowns (name, code, address, active)
SELECT 'Main Godown', 'MAIN', 'Primary storage', true
WHERE NOT EXISTS (SELECT 1 FROM public.godowns);
