CREATE OR REPLACE FUNCTION public.mint_stock_entry(
  _product_id uuid,
  _qty int,
  _cost numeric,
  _actor_user_id uuid,
  _godown_id uuid DEFAULT NULL
)
RETURNS SETOF public.item_instances
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  p public.products;
  i int;
  new_id text;
  new_row public.item_instances;
  qr jsonb;
  lot_row public.item_instances;
begin
  if _qty is null or _qty < 1 then
    raise exception 'Quantity must be at least 1';
  end if;

  select * into p from public.products where id = _product_id;
  if not found then raise exception 'product not found'; end if;

  if p.category = 'hardware' then
    -- One shared lot row per hardware product (scoped to godown).
    select * into lot_row from public.item_instances
      where product_id = p.id and is_lot = true and status = 'available'
        and godown_id is not distinct from _godown_id
      order by created_at asc limit 1;
    if found then
      update public.item_instances
        set qty_on_hand = qty_on_hand + _qty,
            cost_price = _cost,
            updated_at = now()
        where id = lot_row.id
        returning * into new_row;
      insert into public.item_history(item_id, event, actor_user_id, notes)
        values (new_row.id, 'purchased', _actor_user_id,
                'Manual stock entry +' || _qty);
      return next new_row;
    else
      new_id := public.next_item_id(p.prefix);
      qr := jsonb_build_object(
        'id', new_id, 'name', p.name,
        'date', current_date, 'status', 'available', 'lot', true,
        'finish', p.finish
      );
      insert into public.item_instances(id, product_id,
        status, cost_price, barcode_payload, qr_payload, is_lot, qty_on_hand, godown_id)
        values (new_id, p.id, 'available', _cost, new_id, qr, true, _qty, _godown_id)
        returning * into new_row;
      insert into public.item_history(item_id, event, actor_user_id, notes)
        values (new_id, 'purchased', _actor_user_id,
                'Manual stock entry, qty ' || _qty);
      return next new_row;
    end if;
  else
    for i in 1.._qty loop
      new_id := public.next_item_id(p.prefix);
      qr := jsonb_build_object(
        'id', new_id, 'name', p.name,
        'date', current_date, 'status', 'available',
        'finish', p.finish
      );
      insert into public.item_instances(id, product_id,
        status, cost_price, barcode_payload, qr_payload, is_lot, qty_on_hand, godown_id)
        values (new_id, p.id, 'available', _cost, new_id, qr, false, 1, _godown_id)
        returning * into new_row;
      insert into public.item_history(item_id, event, actor_user_id, notes)
        values (new_id, 'purchased', _actor_user_id, 'Manual stock entry');
      return next new_row;
    end loop;
  end if;
end $function$;

GRANT EXECUTE ON FUNCTION public.mint_stock_entry(uuid, int, numeric, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mint_stock_entry(uuid, int, numeric, uuid, uuid) TO service_role;