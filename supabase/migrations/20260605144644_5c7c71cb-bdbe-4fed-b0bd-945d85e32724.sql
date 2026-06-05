ALTER TABLE public.cash_transactions
  ADD COLUMN IF NOT EXISTS ledger_account text NOT NULL DEFAULT 'cash';

DELETE FROM public.cash_transactions WHERE txn_date <= DATE '2026-03-31';

TRUNCATE public.sales_ledger;
TRUNCATE public.purchase_ledger;