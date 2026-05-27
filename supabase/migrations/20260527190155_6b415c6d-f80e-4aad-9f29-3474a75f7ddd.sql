insert into public.products (name, category, prefix, unit, gst_rate, active)
select n, 'mica'::product_category, 'MICA', 'sheet', 18, true
from (values
  ('1mm Mica Lc'),('Ebony'),('Glossy Offwhite'),('Glossy White'),
  ('Inner Pvc'),('Mica 0.6'),('Mica Diffrance'),('Mica Lc'),
  ('MICA TUKRA'),('Off-white B Grade'),('OFFWHITE INNER MICA 0.8'),
  ('OFFWHITE INNER MICA 1MM'),('VENEER'),('WHITE INNER MICA 0.8'),
  ('WHITE INNER MICA 1MM'),('Wooden 07')
) as v(n)
where not exists (
  select 1 from public.products p where p.name = v.n and p.category::text = 'mica'
);