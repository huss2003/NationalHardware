-- Low-stock reorder list: active products whose available qty (lot qty_on_hand
-- or count of available instances) is at/below their reorder level, with the
-- supplier derived from each product's most recent purchase.
create or replace function public.reorder_list()
returns table(product_id uuid, name text, unit text, qty numeric, reorder_level int, supplier_name text)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with stock as (
    select p.id, p.name, p.unit, p.reorder_level,
      coalesce(sum(case when ii.is_lot then ii.qty_on_hand
                        else (ii.status = 'available')::int end), 0) as qty
    from public.products p
    left join public.item_instances ii on ii.product_id = p.id
    where p.active = true
    group by p.id, p.name, p.unit, p.reorder_level
  ),
  last_sup as (
    select distinct on (pi.product_id) pi.product_id, s.name as supplier_name
    from public.purchase_items pi
    join public.purchases pu on pu.id = pi.purchase_id and pu.deleted_at is null
    left join public.suppliers s on s.id = pu.supplier_id
    order by pi.product_id, pu.bill_date desc nulls last, pu.created_at desc
  )
  select st.id, st.name, st.unit, st.qty, st.reorder_level, ls.supplier_name
  from stock st
  left join last_sup ls on ls.product_id = st.id
  where st.qty <= st.reorder_level
  order by ls.supplier_name nulls last, st.name;
$function$;
grant execute on function public.reorder_list() to authenticated;
