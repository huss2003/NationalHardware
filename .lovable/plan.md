## Goal

Make every entry from the 5 sub-sheets of the workbook (`178Vg…qFw`, FY 2026‑27, 1‑Apr‑2026 → 11‑Jun‑2026) present in Supabase as real ledger records, inserted with **direct SQL**, and visible in the Ledger screen.

## What I found (important)

The **Cash ledger is already complete**. A prior import (`cash import 2026-06-11`) already holds the cash-in-hand side of these vouchers for this exact date range: 68 cash receipts (₹23,18,552) and 20 cash payments (₹21,15,197), plus opening balance. Re-posting cash rows would **double-count cash**, so this plan does **not** touch `cash_transactions`.

What is missing is the **party side** of each voucher (Customer & Supplier ledgers). That is what this plan inserts.

## Sheet → destination mapping

| Sheet | Count | Destination table(s) | Ledger view |
|-------|-------|----------------------|-------------|
| Receipt | 77 | `receipts` | Customer (credit) |
| Payments | 54 | new `supplier_payments` | Supplier (credit) |
| Journal | 3 | `purchases` (header-only bill, note "Journal") | Supplier (debit) |
| Credit Note | 8 | `sales_returns` + `sales_return_items` | Customer (credit, ₹0) |
| Debit Note | 3 | `purchase_returns` + `purchase_return_items` | Supplier (credit, ₹0) |

Per your answers: returns are imported **qty-only at ₹0 value**; supplier **payments will be shown inside the supplier ledger** (small UI change); only **cash-mode** vouchers affect cash-in-hand (already present, so nothing to add there).

## Steps

1. **Migration — new `supplier_payments` table.** Columns: `supplier_id`, `payment_no`, `payment_date`, `amount`, `mode`, `notes`, plus standard `id/created_at/updated_at`. Includes GRANTs (authenticated + service_role), RLS (signed-in users can read/write, matching the pattern used by `purchase_returns`), and an `updated_at` trigger. This is the only schema change.

2. **Insert Receipts (77) → `receipts`.** For each voucher: match the customer by normalized name (create the customer if absent), set `receipt_no` = voucher no, `amount`, `mode` (Cash→`cash`, HDFC/ICICI→`bank`, PhonePe→`upi`), `receipt_type` = `general`, `created_at` = voucher date, `notes` tagged `Ledger sheet import 178Vg`.

3. **Insert Payments (54) → `supplier_payments`.** Match/create the supplier, store `payment_no`, `amount`, `mode`, `payment_date`, tagged notes.

4. **Insert Journals (3) → `purchases`.** Each "Purchase Dr / supplier Cr" becomes a header-only purchase bill (no line items): match/create supplier, `grand_total` = subtotal = amount, `bill_no` = voucher no, `bill_date` = date, `notes` = "Journal (Ledger sheet import 178Vg)". Appears as a debit in the supplier ledger via the existing purchases query.

5. **Insert Credit Notes (8) → `sales_returns` + `sales_return_items`.** Match/create the customer; one `sales_returns` header per voucher (`return_no` = voucher no, `grand_total` = 0, `refund_mode` = `credit_note`); one item row per listed product (match/create product, `qty` from sheet, `rate`/`line_total` = 0).

6. **Insert Debit Notes (3) → `purchase_returns` + `purchase_return_items`.** Same shape on the supplier side.

7. **Ledger UI — show supplier payments.** In `src/routes/_app.ledger.tsx`, extend the supplier branch to also query `supplier_payments` and push each as a `credit` entry (reduces payable), alongside the existing purchases/purchase-returns. Journals already surface through the purchases query. No change needed to the customer or cash views.

8. **Verify.** Re-query counts and totals (receipts ₹28,68,446 across 77; supplier payments ₹44,29,598 across 54; 3 journals ₹11,74,840; 8 sales returns, 3 purchase returns with items), spot-check a customer (e.g. "Aditya Jain (ghar)") and a supplier (e.g. "Mohit Plywood Product") in the Ledger, and confirm the build is clean.

## Technical notes

- **Idempotency / rollback:** every inserted row is tagged with the marker `Ledger sheet import 178Vg` in `notes`/source so a re-run can first delete that marker set, avoiding duplicates.
- **Dates** are Excel serials (e.g. 46113) → converted as `date '1899-12-30' + serial` (46113 = 2026‑04‑01).
- **Party matching** is case/space-insensitive against existing `customers` (516) / `suppliers` (154); unmatched names are created. The existing 33 `receipts` are unrelated (manual + opening-balance entries), so all 77 voucher receipts are new.
- **Product matching** for return items is normalized against existing `products` (~1,475); a missing product is created with name + a derived `prefix` (other required columns have defaults).
- **Direct SQL only:** inserts are run with the SQL data tool (generated from the parsed sheet using match-or-create CTEs) — no edge function or app endpoint.
- **Cash ledger is intentionally left untouched** because its rows already exist; this is called out so cash-in-hand is not inflated.
