ALTER TABLE public.sales_ledger
  ADD COLUMN IF NOT EXISTS party_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS party_name text,
  ADD COLUMN IF NOT EXISTS seq integer NOT NULL DEFAULT 0;

ALTER TABLE public.purchase_ledger
  ADD COLUMN IF NOT EXISTS party_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS party_name text,
  ADD COLUMN IF NOT EXISTS seq integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS sales_ledger_party_id_idx ON public.sales_ledger(party_id);
CREATE INDEX IF NOT EXISTS purchase_ledger_party_id_idx ON public.purchase_ledger(party_id);