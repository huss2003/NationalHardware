-- Update existing PLY demo units (feet)
UPDATE public.item_instances SET length_value = 8, width_value = 4, dimension_unit = 'feet', area_sqft = 32 WHERE id = 'PLY-000001';
UPDATE public.item_instances SET length_value = 8, width_value = 4, dimension_unit = 'feet', area_sqft = 32 WHERE id = 'PLY-000002';
UPDATE public.item_instances SET length_value = 7, width_value = 4, dimension_unit = 'feet', area_sqft = 28 WHERE id = 'PLY-000003';

-- Update existing DOR demo units (inches)
UPDATE public.item_instances SET length_value = 84, width_value = 36, dimension_unit = 'inches', area_sqft = round((84*36)::numeric/144, 2) WHERE id = 'DOR-000001';
UPDATE public.item_instances SET length_value = 78, width_value = 32, dimension_unit = 'inches', area_sqft = round((78*32)::numeric/144, 2) WHERE id = 'DOR-000002';
UPDATE public.item_instances SET length_value = 84, width_value = 42, dimension_unit = 'inches', area_sqft = round((84*42)::numeric/144, 2) WHERE id = 'DOR-000003';

-- Add a couple more demo units with varied sizes (if the originals exist)
DO $$
DECLARE ply_pid uuid; dor_pid uuid;
BEGIN
  SELECT id INTO ply_pid FROM public.products WHERE prefix = 'PLY' LIMIT 1;
  SELECT id INTO dor_pid FROM public.products WHERE prefix = 'DOR' LIMIT 1;

  IF ply_pid IS NOT NULL THEN
    INSERT INTO public.item_instances(id, product_id, status, cost_price, barcode_payload, qr_payload, length_value, width_value, dimension_unit, area_sqft)
    VALUES
      (public.next_item_id('PLY'), ply_pid, 'available', 2800, 'placeholder', jsonb_build_object('status','available'), 6, 4, 'feet', 24),
      (public.next_item_id('PLY'), ply_pid, 'available', 2800, 'placeholder', jsonb_build_object('status','available'), 8, 3, 'feet', 24)
    ON CONFLICT DO NOTHING;
    UPDATE public.item_instances SET barcode_payload = id, qr_payload = jsonb_build_object('id', id, 'status','available')
      WHERE barcode_payload = 'placeholder';
  END IF;

  IF dor_pid IS NOT NULL THEN
    INSERT INTO public.item_instances(id, product_id, status, cost_price, barcode_payload, qr_payload, length_value, width_value, dimension_unit, area_sqft)
    VALUES
      (public.next_item_id('DOR'), dor_pid, 'available', 6200, 'placeholder2', jsonb_build_object('status','available'), 80, 30, 'inches', round((80*30)::numeric/144,2)),
      (public.next_item_id('DOR'), dor_pid, 'available', 6200, 'placeholder2', jsonb_build_object('status','available'), 84, 36, 'inches', 21)
    ON CONFLICT DO NOTHING;
    UPDATE public.item_instances SET barcode_payload = id, qr_payload = jsonb_build_object('id', id, 'status','available')
      WHERE barcode_payload = 'placeholder2';
  END IF;
END $$;