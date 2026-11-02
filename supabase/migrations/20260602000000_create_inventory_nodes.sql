-- Arbitrary-depth category tree for Inventory 2 (self-referential parent_id).
-- CRUD at every level; cascade delete removes descendants.
create table if not exists public.inventory_nodes (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.inventory_nodes(id) on delete cascade,
  name text not null,
  image_url text,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_inventory_nodes_parent on public.inventory_nodes (parent_id);

alter table public.inventory_nodes enable row level security;

create policy "auth read inventory_nodes" on public.inventory_nodes for select to authenticated using (true);
create policy "auth write inventory_nodes" on public.inventory_nodes for insert to authenticated with check (true);
create policy "auth update inventory_nodes" on public.inventory_nodes for update to authenticated using (true) with check (true);
create policy "auth delete inventory_nodes" on public.inventory_nodes for delete to authenticated using (true);

-- Seed the four top-level categories (idempotent).
insert into public.inventory_nodes (name, sort)
select v.name, v.sort from (values ('PLY',0),('MICA',1),('HARDWARE',2),('DOORS',3)) as v(name,sort)
where not exists (select 1 from public.inventory_nodes where parent_id is null and inventory_nodes.name = v.name);
