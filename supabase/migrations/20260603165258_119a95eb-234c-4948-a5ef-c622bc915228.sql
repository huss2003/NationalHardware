-- 1. Remove anon write/delete access to product-images bucket
DROP POLICY IF EXISTS "anon all product-images" ON storage.objects;

-- 2. Remove broad read access to shop_users (exposes pin_hash). Admins retain full access via "admin manage shop_users".
DROP POLICY IF EXISTS "auth read shop_users" ON public.shop_users;

-- 3. Restrict user_roles read to the caller's own row. Admins retain full access via "user_roles admin manage".
DROP POLICY IF EXISTS "user_roles read all signed in" ON public.user_roles;
CREATE POLICY "user_roles read own" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());