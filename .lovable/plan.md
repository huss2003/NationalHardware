## Goal

Convert the FY 2025-26 Google Sheet data (currently sitting only as summary rows in `sales_ledger` / `purchase_ledger`) into **real bills** in the `sales` and `purchases` tables with parsed line items, linked to customers and suppliers — exactly like the earlier FY 2026-27 import. After import, remove the Sales/Purchase tabs from the Ledger screen and clear the imported ledger tables. Returns, debit notes and journals are all included. Voucher numbers are kept raw.

## Source data

The sheet `Sales` and `Purchase` tabs use a repeating block format:
- A header row: `Date | Type | Vch/Bill No | Account (party name) | Debit | Credit | Balance`
- Followed by item lines in the Account column: `Product Name   qty unit @ rate   altqty altunit @ altrate = line_total`
- Ending with a `**** Total Qty. … : Amt. … ****` line.

Types present — Sales tab: `Sale`, `Sales Return`, `Journal`. Purchase tab: `Purchase`, `Debit Note`, `Journal`.

## Mapping

| Sheet row | Becomes | Amount field |
|-----------|---------|--------------|
| Sale | `sales` bill + `sales_items` | grand_total = Credit |
| Sales Journal | `sales` bill (no items, note "Journal") | grand_total = Credit |
| Sales Return | `sales_returns` + `sales_return_items` | grand_total = Credit |
| Purchase | `purchases` bill + `purchase_items` | grand_total = Debit |
| Purchase Journal | `purchases` bill (no items, note "Journal") | grand_total = Debit |
| Debit Note | `purchase_returns` + `purchase_return_items` | grand_total = Credit |

- Bill/invoice/return number = the raw Vch/Bill No (duplicates with FY26-27 are accepted).
- Date → invoice_date / bill_date / return_date.
- No GST in the sheet, so subtotal = grand_total, tax = 0, gst_rate = 0, paid_amount = 0 (credit transactions).
- Notes tag each record, e.g. `Sales import FY2025-26 (bill 14)`, so they are identifiable.

## Party & product matching

- **Customers / Suppliers**: match by normalized name against existing rows (514 customers, 143 suppliers already exist from the prior import); create a new record when no match.
- **Products**: match each parsed line-item name against existing products (1,475 exist); create a new product when no match (same behavior as the prior import). Items with zero/blank product names (e.g. "BALANCE/TAX", "Hamali") are kept as line items under a generated product so totals reconcile.

## Steps

1. **Import helper (temporary DB function).** Add a migration creating a `SECURITY DEFINER` function `import_sheet_bills(_rows jsonb)` that, per transaction, resolves-or-creates the customer/supplier, resolves-or-creates each product, and inserts the bill/return/journal plus its item rows. Granted to `anon` for the duration of the import (dropped in step 5), mirroring the earlier `import_ledger_rows` approach.

2. **Parse & build payload.** A script reads the `Sales` and `Purchase` tabs through the Google Sheets connector, groups header + item lines into transactions, parses each item line (name, qty, rate, line_total), and assembles a JSON payload.

3. **Run the import** in chunks via the helper RPC, creating all bills, returns and journal entries with their items.

4. **Verify reconciliation.** Compare imported totals against the existing `sales_ledger` / `purchase_ledger` totals (Sale credit ₹82,31,740.91 over 469 rows; Purchase debit ₹1,75,42,999.28 over 336 rows; plus returns, debit note and journals) and spot-check a few parties in the customer/supplier ledger.

5. **Cleanup data.** Drop the temporary `import_sheet_bills` function and delete all `sales_ledger` and `purchase_ledger` rows (the `cash_transactions` / Cash tab is left untouched).

6. **Update the Ledger screen** (`src/routes/_app.ledger.tsx`): remove the `sales` and `purchase` tab buttons, their queries, the `AccountLedger` rendering branches and related state, keeping only Customers, Suppliers and Cash. The imported bills now surface naturally inside each customer's and supplier's ledger view.

7. **Validate** the build and confirm a sample customer and supplier show their new FY 2025-26 bills with correct running balances.

## Technical notes

- The `AccountLedger` component and `sales_ledger`/`purchase_ledger` queries become unused after step 6 and will be removed along with the tabs.
- `sales_items` / `purchase_items` / return-item rows require a non-null `product_id`, which is why every line item is matched or created as a product.
- Journal rows without item narration produce a header-only bill (no item rows) — valid, since the ledger reads bill totals from `sales` / `purchases` directly.
- This is a one-off data import performed with database/script tooling, not a new app feature; no recurring UI or endpoint is added.
