## Goal
Import all purchase bills from `nh_AccountLedger_Purchase.xlsx` directly into the Supabase database (no API endpoint, no edge function, no publish step) as real purchase bills with item‑wise rates, so they render on each purchase bill page and show up per‑supplier in the Ledger. Also make the **View All** button on both the Sales and Purchases screens open a full list of all bills.

## Part 1 — Import purchase bills (direct DB inserts)

Source parses cleanly into **32 purchase bills / 13 suppliers** (each bill's items − discount + tax + freight + rounding = its printed total, verified with 0 mismatches).

Steps (all done with the DB insert/migration tooling, nothing in the app runtime):

1. **Suppliers** — match the 13 supplier names to existing `suppliers`. Create the 3 missing ones: `Hind Prakash Industries`, `Vandana Trader (jivanjor)`, `Ply House 25-26`. The other 10 already exist and will be reused by exact name.

2. **Products** — for every distinct item name, match to an existing `products` row by normalized name; create any missing product (name‑prefixed code, `gst_rate = 18`, `default_price` = the bill rate). Purchase line items require a `product_id`, so this guarantees every line links to a product.

3. **purchases** — one row per bill with:
   - `supplier_id`, `bill_no` (the voucher's Vch/Bill No), `bill_date` (voucher date)
   - `subtotal` = sum of line totals − discount
   - `tax_total` = bill total − subtotal (covers IGST / CGST+SGST / freight / rounding / BALANCE‑TAX)
   - `grand_total` = the bill's printed `**** Amt ****`
   - `notes = 'Purchase import 2026-06-11'` so the batch is identifiable/re‑runnable safely (insert guarded with NOT EXISTS to avoid duplicates).

4. **purchase_items** — one row per item line: `qty`, `rate`, `gst_rate`, `line_total`, linked to the parent purchase and the matched product.

5. **Verification queries** after insert: confirm 32 bills + all line items exist, each bill has a supplier and a grand total, and spot‑check a handful of bills (e.g. 23, 12, 17, 28) against the spreadsheet totals.

Result: each bill opens as a full purchase bill (item, qty, rate, GST, totals) on `/purchases/$id`, and appears under its supplier in the Ledger (Suppliers tab) as a debit entry, with outstanding balance recomputed from grand totals.

Note: the spreadsheet's running *Balance* column is inconsistent (it's a nominal Purchase‑account export, not a party ledger) and will be ignored — the app derives balances itself.

## Part 2 — Make "View All" work on Sales and Purchases

Currently the Sales "View All" links back to the same overview page, and the Purchases "View All" button does nothing. Add two dedicated full‑list routes and wire the buttons to them.

1. **New route `src/routes/_app.sales.all.tsx`** — full, searchable, paginated table of every sales bill (invoice no, date, customer, amount, status), each row linking to `/sales/$id`. Reuses the existing table/card styling.

2. **New route `src/routes/_app.purchases.all.tsx`** — full, searchable, paginated table of every purchase bill (bill no, date, supplier, amount), each row linking to `/purchases/$id`.

3. **Wire the buttons:**
   - In `src/routes/_app.sales.index.tsx`, point the "View All" link to `/sales/all`.
   - In `src/routes/_app.purchases.index.tsx`, make the "View All" action navigate to `/purchases/all` (add a clear "View All Bills" link on the bills table header).

These pages query the full `sales` / `purchases` tables (excluding soft‑deleted), with client‑side search + pagination so all bills are reachable.

## Technical notes
- Bill content is authoritative; the Balance column is discarded.
- Imports are idempotent via the `notes` tag + NOT EXISTS guards, so re‑running won't double‑insert.
- No schema changes are required for the import (existing `purchases` / `purchase_items` / `suppliers` / `products` tables suffice). The only new code is the two list routes + two link edits — pure frontend, no business‑logic changes.
