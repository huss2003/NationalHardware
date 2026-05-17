do $$
declare t text;
begin
  for t in select unnest(array[
    'shop_users','suppliers','customers','products','id_sequences',
    'purchases','purchase_items','item_instances','item_history',
    'sales','sales_items','bom','bom_items','production_orders',
    'production_materials','produced_items','audit_log','recycle_bin',
    'alerts','app_settings'
  ]) loop
    execute format('drop policy if exists "anon all %1$s" on public.%1$s;', t);
    execute format('create policy "anon all %1$s" on public.%1$s for all to anon using (true) with check (true);', t);
  end loop;
end $$;

drop policy if exists "anon all item_history" on public.item_history;
create policy "anon read item_history" on public.item_history for select to anon using (true);
create policy "anon insert item_history" on public.item_history for insert to anon with check (true);

drop policy if exists "anon all audit_log" on public.audit_log;
create policy "anon read audit_log" on public.audit_log for select to anon using (true);
create policy "anon insert audit_log" on public.audit_log for insert to anon with check (true);

-- Ensure default settings row exists
insert into public.app_settings(id) values (true) on conflict (id) do nothing;