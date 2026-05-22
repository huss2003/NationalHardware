## Goal
The Ledger currently shows only Sales + Receipts (customers) and Purchases (suppliers). Extend it so **every** transaction tied to a customer or supplier appears — including **Door module orders** and Sales/Purchase Returns.

## Changes (single file: `src/routes/_app.ledger.tsx`)

### Customer ledger — add these sources
1. **Door orders** (`door_orders`) — matched by `customer_name` (door module stores name, not id).
   - Entry: `kind: "door"`, debit = `total`, credit = `0`, ref = `Door Order <order_no>`.
   - Currently no detail route exists for door orders, so the ref will be non-clickable (display-only).
2. **Sales returns** (`sales_returns`) where `customer_id = party.id`, `deleted_at is null`.
   - Entry: `kind: "sales-return"`, credit = `grand_total` (reduces customer dues), ref = `Sales Return <return_no>`.

### Supplier ledger — add this source
3. **Purchase returns** (`purchase_returns`) where `supplier_id = party.id`, `deleted_at is null`.
   - Entry: `kind: "purchase-return"`, credit = `grand_total` (reduces what we owe), ref = `Purchase Return <return_no>`.
   - (Supplier payments table doesn't exist yet, so nothing else to add on supplier side.)

### UI
- Add new badge styles + icons for `door` (Hammer/DoorOpen icon, purple), `sales-return` (RotateCcw, rose), `purchase-return` (RotateCcw, amber).
- Sort all entries by date; running balance + outstanding totals already handle new rows automatically.
- Keep existing Sales→`/sales/$id` and Purchases→`/purchases/$id` deep links. Door / returns stay non-linked for now (no detail routes exist).

## Notes
- Door orders link to customer by name string. If multiple customers share a name this will overcollect — acceptable given the current door schema. (Future: add `customer_id` to `door_orders`.)
- All 5 source queries run in a single `Promise.all` per party.
- No schema/migration changes. No other files touched.
