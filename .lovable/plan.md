# Doors — multi-line orders with size-based pricing

Restructure the Doors page so a user enters order-level info once, then adds multiple door lines, then finalises the order. Pricing is per square foot and uses the larger of Party size vs Taken size.

## Scope
- Only the **General** tab gets the new flow.
- **Vypaari** tab stays exactly as it is today.
- Door-types catalog: ensure F-Hard, F-Pine, WF-Pine, WF-Hard rows exist in `door_types` (do not touch existing rows).
- Add a new "Door Made" dropdown with options: S.D, D.D, J.D, JDD, PLY, WINDOW.

## New General flow (UI)

Top card — order header (entered once):
- Order No. (auto, editable)
- Date (today)
- Customer Name

Below — "Add door" line form (repeatable):
- Party Door Size  (text, format `72.05*32.28`, inches)
- Front Mica
- Back Mica
- Door Taken Size (text, same inches format)
- Door Type (dropdown from `door_types`)
- Door Made (dropdown: S.D, D.D, J.D, JDD, PLY, WINDOW)
- Quantity (int, default 1)
- Price per sqft (₹) — manual input
- Computed (read-only preview): Party sqft, Taken sqft, Billable sqft (= max of the two), Line total
- "Add door" button → pushes line into an in-memory list, resets the line form

Lines table below: shows added doors with all fields + line total + remove button.

Footer:
- Grand total (sum of line totals)
- "Save order" button — persists the order + all lines atomically, then resets.

## Pricing math
- Parse `L*W` (accept `x` or `*`, trim "inches"/"in"). Reject if not two positive numbers.
- sqft = round((L * W) / 144, 2)
- billable_sqft = max(party_sqft, taken_sqft)  — strict numeric max, so 2900.01 wins over 2900.
- line_total = round(price_per_sqft * billable_sqft * qty, 2)

## Data model

`door_orders` already stores one row per order today. We need multiple doors per order, so add a child table:

```text
door_orders (existing, header only)
  └── door_order_items (new, one row per door line)
```

New table `door_order_items`:
- id uuid PK
- order_id uuid (door_orders.id, on delete cascade)
- party_door_size text
- front_mica text
- back_mica text
- door_taken_size text
- door_type_id uuid (door_types.id)
- door_type_name text  (snapshot)
- door_made text       (S.D | D.D | J.D | JDD | PLY | WINDOW)
- qty int
- party_sqft numeric
- taken_sqft numeric
- billable_sqft numeric
- rate_per_sqft numeric
- line_total numeric
- created_at timestamptz
- RLS: same `authenticated` read/write/update/delete pattern used across the app.

`door_orders` header changes for General orders:
- `rate`, `door_type_id`, `door_type_name`, `door_taken_size`, `party_door_size`, `front_mica`, `back_mica` become optional (already nullable except `rate`). Make `rate` default-0 stay; we'll store 0 on header for multi-line General orders.
- `total` = sum of `door_order_items.line_total`.
- Vypaari rows continue to write the existing single-line fields and ignore `door_order_items`.

Seed/ensure: insert the 4 door types if missing (idempotent `on conflict do nothing` on name).

## Save flow
Client does:
1. Validate header (customer, ≥1 line).
2. Insert `door_orders` row with computed `total`.
3. Insert all `door_order_items` rows referencing that order id.
4. On any error, delete the header row to avoid orphans (best-effort; acceptable since this is single-user shop ops).

## Recent orders table
- Keep showing one row per order (existing table). Add a small line-count column (e.g. "3 doors"). Clicking a row can be a follow-up; not in this scope.

## Out of scope
- Editing existing orders / their lines.
- Vypaari multi-line flow.
- PDF / print.
- Inventory linkage for door orders.

## Technical notes
- New file: none. All UI changes inside `src/routes/_app.door.tsx` (split `DoorForm` into `GeneralOrderForm` (multi-line) and the existing single-line form kept for Vypaari).
- Helper: `parseInchSize(str): { l:number, w:number } | null` and `toSqft(l,w): number` co-located in the route file.
- Migration creates `door_order_items` + RLS + seeds 4 door types.
- Regenerate `src/integrations/supabase/types.ts` after migration.
