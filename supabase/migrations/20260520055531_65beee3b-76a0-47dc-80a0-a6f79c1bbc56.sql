
ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_created_by_fkey;
ALTER TABLE public.purchases DROP CONSTRAINT IF EXISTS purchases_created_by_fkey;
ALTER TABLE public.production_orders DROP CONSTRAINT IF EXISTS production_orders_created_by_fkey;
ALTER TABLE public.production_orders DROP CONSTRAINT IF EXISTS production_orders_assigned_to_fkey;
ALTER TABLE public.production_materials DROP CONSTRAINT IF EXISTS production_materials_actor_user_id_fkey;
ALTER TABLE public.audit_log DROP CONSTRAINT IF EXISTS audit_log_actor_user_id_fkey;
ALTER TABLE public.item_history DROP CONSTRAINT IF EXISTS item_history_actor_user_id_fkey;
ALTER TABLE public.recycle_bin DROP CONSTRAINT IF EXISTS recycle_bin_deleted_by_fkey;
