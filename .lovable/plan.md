## Scope & approach

This is a single-shop ERP (~30 routes, small data today, growing). Rather than a sprawling sweep, I'll ship a focused set of high-impact changes that compound. No business logic, workflows, UI, or data are changed.

Work is grouped in 5 phases. You can approve all, or stop after any phase.

---

### Phase 1 — Database indexes & query shape (biggest single win)

One migration adding indexes that match what the app actually filters/sorts on:

- `sales(customer_id, invoice_date desc) where deleted_at is null`
- `sales(invoice_date desc) where deleted_at is null`
- `sales_items(sale_id)`, `sales_items(product_id)`
- `purchases(supplier_id, bill_date desc) where deleted_at is null`
- `purchase_items(purchase_id)`, `purchase_items(product_id)`
- `receipts(customer_id, created_at desc)`, `receipts(sale_id)`
- `item_instances(product_id, status)`, `item_instances(status) where status='available'`, `item_instances(barcode_payload)`, `item_instances(godown_id)`
- `item_history(item_id, created_at desc)`
- `door_orders(customer_name, order_date desc)`, `door_order_items(order_id)`
- `sales_returns(customer_id)`, `sales_returns(sale_id)`, `purchase_returns(supplier_id)`, `purchase_returns(purchase_id)`
- `audit_log(ref_table, ref_id)`, `alerts(read_at) where read_at is null`
- Text search: `gin (name gin_trgm_ops)` on `products`, `customers`, `suppliers` (enable `pg_trgm`)

Plus two RPC helpers to replace expensive client-side aggregation:
- `dashboard_summary(_since timestamptz)` → returns sales/purchase totals, low-stock count, alerts, sparkline series in one round trip (today: 6 queries + JS sums on full tables).
- `inventory_stock_view` materialized read (or a `SECURITY DEFINER` function) returning `(product_id, available_qty)` so the inventory page stops fetching every `item_instances` row.

### Phase 2 — Data layer migration to TanStack Query

Convert `useEffect + useState + supabase.from(...)` to `queryOptions` + `ensureQueryData` + `useSuspenseQuery` on the hot routes. Gives caching, dedup, background refetch, no loading flash, no refetch on every nav.

Hot routes (in order): `dashboard`, `inventory.index`, `sales.index`, `purchases.index`, `ledger`, `sales-returns`, `purchase-returns`, `door`, `sales.receipts`.

Wire `defaultPreloadStaleTime: 0` in the router and a sensible per-query `staleTime` (30s reads, 5s for live tables like alerts).

### Phase 3 — Server-side pagination, search, virtualization

Lists currently fetch all rows then filter in JS — fine at 100, dead at 10k.

- Add URL-driven `validateSearch` for `{ page, pageSize, q, status, dateFrom, dateTo }` on sales/purchases/inventory/receipts/returns/door.
- Push search and filters into Supabase (`ilike`, range filters, `.range(from,to)`, `count: 'exact'`).
- Debounce the search input (250ms).
- Add a tiny `<VirtualTable>` (windowing via simple intersection observer; no extra dep) for any list that can exceed ~200 rows.

### Phase 4 — Bundle, rendering, navigation polish

- Replace `framer-motion` page-header animations with CSS transitions on routes that don't need them (cuts ~60KB on first paint; keep motion where it actually fires).
- Code-split heavy one-off deps so they only load on the screens that use them: `xlsx`, `jspdf` + `jspdf-autotable`, `recharts`, `bwip-js`, `qrcode`, `@zxing/browser`, `embla-carousel-react`. All via dynamic `import()` at the call site.
- Convert hot list rows / pure components to `memo`; stabilize callbacks with `useCallback` where they cross memo boundaries.
- Enable Router link preloading on hover (`defaultPreload: 'intent'`) for instant nav.
- `head()` `<link rel="preconnect">` to the Supabase URL on `__root.tsx`.
- Tree-shake `lucide-react` imports (already per-icon ✓ — just verify).

### Phase 5 — Misc cleanup & guardrails

- Add `select(..., { count: 'exact', head: true })` for counts instead of fetching rows.
- Replace blocking spinners with skeletons on the 5 most-visited screens.
- Add a single `useDebouncedValue` hook and apply to every search box.
- Remove dead files / unused imports the linter flags (no behavior change).
- Add `PRAGMA`-style `EXPLAIN ANALYZE` snippets in a `docs/perf-notes.md` for future tuning.

---

### Out of scope (intentionally)

- No schema redesign / table renames / RLS rewrites (data stays intact).
- No new infrastructure (Redis, queues, CDN). Cloudflare Workers + Supabase already cover edge + connection pooling.
- No realtime subscriptions are added or removed — there aren't any today.
- No visual redesign.

### Verification per phase

- Phase 1: run `EXPLAIN ANALYZE` before/after on dashboard & inventory queries via `supabase--read_query`.
- Phase 2–4: TanStack devtools network panel + `browser--performance_profile` on dashboard, inventory, sales list. Target: <200ms TTI on cached nav, <1s cold dashboard load.
- Phase 5: typecheck + lint clean.

### Risk

Phase 1 (indexes) and Phase 4 (lazy-load) are zero-risk. Phase 2 (Query migration) and Phase 3 (URL state + pagination) touch many files — done route-by-route with the screen verified after each.

---

**Recommended:** approve Phase 1 + Phase 4 first (1 migration + bundle wins, ~30 min, immediate speedup), then I'll start Phase 2 route-by-route. Tell me if you'd rather I run all five end-to-end.
