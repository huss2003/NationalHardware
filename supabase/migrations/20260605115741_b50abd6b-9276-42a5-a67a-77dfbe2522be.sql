CREATE TABLE public.supplier_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  payment_no text,
  payment_date timestamp with time zone NOT NULL DEFAULT now(),
  amount numeric NOT NULL DEFAULT 0,
  mode text NOT NULL DEFAULT 'cash',
  notes text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_payments TO authenticated;
GRANT ALL ON public.supplier_payments TO service_role;

ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read supplier_payments" ON public.supplier_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write supplier_payments" ON public.supplier_payments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update supplier_payments" ON public.supplier_payments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete supplier_payments" ON public.supplier_payments FOR DELETE TO authenticated USING (true);

CREATE TRIGGER set_supplier_payments_updated_at
  BEFORE UPDATE ON public.supplier_payments
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX idx_supplier_payments_supplier ON public.supplier_payments(supplier_id);