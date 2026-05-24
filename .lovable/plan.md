## Goal

Replace the current "pick a role" fake login with real Supabase email+password auth, then remove every `anon` policy so the scan findings are resolved without breaking the app.

## What changes for users

- The login screen becomes an **email + password** form (with a "Create account" toggle).
- The first user to sign up is automatically made **admin**; everyone else is `billing` (already wired by the existing `handle_new_user` trigger).
- After the migration, **existing users must create an account** — the old "Admin / Employee" buttons go away. The localStorage role is replaced by the Supabase session.
- All app screens require sign-in; visiting any `/something` while signed out bounces to `/login`.

## Steps

### 1. Auth UI (frontend)
- Rewrite `src/routes/login.tsx` as a real Supabase email/password sign-in + sign-up form, with `emailRedirectTo: window.location.origin`.
- Replace `src/lib/auth-store.ts` with a Supabase session-backed store:
  - subscribe to `onAuthStateChange` (set listener BEFORE `getSession`)
  - expose `user`, `ready`, `role` (read from `user_roles` for the signed-in user)
  - `logout()` calls `supabase.auth.signOut()`
- Add an `_authenticated` layout route OR add a `beforeLoad` guard in `_app.tsx` that redirects to `/login` when no session. Use the existing `_app` shell.
- Update `AppSidebar` "Signed in as …" + sign-out button to use the new store.
- Disable email confirmation in Supabase Auth settings so signup works instantly (user can re-enable later).

### 2. Lock down RLS (database migration)
Drop every `anon` policy and rely on the existing `authenticated` policies. Specifically:
- `customers`, `suppliers`, `sales`, `sales_items`, `sales_returns`, `sales_return_items`, `purchases`, `purchase_items`, `purchase_returns`, `purchase_return_items`, `receipts`, `item_instances`, `item_history`, `shop_users`, `recycle_bin`, `audit_log`, `alerts`, `id_sequences`, `customer_receipt_seq`, `godowns`, `door_orders`, `door_order_items`, `door_types`, `app_settings`, `products` — drop all `... anon ...` policies.
- Replace `public read customers` / `public write customers` / etc. (which target `{anon,authenticated}`) with `authenticated`-only equivalents.
- `audit_log`: keep `authenticated` SELECT + INSERT only — no UPDATE/DELETE for anyone.
- `recycle_bin`: keep admin-only UPDATE/DELETE; SELECT for `authenticated`; INSERT for `authenticated`.
- `shop_users`: SELECT for `authenticated`; manage limited to admins (already in place via `admin manage shop_users`).
- `app_settings`: SELECT for `authenticated` only (drop `anon read app_settings`).
- Storage buckets `bill-images` / `invoices`: already authenticated-only — leave as-is.

### 3. Postgres extension warning
- Move `pg_trgm` from `public` schema to `extensions` schema (the linter warning).

### 4. Validation
- Sign up first account → becomes admin → confirm all screens (dashboard, sales/new, purchases/new, godowns, inventory) load and writes succeed.
- Sign out → bounced to `/login`. Direct URL access while signed out → `/login`.
- Re-run the security scan; remaining items get triaged.

## Technical notes

- All Supabase reads in components already use the browser client (`supabase` from `@/integrations/supabase/client`), so once a real session exists, RLS will accept them as `authenticated` — no per-query code changes needed.
- Server functions are not currently used for these reads; we do NOT need to introduce `requireSupabaseAuth` for the lockdown to work. The browser client carries the user's JWT directly.
- The existing `user_roles` + `has_role()` + `handle_new_user()` trigger already wires "first signup = admin"; nothing new needed there.
- Files touched: `src/routes/login.tsx`, `src/lib/auth-store.ts`, `src/routes/_app.tsx`, `src/routes/__root.tsx` (invalidate on auth change), `src/components/layout/AppSidebar.tsx`. Plus one DB migration.

## Out of scope

- Password reset flow (can add `/reset-password` later if you want).
- Google/social login.
- Migrating the existing `shop_users` PIN table — left in place but no longer used for login. We can delete it in a follow-up.
