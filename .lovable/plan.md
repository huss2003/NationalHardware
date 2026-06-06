# Two-Mode Login: Employee vs Admin

## Goal

Replace the email/password sign-in with two buttons:

- **Continue as Employee** — one tap, no password.
- **Login as Admin** — must enter the code **5352**.

Employees get a restricted app: fewer pages, no money figures, view + create only. Admins keep everything as it is today.

## How login works behind the scenes

Every screen reads data from the database, which requires a signed-in session. So both buttons sign into one shared app account; the only difference is the **role** stored on the device:

- Employee button → signs in, role saved as `employee`.
- Admin button → checks the code is `5352`, signs in, role saved as `admin`.

The role is remembered on the device until "Sign out". The admin code `5352` is a fixed, client-side gate (as confirmed — quick, not cryptographically secure).

```text
        Login screen
        ┌──────────────────────────────┐
        │ [ Continue as Employee ]      │ → session + role=employee
        │                               │
        │ Admin code: [ ____ ]  [Login] │ → if 5352: session + role=admin
        └──────────────────────────────┘
```

## Employee restrictions

**Visible pages (everything else hidden):**
Inventory, Sub-Categories, Scan, Purchases, Purchase Returns, Sales, Sales Returns, Godowns, Door, Reports, Alerts.

**Hidden pages:** Dashboard, Ledger, Settings — removed from the sidebar and blocked if the URL is typed manually (redirects to Inventory).

**Sales & Purchase actions:** view and create only. (There is no edit-existing or delete button in the app today, so nothing extra needs disabling; should any destructive control be added later, it stays admin-only.)

**Money is hidden from employees on these screens:**
- Sales Overview — Total Revenue, Avg. Order Value, Pending Payments cards, the Sales Trends chart, and the Amount column.
- Purchases Overview — Total Spend card, Top Suppliers amounts, and the Amount column.
- All Sales / All Purchases lists — the page total and the Amount column.

Counts, dates, names, invoice/bill numbers, and statuses stay visible so employees can still find and create records.

## Admin experience

Unchanged. Admin sees all pages and all figures. The main Dashboard (Today Sales, Today Purchase, Pending Credit, Sales Volume, etc.) stays exactly as it is — those are simply never shown to employees because employees can't open the Dashboard.

## Landing page

- Admin lands on Dashboard (as today).
- Employee lands on Inventory.

---

## Technical detail

**Shared account + session**
- Create one dedicated Supabase auth account (e.g. `device@scanflow.app`) once, with email confirmed. Its password is stored as a server secret (`DEVICE_ACCOUNT_PASSWORD`); the email is a constant.
- New server function `startDeviceSession` (`src/lib/device-session.functions.ts`, `createServerFn`, no auth middleware) signs in server-side with the device credentials and returns `{ access_token, refresh_token }`. The client calls `supabase.auth.setSession(...)`, so the password never reaches the browser. All RLS policies are `authenticated → true`, so this account sees all existing data.

**Auth store (`src/lib/auth-store.ts`)**
- Role now comes from `localStorage` (`scanflow_role`, default `employee`) instead of the `user_roles` table; name derived as "Admin"/"Employee". Add `setRole`. `logout` clears the stored role.

**Login (`src/routes/login.tsx`)**
- Rewritten to the two-button UI. Employee → `startDeviceSession` → `setSession` → role `employee`. Admin → require input `=== "5352"` → `startDeviceSession` → `setSession` → role `admin` (toast on wrong code).

**Shared role config (`src/lib/roles.ts`, new)**
- `EMPLOYEE_NAV_KEYS` and `EMPLOYEE_ALLOWED_PREFIXES` (`/inventory`, `/purchases`, `/purchase-returns`, `/sales`, `/sales-returns`, `/godowns`, `/door`, `/reports`, `/alerts`).

**Sidebar (`src/components/layout/AppSidebar.tsx`)**
- When role is `employee`, show only `EMPLOYEE_NAV_KEYS` (Settings no longer force-shown for employees).

**App guard (`src/routes/_app.tsx`)**
- After auth resolves: if role is `employee` and the current path isn't under an allowed prefix, redirect to `/inventory`.

**Hide money (employee = role !== "admin")**
- `_app.sales.index.lazy.tsx`, `_app.purchases.index.lazy.tsx`, `_app.sales.all.lazy.tsx`, `_app.purchases.all.lazy.tsx`: conditionally render the monetary cards/columns/chart and the amount in page subtitles.

**Secret**
- Add `DEVICE_ACCOUNT_PASSWORD`.

No database schema or RLS changes are required.
