-- Sample inventory units for demo
INSERT INTO public.item_instances (id, product_id, status, cost_price, barcode_payload, qr_payload, is_lot, qty_on_hand)
VALUES
  ('DEMO-000001', 'cf0ea56e-0e08-44a9-9fe5-58ded619e88f', 'available', 100,  'DEMO-000001', jsonb_build_object('id','DEMO-000001','name','Demo Widget'), false, 1),
  ('DEMO-000002', 'cf0ea56e-0e08-44a9-9fe5-58ded619e88f', 'available', 100,  'DEMO-000002', jsonb_build_object('id','DEMO-000002','name','Demo Widget'), false, 1),
  ('DEMO-000003', 'cf0ea56e-0e08-44a9-9fe5-58ded619e88f', 'available', 100,  'DEMO-000003', jsonb_build_object('id','DEMO-000003','name','Demo Widget'), false, 1),
  ('PLY-000001',  'b7ae2759-e4f8-4a7c-89cb-082fd8a2a136', 'available', 2200, 'PLY-000001',  jsonb_build_object('id','PLY-000001','name','Marine Plywood 19mm'),  false, 1),
  ('PLY-000002',  'b7ae2759-e4f8-4a7c-89cb-082fd8a2a136', 'available', 2200, 'PLY-000002',  jsonb_build_object('id','PLY-000002','name','Marine Plywood 19mm'),  false, 1),
  ('PLY-000003',  'b7ae2759-e4f8-4a7c-89cb-082fd8a2a136', 'available', 2200, 'PLY-000003',  jsonb_build_object('id','PLY-000003','name','Marine Plywood 19mm'),  false, 1),
  ('PLY-000004',  'b7ae2759-e4f8-4a7c-89cb-082fd8a2a136', 'available', 2200, 'PLY-000004',  jsonb_build_object('id','PLY-000004','name','Marine Plywood 19mm'),  false, 1),
  ('PLY-000005',  'b7ae2759-e4f8-4a7c-89cb-082fd8a2a136', 'available', 2200, 'PLY-000005',  jsonb_build_object('id','PLY-000005','name','Marine Plywood 19mm'),  false, 1),
  ('HDR-000001',  '2271dc49-c4c4-4c7b-982e-f6558fef383b', 'available', 80,   'HDR-000001',  jsonb_build_object('id','HDR-000001','name','SS Door Hinge 4in','lot',true), true, 48),
  ('DOR-000001',  '6dba4b15-e81d-4b80-9b22-297d7bf6c475', 'available', 4500, 'DOR-000001',  jsonb_build_object('id','DOR-000001','name','Teak Flush Door 7x3'),  false, 1),
  ('DOR-000002',  '6dba4b15-e81d-4b80-9b22-297d7bf6c475', 'available', 4500, 'DOR-000002',  jsonb_build_object('id','DOR-000002','name','Teak Flush Door 7x3'),  false, 1)
ON CONFLICT (id) DO NOTHING;