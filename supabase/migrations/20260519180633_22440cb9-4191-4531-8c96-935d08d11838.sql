-- Revert to fully open (anon) access — no auth in the app

-- Reopen business tables to anon
do $$
declare t text;
begin
  for t in select unnest(array[
    'alerts','app_settings','audit_log','bom','bom_items','customers','id_sequences',
    'item_history','item_instances','produced_items','production_materials','production_orders',
    'products','profiles','purchase_items','purchases','recycle_bin','sales','sales_items',
    'shop_users','suppliers','user_roles'
  ]) loop
    execute format('drop policy if exists "anon all %1$s" on public.%1$s', t);
    execute format('create policy "anon all %1$s" on public.%1$s as permissive for all to anon using (true) with check (true)', t);
  end loop;
end $$;

-- Regrant EXECUTE on RPCs to anon
grant execute on function public.mint_item_instances(uuid, uuid) to anon;
grant execute on function public.record_sale(jsonb, uuid) to anon;
grant execute on function public.mark_damaged(text, text, uuid) to anon;
grant execute on function public.consume_material(uuid, text, uuid) to anon;
grant execute on function public.complete_production(uuid, uuid) to anon;
grant execute on function public.soft_delete_invoice(uuid, text, uuid) to anon;
grant execute on function public.next_item_id(text) to anon;
grant execute on function public.shop_user_has_role(uuid, user_role) to anon;
grant execute on function public.has_role(uuid, app_role) to anon;

-- Reopen storage buckets to anon
do $$
declare b text;
begin
  for b in select unnest(array['bill-images','invoices','product-images']) loop
    execute format($f$drop policy if exists "anon all %1$s" on storage.objects$f$, b);
    execute format($f$create policy "anon all %1$s" on storage.objects as permissive for all to anon using (bucket_id = %2$L) with check (bucket_id = %2$L)$f$, b, b);
  end loop;
end $$;
