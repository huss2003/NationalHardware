CREATE OR REPLACE FUNCTION public.mint_stock_entry(_product_id uuid, _qty integer, _cost numeric, _actor_user_id uuid, _godown_id uuid DEFAULT NULL::uuid)
 RETURNS SETOF item_instances
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
begin
  if _qty is null or _qty < 1 then
    raise exception 'Quantity must be at least 1';
  end if;

  select * into p from public.products where id = _product_id;
  if not found then raise exception 'product not found'; end if;

  -- Always mint a UNIQUE, sequential barcode per physical unit (for every
  -- category). The id_sequences table persists next_value per prefix, so the
  -- next batch continues where the last one stopped (e.g. ...0011 -> ...0012).
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
end $function$;