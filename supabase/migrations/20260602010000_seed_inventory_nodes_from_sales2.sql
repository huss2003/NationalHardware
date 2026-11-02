-- Seed Inventory 2 tree from the Sales 2 wizard options.
-- PLY: thickness -> brand -> size. MICA: categories. Idempotent (skips if children exist).
do $$
declare pid uuid; tid uuid; bid uuid;
  t text; trn int; b text; brn int; z text; zrn int;
begin
  select id into pid from public.inventory_nodes where parent_id is null and name = 'PLY';
  if pid is not null and not exists (select 1 from public.inventory_nodes where parent_id = pid) then
    for t, trn in select x.name, x.rn from unnest(array['18 mm','12 mm','9 mm','8 mm','6 mm','25 mm Board']) with ordinality as x(name, rn) loop
      insert into public.inventory_nodes(parent_id, name, sort) values (pid, t, trn) returning id into tid;
      for b, brn in select y.name, y.rn from unnest(array['Applewood Ultra','Applewood Premium','Velocity','Primo Wud']) with ordinality as y(name, rn) loop
        insert into public.inventory_nodes(parent_id, name, sort) values (tid, b, brn) returning id into bid;
        for z, zrn in select s.name, s.rn from unnest(array['8*4','7*4','7*3','6*4','6*3','8*3']) with ordinality as s(name, rn) loop
          insert into public.inventory_nodes(parent_id, name, sort) values (bid, z, zrn);
        end loop;
      end loop;
    end loop;
  end if;

  select id into pid from public.inventory_nodes where parent_id is null and name = 'MICA';
  if pid is not null and not exists (select 1 from public.inventory_nodes where parent_id = pid) then
    for t, trn in select x.name, x.rn from unnest(array['National old','National Digital','National Premium','Lami Décor']) with ordinality as x(name, rn) loop
      insert into public.inventory_nodes(parent_id, name, sort) values (pid, t, trn);
    end loop;
  end if;
end $$;
