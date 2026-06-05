CREATE OR REPLACE FUNCTION public.import_sheet_bills(_rows jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tx jsonb;
  it jsonb;
  v_kind text;
  v_party text;
  v_vch text;
  v_date date;
  v_amt numeric;
  v_note text;
  v_party_id uuid;
  v_main_id uuid;
  v_pid uuid;
  v_iname text;
  v_qty int;
  v_rate numeric;
  v_lt numeric;
  v_inv text;
  v_try int;
  is_customer boolean;
BEGIN
  FOR tx IN SELECT * FROM jsonb_array_elements(_rows) LOOP
    v_kind := tx->>'kind';
    v_party := btrim(coalesce(tx->>'party',''));
    v_vch := tx->>'vch_no';
    v_date := (tx->>'date')::date;
    v_amt := coalesce((tx->>'amount')::numeric, 0);
    v_note := tx->>'note';
    is_customer := v_kind IN ('sale','sale_journal','sales_return');

    IF is_customer THEN
      SELECT id INTO v_party_id FROM customers WHERE lower(btrim(name)) = lower(v_party) LIMIT 1;
      IF v_party_id IS NULL THEN
        INSERT INTO customers(name) VALUES (v_party) RETURNING id INTO v_party_id;
      END IF;
    ELSE
      SELECT id INTO v_party_id FROM suppliers WHERE lower(btrim(name)) = lower(v_party) LIMIT 1;
      IF v_party_id IS NULL THEN
        INSERT INTO suppliers(name) VALUES (v_party) RETURNING id INTO v_party_id;
      END IF;
    END IF;

    IF v_kind IN ('sale','sale_journal') THEN
      v_inv := '2526/' || v_vch;
      v_try := 1;
      WHILE EXISTS (SELECT 1 FROM sales WHERE invoice_no = v_inv) LOOP
        v_try := v_try + 1;
        v_inv := '2526/' || v_vch || '-' || v_try;
      END LOOP;
      INSERT INTO sales(invoice_no, customer_id, invoice_date, subtotal, grand_total, payment_mode, paid_amount, notes)
        VALUES (v_inv, v_party_id, v_date::timestamptz, v_amt, v_amt, 'cash', 0, v_note)
        RETURNING id INTO v_main_id;
    ELSIF v_kind = 'sales_return' THEN
      INSERT INTO sales_returns(customer_id, return_no, return_date, subtotal, tax_total, grand_total, refund_amount, refund_mode, status, reason, notes)
        VALUES (v_party_id, '2526/' || v_vch, v_date::timestamptz, v_amt, 0, v_amt, 0, 'credit_note', 'completed', v_note, v_note)
        RETURNING id INTO v_main_id;
    ELSIF v_kind IN ('purchase','purchase_journal') THEN
      INSERT INTO purchases(supplier_id, bill_no, bill_date, subtotal, tax_total, grand_total, notes)
        VALUES (v_party_id, '2526/' || v_vch, v_date, v_amt, 0, v_amt, v_note)
        RETURNING id INTO v_main_id;
    ELSIF v_kind = 'debit_note' THEN
      INSERT INTO purchase_returns(supplier_id, return_no, return_date, subtotal, tax_total, grand_total, status, reason, notes)
        VALUES (v_party_id, '2526/' || v_vch, v_date::timestamptz, v_amt, 0, v_amt, 'sent', v_note, v_note)
        RETURNING id INTO v_main_id;
    ELSE
      CONTINUE;
    END IF;

    IF tx ? 'items' AND jsonb_typeof(tx->'items') = 'array' THEN
      FOR it IN SELECT * FROM jsonb_array_elements(tx->'items') LOOP
        v_iname := btrim(coalesce(it->>'name',''));
        IF v_iname = '' THEN v_iname := 'Misc Charge'; END IF;
        v_qty := greatest(1, round(coalesce((it->>'qty')::numeric, 1)))::int;
        v_rate := coalesce((it->>'rate')::numeric, 0);
        v_lt := coalesce((it->>'line_total')::numeric, 0);

        SELECT id INTO v_pid FROM products WHERE lower(btrim(name)) = lower(v_iname) LIMIT 1;
        IF v_pid IS NULL THEN
          INSERT INTO products(name, prefix, category, unit, gst_rate)
            VALUES (v_iname, 'IMP', 'other', coalesce(nullif(btrim(it->>'unit'),''),'pcs'), 0)
            RETURNING id INTO v_pid;
        END IF;

        IF v_kind IN ('sale','sale_journal') THEN
          INSERT INTO sales_items(sale_id, product_id, qty, rate, gst_rate, line_total)
            VALUES (v_main_id, v_pid, v_qty, v_rate, 0, v_lt);
        ELSIF v_kind = 'sales_return' THEN
          INSERT INTO sales_return_items(return_id, product_id, qty, rate, gst_rate, line_total)
            VALUES (v_main_id, v_pid, v_qty, v_rate, 0, v_lt);
        ELSIF v_kind IN ('purchase','purchase_journal') THEN
          INSERT INTO purchase_items(purchase_id, product_id, qty, rate, gst_rate, line_total)
            VALUES (v_main_id, v_pid, v_qty, v_rate, 0, v_lt);
        ELSIF v_kind = 'debit_note' THEN
          INSERT INTO purchase_return_items(return_id, product_id, qty, rate, gst_rate, line_total)
            VALUES (v_main_id, v_pid, v_qty, v_rate, 0, v_lt);
        END IF;
      END LOOP;
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.import_sheet_bills(jsonb) TO anon, authenticated, service_role;