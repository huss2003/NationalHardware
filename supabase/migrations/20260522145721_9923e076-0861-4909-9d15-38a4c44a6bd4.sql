
-- Resync id_sequences to max(existing id suffix) + 1 per prefix
DO $$
DECLARE
  p RECORD;
  max_v BIGINT;
BEGIN
  FOR p IN SELECT DISTINCT prefix FROM public.products WHERE active = true LOOP
    SELECT COALESCE(MAX(NULLIF(regexp_replace(id, '^.*-', ''), '')::bigint), 0) + 1
      INTO max_v
      FROM public.item_instances
      WHERE id LIKE p.prefix || '-%';
    INSERT INTO public.id_sequences(prefix, next_value) VALUES (p.prefix, max_v)
      ON CONFLICT (prefix) DO UPDATE SET next_value = GREATEST(public.id_sequences.next_value, EXCLUDED.next_value);
  END LOOP;
END $$;

DO $$
DECLARE
  p RECORD;
  i INT;
  new_id TEXT;
  qr JSONB;
  next_v BIGINT;
BEGIN
  FOR p IN SELECT id, name, prefix, category, default_cost FROM public.products WHERE active = true LOOP
    IF p.category = 'hardware' THEN
      UPDATE public.id_sequences SET next_value = next_value + 1 WHERE prefix = p.prefix RETURNING next_value - 1 INTO next_v;
      new_id := p.prefix || '-' || lpad(next_v::text, 6, '0');
      qr := jsonb_build_object('id', new_id, 'name', p.name, 'date', current_date, 'status', 'available', 'lot', true);
      INSERT INTO public.item_instances(id, product_id, status, cost_price, barcode_payload, qr_payload, is_lot, qty_on_hand)
      VALUES (new_id, p.id, 'available', p.default_cost, new_id, qr, true, 10);
    ELSE
      FOR i IN 1..10 LOOP
        UPDATE public.id_sequences SET next_value = next_value + 1 WHERE prefix = p.prefix RETURNING next_value - 1 INTO next_v;
        new_id := p.prefix || '-' || lpad(next_v::text, 6, '0');
        qr := jsonb_build_object('id', new_id, 'name', p.name, 'date', current_date, 'status', 'available');
        INSERT INTO public.item_instances(id, product_id, status, cost_price, barcode_payload, qr_payload, is_lot, qty_on_hand)
        VALUES (new_id, p.id, 'available', p.default_cost, new_id, qr, false, 1);
      END LOOP;
    END IF;
  END LOOP;
END $$;
