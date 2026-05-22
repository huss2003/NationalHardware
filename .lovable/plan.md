# Door — General form tweaks

Scope: `src/routes/_app.door.tsx` (General tab only). No DB changes; door types already seeded.

## Changes

1. **Door Type dropdown** — already populated from `door_types` (F-Hard, F-Pine, WF-Pine, WF-Hard seeded). Verify they appear; if the live table is missing any, the seed migration covers it. No code change unless dropdown is empty.

2. **Replace "Billable sqft" field with "Total"** — In the Add-door card, swap the disabled `Billable sqft` input for a disabled `Total` input showing `inr(previewTotal)` (already computed). Keep the small footer hint line as-is for sqft breakdown.

3. **New "Mica Add-on" field** — Add a numeric input (label: "Mica Add-on") in the Add-door grid. Default `0`. Stored on each `DoorLine` as `mica_addon: number`.

4. **Total formula update**:
   - `line_total = round(billable_sqft * rate_per_sqft * qty + mica_addon, 2)`
   - If `mica_addon` is 0 or empty → behaves exactly as before.
   - Preview Total in the form and the Lines table "Total" column both reflect this.
   - Grand total sum unchanged (sums `line_total`).

5. **Persistence**: insert `mica_addon` into `door_order_items` payload. Column already nullable-friendly? It does not exist yet — add a `mica_addon numeric not null default 0` column via a small migration so it persists.

## Files

- `src/routes/_app.door.tsx` — UI + math changes in `GeneralOrderForm`.
- New migration: `alter table door_order_items add column mica_addon numeric not null default 0;`

## Out of scope

Vypaari tab, editing existing orders, showing mica add-on in the recent-orders table.
