CREATE TABLE public.cash_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  txn_date date NOT NULL,
  txn_type text NOT NULL,
  vch_no text,
  account_name text NOT NULL DEFAULT '',
  debit numeric NOT NULL DEFAULT 0,
  credit numeric NOT NULL DEFAULT 0,
  narration text,
  source text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_transactions TO authenticated;
GRANT ALL ON public.cash_transactions TO service_role;

ALTER TABLE public.cash_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read cash_transactions" ON public.cash_transactions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write cash_transactions" ON public.cash_transactions
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update cash_transactions" ON public.cash_transactions
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete cash_transactions" ON public.cash_transactions
  FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_cash_transactions_date ON public.cash_transactions (txn_date);

CREATE TRIGGER set_cash_transactions_updated_at
  BEFORE UPDATE ON public.cash_transactions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();