-- Sales ledger (account ledger of the "Sales" account, imported as-is)
CREATE TABLE public.sales_ledger (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  txn_date date NOT NULL,
  txn_type text NOT NULL,
  vch_no text,
  account_name text NOT NULL DEFAULT ''::text,
  debit numeric NOT NULL DEFAULT 0,
  credit numeric NOT NULL DEFAULT 0,
  narration text,
  source text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_ledger TO authenticated;
GRANT ALL ON public.sales_ledger TO service_role;
ALTER TABLE public.sales_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read sales_ledger" ON public.sales_ledger FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert sales_ledger" ON public.sales_ledger FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update sales_ledger" ON public.sales_ledger FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete sales_ledger" ON public.sales_ledger FOR DELETE TO authenticated USING (true);
CREATE INDEX idx_sales_ledger_date ON public.sales_ledger (txn_date);
CREATE TRIGGER set_sales_ledger_updated_at BEFORE UPDATE ON public.sales_ledger FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Purchase ledger (account ledger of the "Purchase" account, imported as-is)
CREATE TABLE public.purchase_ledger (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  txn_date date NOT NULL,
  txn_type text NOT NULL,
  vch_no text,
  account_name text NOT NULL DEFAULT ''::text,
  debit numeric NOT NULL DEFAULT 0,
  credit numeric NOT NULL DEFAULT 0,
  narration text,
  source text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_ledger TO authenticated;
GRANT ALL ON public.purchase_ledger TO service_role;
ALTER TABLE public.purchase_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read purchase_ledger" ON public.purchase_ledger FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert purchase_ledger" ON public.purchase_ledger FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update purchase_ledger" ON public.purchase_ledger FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete purchase_ledger" ON public.purchase_ledger FOR DELETE TO authenticated USING (true);
CREATE INDEX idx_purchase_ledger_date ON public.purchase_ledger (txn_date);
CREATE TRIGGER set_purchase_ledger_updated_at BEFORE UPDATE ON public.purchase_ledger FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();