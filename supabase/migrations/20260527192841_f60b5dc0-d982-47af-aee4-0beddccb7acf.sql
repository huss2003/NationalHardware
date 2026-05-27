do $$
declare keep_ids uuid[];
begin
  select array_agg(id) into keep_ids
  from public.products
  where category::text = 'mica'
    and name in (
      '1mm Mica Lc','Ebony','Glossy Offwhite','Glossy White','Inner Pvc',
      'Mica 0.6','Mica Diffrance','Mica Lc','MICA TUKRA','Off-white B Grade',
      'OFFWHITE INNER MICA 0.8','OFFWHITE INNER MICA 1MM','VENEER',
      'WHITE INNER MICA 0.8','WHITE INNER MICA 1MM','Wooden 07'
    );

  delete from public.sales_return_items   where product_id <> all(keep_ids);
  delete from public.purchase_return_items where product_id <> all(keep_ids);
  delete from public.sales_items          where product_id <> all(keep_ids);

  delete from public.item_history
   where item_id in (select id from public.item_instances where product_id <> all(keep_ids));
  delete from public.item_instances       where product_id <> all(keep_ids);

  delete from public.purchase_items       where product_id <> all(keep_ids);
  delete from public.products             where id <> all(keep_ids);
  delete from public.product_subcategories;
end $$;