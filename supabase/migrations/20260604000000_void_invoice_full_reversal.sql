-- Void (soft-delete) a sale invoice with full reversal: archive to recycle_bin,
-- hide it, restore non-lot units AND lot qty_on_hand, reverse the cash-book entry
-- the bill posted, and write an audit log. Keeps the record for audit.
-- Role (admin-only) is enforced in the UI: the app uses a single shared Supabase
-- account with a client-side role, so the DB cannot verify admin.
create or replace function public.soft_delete_invoice(_sale_id uuid, _reason text, _actor_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare payload jsonb; inv text;
begin
  select to_jsonb(s), s.invoice_no into payload, inv from public.sales s where s.id = _sale_id;
  if inv is null then raise exception 'Sale not found'; end if;

  insert into public.recycle_bin(ref_table, ref_id, payload, reason, deleted_by)
    values ('sales', _sale_id::text, payload, _reason, nullif(_actor_user_id::text,'')::uuid);
  update public.sales set deleted_at = now() where id = _sale_id;

  -- Restore non-lot scanned units back to available.
  update public.item_instances ii set status = 'available'
    from public.sales_items si
    where si.sale_id = _sale_id and si.item_instance_id = ii.id and ii.status = 'sold' and coalesce(ii.is_lot, false) = false;

  -- Restore lot stock: add the sold qty back and mark available.
  update public.item_instances ii
    set qty_on_hand = ii.qty_on_hand + si.qty, status = 'available', updated_at = now()
    from public.sales_items si
    where si.sale_id = _sale_id and si.item_instance_id = ii.id and ii.is_lot = true;

  -- Reverse the cash-book entry this bill posted (cash/UPI/card sales).
  delete from public.cash_transactions where source = 'app_sale' and vch_no = inv;

  insert into public.audit_log(actor_user_id, action, ref_table, ref_id, details)
    values (nullif(_actor_user_id::text,'')::uuid, 'sale.void', 'sales', _sale_id::text, jsonb_build_object('reason', _reason, 'invoice_no', inv));
end $$;
