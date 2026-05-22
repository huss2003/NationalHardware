# Hardware vs Unique-Unit QR Behavior

Today every purchased unit gets its **own** QR (e.g. `PLY-000123`). Sales scan once = 1 unit, qty locked. This stays true for **plywood, door, other**.

For **hardware**, the user wants:
- One shared QR per hardware product (not per unit).
- Scanning that QR in Sales adds it to the cart; scanning the same code again (or pressing +) increases qty.
- Stock is tracked as a single lot row with a running quantity, not one row per piece.

## Database changes

Add to `item_instances`:
- `qty_on_hand integer NOT NULL DEFAULT 1`
- `is_lot boolean NOT NULL DEFAULT false`

Update `mint_item_instances(_purchase_item_id, _actor)`:
- If `products.category = 'hardware'`:
  - Look up the existing **available** lot row for that product (`is_lot = true`, `status = 'available'`).
  - If found → `qty_on_hand += purchase qty`, log history, return same row.
  - If not found → create one row with id = `product.prefix` (e.g. `HW-NAILS`) or `next_item_id(prefix)` reused as the lot id, `is_lot = true`, `qty_on_hand = purchase qty`, barcode = same id.
- Otherwise (plywood/door/other): unchanged — one row per unit, unique IDs.

Update `record_sale`:
- For a sold line whose item_instance is a lot (`is_lot = true`):
  - Decrement `qty_on_hand` by the sold qty.
  - Reject if qty would go negative ("Not enough stock for HW-XYZ").
  - Keep status `available` until qty reaches 0; then mark `sold`.
- Unit rows (non-lot): unchanged — mark `sold`, reject if not available.

## Frontend changes

`src/routes/_app.sales.new.tsx`:
- When scanning a code that matches an existing cart line:
  - If `is_lot` (hardware) → `qty += 1` instead of showing "duplicate".
  - Else → show duplicate warning (current behavior).
- In the cart table:
  - For non-lot lines (plywood/door/other): hide the +/− buttons and lock the qty field at 1.
  - For lot lines (hardware): keep the existing qty controls; show available stock so the user can't oversell.
- Add `is_lot` and `qty_on_hand` to the `Line` type so the UI knows which rule to apply.

`src/routes/_app.purchases.new.tsx`: no UI change — the RPC handles lot vs unit minting automatically based on product category.

Inventory pages already read `item_instances`; they'll start showing hardware as one row with `qty_on_hand > 1` instead of N rows.

## Out of scope for this change
- Labels/print: hardware labels will print one label per product (since the QR is shared). Existing label code keeps working.
- Returns: sales/purchase returns will continue to operate on item_instance rows; for hardware lots they'll add qty back to the lot row (handled by reusing the same decrement logic in reverse later).
