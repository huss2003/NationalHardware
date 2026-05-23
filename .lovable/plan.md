## Goal
Fix the ledger so Sales Returns and Purchase Returns are factored into Outstanding correctly, and make every return row clickable so the user can view its details.

## Changes (single file: `src/routes/_app.ledger.tsx`)

### 1. Customer ledger — sales-return + refund as two legs

Today each `sales_returns` row pushes ONE entry: `credit = grand_total`. That drops the customer's outstanding even when we already paid the cash back.

New behavior — mirror the sale + receipt pattern:
- Always push a **return entry**: `kind: "sales-return"`, `credit = grand_total`, `debit = 0`.
- If `refund_amount > 0` AND `refund_mode !== 'credit_note'`, push a second **refund entry**: `kind: "refund-paid"`, `debit = refund_amount`, `credit = 0`, dated same as the return, ref `Refund <mode> for SR-…`.

Net effect:
- Credit-note return → outstanding drops by `grand_total` (we owe them a future credit).
- Cash/UPI/card refund → return credit + refund debit cancel → outstanding unchanged (we already squared up).
- Partial cash refund → outstanding drops by `grand_total - refund_amount`.

### 2. Supplier ledger — purchase-return stays as one credit

Keep current logic (`credit = grand_total`) — schema has no refund column on `purchase_returns`, and the user didn't ask to change supplier-side math. We still want it clickable.

### 3. Make return rows clickable

Add `refId` to both `sales-return` and `purchase-return` entries, and wire row-level click:
- `sales-return` → open the existing `ReturnTimelineDialog` (refTable `sales_returns`) so the user sees items, history, reason, refund mode/amount.
- `purchase-return` → open `ReturnTimelineDialog` with refTable `purchase_returns`.
- `refund-paid` → no link (it's a virtual leg derived from the same return).

Add a small state `{ id, no, refTable }` for the open dialog, mount one `ReturnTimelineDialog` at the bottom of the page, and trigger from row `onClick`.

### 4. Type + UI polish

- Extend the `Entry["kind"]` union with `"refund-paid"`.
- Pick an icon (`Wallet` or `Undo2`) and a muted color chip for `refund-paid`.
- Row sorting unchanged (already by date).

## Out of scope
- No DB migration. Pure read-side calculation change.
- No change to how `sales_returns.refund_amount` is recorded (already captured in the create-return dialog).
- Supplier-side refund tracking (not in schema).