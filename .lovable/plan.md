## Goal

Hide additional summary tiles/blocks from the **employee** view (admin view unchanged), and remove **Reports** from the employee experience entirely.

## Changes

### 1. Purchases overview (`src/routes/_app.purchases.index.lazy.tsx`)
- Gate the **"Total Bills"** KPI card behind `isAdmin` (currently always shown). For employees the KPI strip will then show only Pending Deliveries and Late Shipments.
- Adjust the grid column count so the remaining tiles still lay out cleanly for employees.

### 2. Sales overview (`src/routes/_app.sales.index.lazy.tsx`)
- Gate the **"Total Sales Count"** KPI card behind `isAdmin` (currently the only tile employees see). Employees will then see no KPI strip on this page.

### 3. Purchase Returns (`src/routes/_app.purchase-returns.index.tsx`)
- Read role via `useAuth`. For employees, hide the entire KPI strip — **Total Returns**, **This Month**, **Awaiting Credit**, and **Return Value** — and the **Amount** column in the Recent Returns table (monetary). Admin view unchanged.

### 4. Sales Returns (`src/routes/_app.sales-returns.index.tsx`)
- Same pattern: for employees hide the KPI strip — **Total Returns**, **This Month**, **Return Value**, **Refunded** — and the monetary **Refund** / **Total** columns in the Recent Returns table. Admin view unchanged.

### 5. Remove Reports from employee view
- `src/lib/roles.ts`: remove `"reports"` from `EMPLOYEE_NAV_KEYS` and `"/reports"` from `EMPLOYEE_ALLOWED_PREFIXES`. This removes the Reports link from the sidebar for employees and redirects them to `/inventory` if they type `/reports` manually.

## Technical notes
- All gating uses the existing `const isAdmin = useAuth((s) => s.user)?.role === "admin"` pattern already used elsewhere.
- Return pages currently have no role check; I'll add the `useAuth` selector and conditionally render the KPI grid and money columns/`colSpan` values.
- No backend, schema, or RLS changes.