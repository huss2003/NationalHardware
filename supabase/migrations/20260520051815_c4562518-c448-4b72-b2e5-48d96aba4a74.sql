
-- Alternate unit on products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS alt_unit text,
  ADD COLUMN IF NOT EXISTS alt_conversion numeric;

-- Per-customer receipt sequence
CREATE TABLE IF NOT EXISTS public.customer_receipt_seq (
  customer_id uuid PRIMARY KEY,
  next_value bigint NOT NULL DEFAULT 1
);
ALTER TABLE public.customer_receipt_seq ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon all customer_receipt_seq" ON public.customer_receipt_seq FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "auth all customer_receipt_seq" ON public.customer_receipt_seq FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.next_receipt_no(_customer_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare v bigint;
begin
  insert into public.customer_receipt_seq(customer_id, next_value) values (_customer_id, 1)
    on conflict (customer_id) do nothing;
  update public.customer_receipt_seq set next_value = next_value + 1
    where customer_id = _customer_id returning next_value - 1 into v;
  return lpad(v::text, 3, '0');
end $$;

-- Receipts table
CREATE TABLE IF NOT EXISTS public.receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_no text NOT NULL,
  customer_id uuid NOT NULL,
  receipt_type text NOT NULL DEFAULT 'credit', -- 'credit' | 'general'
  sale_id uuid,
  amount numeric NOT NULL DEFAULT 0,
  mode text NOT NULL DEFAULT 'cash',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_receipts_customer ON public.receipts(customer_id);
CREATE INDEX IF NOT EXISTS idx_receipts_sale ON public.receipts(sale_id);

ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon all receipts" ON public.receipts FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "auth read receipts" ON public.receipts FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write receipts" ON public.receipts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update receipts" ON public.receipts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete receipts" ON public.receipts FOR DELETE TO authenticated USING (true);

CREATE TRIGGER trg_receipts_updated_at BEFORE UPDATE ON public.receipts
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
