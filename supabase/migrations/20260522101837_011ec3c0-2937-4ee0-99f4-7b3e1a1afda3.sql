
ALTER TABLE public.item_instances
  ADD COLUMN IF NOT EXISTS qty_on_hand integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_lot boolean NOT NULL DEFAULT false;

-- Hardware-aware minting
CREATE OR REPLACE FUNCTION public.mint_item_instances(_purchase_item_id uuid, _actor_user_id uuid)
RETURNS SETOF public.item_instances
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  pi public.purchase_items;
  p public.products;
  i int;
  new_id text;
  new_row public.item_instances;
  qr jsonb;
  bill_no text;
  sup_name text;
  lot_row public.item_instances;
begin
  select * into pi from public.purchase_items where id = _purchase_item_id;
  if not found then raise exception 'purchase_item not found'; end if;
  select * into p from public.products where id = pi.product_id;
  select pu.bill_no, s.name into bill_no, sup_name
    from public.purchases pu left join public.suppliers s on s.id = pu.supplier_id
    where pu.id = pi.purchase_id;

  if p.category = 'hardware' then
    -- One shared lot row per hardware product
    select * into lot_row from public.item_instances
      where product_id = p.id and is_lot = true and status = 'available'
      order by created_at asc limit 1;
    if found then
      update public.item_instances
        set qty_on_hand = qty_on_hand + pi.qty,
            cost_price = pi.rate,
            updated_at = now()
        where id = lot_row.id
        returning * into new_row;
      insert into public.item_history(item_id, event, ref_table, ref_id, actor_user_id, notes)
        values (new_row.id, 'purchased', 'purchases', pi.purchase_id::text, _actor_user_id,
                'Lot restock +' || pi.qty);
      return next new_row;
    else
      new_id := public.next_item_id(p.prefix);
      qr := jsonb_build_object(
        'id', new_id, 'name', p.name, 'bill_no', bill_no,
        'supplier', sup_name, 'date', current_date, 'status', 'available',
        'lot', true
      );
      insert into public.item_instances(id, product_id, source_purchase_item_id,
        status, cost_price, barcode_payload, qr_payload, is_lot, qty_on_hand)
        values (new_id, p.id, pi.id, 'available', pi.rate, new_id, qr, true, pi.qty)
        returning * into new_row;
      insert into public.item_history(item_id, event, ref_table, ref_id, actor_user_id, notes)
        values (new_id, 'purchased', 'purchases', pi.purchase_id::text, _actor_user_id,
                'New hardware lot, qty ' || pi.qty);
      return next new_row;
    end if;
  else
    -- Unique unit per piece (plywood, door, other)
    for i in 1..pi.qty loop
      new_id := public.next_item_id(p.prefix);
      qr := jsonb_build_object(
        'id', new_id, 'name', p.name, 'bill_no', bill_no,
        'supplier', sup_name, 'date', current_date, 'status', 'available'
      );
      insert into public.item_instances(id, product_id, source_purchase_item_id,
        status, cost_price, barcode_payload, qr_payload, is_lot, qty_on_hand)
        values (new_id, p.id, pi.id, 'available', pi.rate, new_id, qr, false, 1)
        returning * into new_row;
      insert into public.item_history(item_id, event, ref_table, ref_id, actor_user_id, notes)
        values (new_id, 'purchased', 'purchases', pi.purchase_id::text, _actor_user_id, 'Purchase mint');
      return next new_row;
    end loop;
  end if;
end $function$;

-- Hardware-aware sale recording
CREATE OR REPLACE FUNCTION public.record_sale(_payload jsonb, _actor_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  sale_id uuid := gen_random_uuid();
  inv_no text;
  s public.app_settings;
  line jsonb;
  iid text;
  ln_qty int;
  ii public.item_instances;
  same_state boolean;
  cust_state text;
  total_sub numeric := 0;
  total_cgst numeric := 0;
  total_sgst numeric := 0;
  total_igst numeric := 0;
  total_disc numeric := coalesce((_payload->>'discount')::numeric, 0);
  ln_total numeric;
  ln_tax numeric;
  ln_gst numeric;
begin
  select * into s from public.app_settings where id = true;
  update public.app_settings set invoice_counter = invoice_counter + 1 where id = true
    returning invoice_prefix || '-' || lpad((invoice_counter - 1)::text, 6, '0') into inv_no;

  cust_state := _payload->>'customer_state';
  same_state := coalesce(cust_state, s.state) is not distinct from s.state and s.state is not null;

  insert into public.sales(id, invoice_no, customer_id, payment_mode, paid_amount, notes,
    discount, created_by)
    values (sale_id, inv_no,
      nullif(_payload->>'customer_id','')::uuid,
      coalesce(_payload->>'payment_mode','cash')::public.payment_mode,
      coalesce((_payload->>'paid_amount')::numeric, 0),
      _payload->>'notes', total_disc, _actor_user_id);

  for line in select * from jsonb_array_elements(_payload->'items') loop
    iid := line->>'item_instance_id';
    ln_qty := coalesce((line->>'qty')::int, 1);
    ln_gst := coalesce((line->>'gst_rate')::numeric, 18);
    ln_total := ln_qty * coalesce((line->>'rate')::numeric, 0);
    ln_tax := round(ln_total * ln_gst / 100, 2);
    insert into public.sales_items(sale_id, product_id, item_instance_id, qty, rate, gst_rate, line_total)
      values (sale_id, (line->>'product_id')::uuid, iid, ln_qty,
        coalesce((line->>'rate')::numeric, 0), ln_gst, ln_total);
    total_sub := total_sub + ln_total;
    if same_state then
      total_cgst := total_cgst + ln_tax/2;
      total_sgst := total_sgst + ln_tax/2;
    else
      total_igst := total_igst + ln_tax;
    end if;

    if iid is not null then
      select * into ii from public.item_instances where id = iid;
      if not found then raise exception 'Item % not found', iid; end if;
      if ii.is_lot then
        if ii.qty_on_hand < ln_qty then
          raise exception 'Not enough stock for % (have %, need %)', iid, ii.qty_on_hand, ln_qty;
        end if;
        update public.item_instances
          set qty_on_hand = qty_on_hand - ln_qty,
              status = case when qty_on_hand - ln_qty <= 0 then 'sold'::item_status else status end,
              updated_at = now()
          where id = iid;
        insert into public.item_history(item_id, event, ref_table, ref_id, actor_user_id, notes)
          values (iid, 'sold', 'sales', sale_id::text, _actor_user_id, 'Lot sale -' || ln_qty);
      else
        update public.item_instances set status = 'sold' where id = iid and status = 'available';
        if not found then
          raise exception 'Item % is not available for sale', iid;
        end if;
        insert into public.item_history(item_id, event, ref_table, ref_id, actor_user_id)
          values (iid, 'sold', 'sales', sale_id::text, _actor_user_id);
      end if;
    end if;
  end loop;

  update public.sales set subtotal = total_sub, cgst = total_cgst, sgst = total_sgst,
    igst = total_igst,
    grand_total = total_sub - total_disc + total_cgst + total_sgst + total_igst
    where id = sale_id;

  insert into public.audit_log(actor_user_id, action, ref_table, ref_id, details)
    values (_actor_user_id, 'sale.create', 'sales', sale_id::text, _payload);

  return sale_id;
end $function$;
