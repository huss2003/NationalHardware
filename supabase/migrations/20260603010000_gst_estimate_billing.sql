-- GST invoice vs non-GST Estimate billing.
-- Estimates use their own EST- sequence and carry no tax. Both bills round the
-- grand total to the nearest rupee (round_off stored). GST uses invoice_prefix.
alter table public.app_settings
  add column if not exists estimate_prefix text not null default 'EST',
  add column if not exists estimate_counter bigint not null default 1;

alter table public.sales
  add column if not exists bill_type text not null default 'estimate',
  add column if not exists round_off numeric(12,2) not null default 0;

create or replace function public.record_sale(_payload jsonb, _actor_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
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
  bill_type text := coalesce(_payload->>'bill_type', 'estimate');
  is_gst boolean := (bill_type = 'gst');
  total_sub numeric := 0;
  total_cgst numeric := 0;
  total_sgst numeric := 0;
  total_igst numeric := 0;
  total_disc numeric := coalesce((_payload->>'discount')::numeric, 0);
  ln_total numeric;
  ln_tax numeric;
  ln_gst numeric;
  raw_total numeric;
  grand numeric;
  roundoff numeric;
begin
  select * into s from public.app_settings where id = true;
  if is_gst then
    update public.app_settings set invoice_counter = invoice_counter + 1 where id = true
      returning invoice_prefix || '-' || lpad((invoice_counter - 1)::text, 6, '0') into inv_no;
  else
    update public.app_settings set estimate_counter = estimate_counter + 1 where id = true
      returning estimate_prefix || '-' || lpad((estimate_counter - 1)::text, 6, '0') into inv_no;
  end if;

  cust_state := _payload->>'customer_state';
  same_state := coalesce(cust_state, s.state) is not distinct from s.state and s.state is not null;

  insert into public.sales(id, invoice_no, customer_id, payment_mode, paid_amount, notes,
    discount, bill_type, created_by)
    values (sale_id, inv_no,
      nullif(_payload->>'customer_id','')::uuid,
      coalesce(_payload->>'payment_mode','cash')::public.payment_mode,
      coalesce((_payload->>'paid_amount')::numeric, 0),
      _payload->>'notes', total_disc, bill_type, _actor_user_id);

  for line in select * from jsonb_array_elements(_payload->'items') loop
    iid := line->>'item_instance_id';
    ln_qty := coalesce((line->>'qty')::int, 1);
    ln_gst := case when is_gst then coalesce((line->>'gst_rate')::numeric, 18) else 0 end;
    ln_total := ln_qty * coalesce((line->>'rate')::numeric, 0);
    ln_tax := round(ln_total * ln_gst / 100, 2);
    insert into public.sales_items(sale_id, product_id, item_instance_id, qty, rate, gst_rate, line_total)
      values (sale_id, (line->>'product_id')::uuid, iid, ln_qty,
        coalesce((line->>'rate')::numeric, 0), ln_gst, ln_total);
    total_sub := total_sub + ln_total;
    if is_gst then
      if same_state then
        total_cgst := total_cgst + ln_tax/2;
        total_sgst := total_sgst + ln_tax/2;
      else
        total_igst := total_igst + ln_tax;
      end if;
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

  raw_total := total_sub - total_disc + total_cgst + total_sgst + total_igst;
  grand := round(raw_total);
  roundoff := grand - raw_total;

  update public.sales set subtotal = total_sub, cgst = total_cgst, sgst = total_sgst,
    igst = total_igst, round_off = roundoff, grand_total = grand
    where id = sale_id;

  insert into public.audit_log(actor_user_id, action, ref_table, ref_id, details)
    values (_actor_user_id, 'sale.create', 'sales', sale_id::text, _payload);

  return sale_id;
end $function$;
