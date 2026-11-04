-- Custom placeholder product for Sales 2 HARDWARE wizard lines (mirrors PLY/MICA custom).
insert into public.products (id, name, category, prefix, hsn, gst_rate, unit, reorder_level, default_cost, default_price, active)
values ('d4e5f6a7-b8c9-4a0b-9c1d-2e3f40516273', 'HARDWARE (Custom)', 'other', 'HRDWX', '8302', 18.00, 'pcs', 5, 0, 0, false)
on conflict (id) do nothing;
