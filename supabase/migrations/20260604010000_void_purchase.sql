-- Void a purchase with reversal: archive to recycle_bin, hide it, and remove the
-- stock it added (delete the non-lot units it created; subtract lot qty_on_hand).
-- Blocks if any non-lot purchased unit was already sold/used. Role (admin-only)
-- is enforced in the UI; the app uses a shared Supabase account so the DB can't
-- verify admin.
create or replace function public.void_purchase(_purchase_id uuid, _reason text, _actor_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare payload jsonb; bno text; sold_count int;
begin
  select to_jsonb(p), p.bill_no into payload, bno from public.purchases p where p.id = _purchase_id;
  if bno is null then raise exception 'Purchase not found'; end if;

  select count(*) into sold_count
  from public.item_instances ii
  join public.purchase_items pi on pi.id = ii.source_purchase_item_id
  where pi.purchase_id = _purchase_id and coalesce(ii.is_lot, false) = false and ii.status <> 'available';
  if sold_count > 0 then
    raise exception 'Cannot void: % purchased item(s) already sold or used', sold_count;
  end if;

  insert into public.recycle_bin(ref_table, ref_id, payload, reason, deleted_by)
    values ('purchases', _purchase_id::text, payload, _reason, nullif(_actor_user_id::text,'')::uuid);
  update public.purchases set deleted_at = now() where id = _purchase_id;

  delete from public.item_instances ii using public.purchase_items pi
    where pi.id = ii.source_purchase_item_id and pi.purchase_id = _purchase_id and coalesce(ii.is_lot, false) = false;

  update public.item_instances ii
    set qty_on_hand = greatest(0, ii.qty_on_hand - sub.qty), updated_at = now()
  from (
    select pi.product_id, sum(pi.qty)::int as qty
    from public.purchase_items pi
    where pi.purchase_id = _purchase_id
      and exists (select 1 from public.item_instances x where x.product_id = pi.product_id and x.is_lot)
    group by pi.product_id
  ) sub
  where ii.product_id = sub.product_id and ii.is_lot;

  insert into public.audit_log(actor_user_id, action, ref_table, ref_id, details)
    values (nullif(_actor_user_id::text,'')::uuid, 'purchase.void', 'purchases', _purchase_id::text,
      jsonb_build_object('reason', _reason, 'bill_no', bno));
end $$;
grant execute on function public.void_purchase(uuid, text, uuid) to authenticated;
