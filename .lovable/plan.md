# Cash in Hand Ledger

Add a third **Cash** tab to the existing Ledger page and import the uploaded Cash account ledger directly into the database, exactly as it appears in the file.

## Verified from the file

- **Opening Balance:** ₹3,24,27,970.70 Dr (1‑Apr‑2026)
- **129 entries:** 68 Receipts + 40 cash Sales (cash in / Debit), 20 Payments + 1 Credit Note (cash out / Credit)
- **Totals:** Debit ₹29,64,190 − Credit ₹21,15,197
- **Closing Balance:** ₹3,32,76,963.70 Dr — reconciles exactly (opening + debit − credit)

## What gets built

### 1. New table `cash_transactions` (schema migration)
Columns: `txn_date`, `txn_type` (`opening` | `receipt` | `sale` | `payment` | `credit_note`), `vch_no`, `account_name`, `debit`, `credit`, `narration`, `source` (tag for safe re‑runs), plus standard id/created_at/updated_at.
- Grants + RLS mirroring the existing tables (authenticated can read/write; service_role full).
- An `updated_at` trigger.

### 2. Seed the data directly (no app endpoints)
- Insert one `opening` row (debit = ₹3,24,27,970.70, dated 1‑Apr‑2026).
- Insert all 129 entries parsed from the spreadsheet (date, type, voucher no, account/party name, debit, credit, narration).
- Sales rows store the bill total as Debit; each entry keeps its short narration (item lines are summarized — the cash ledger only tracks the cash amount per voucher, matching the file).
- Every row tagged `source = 'cash import 2026-06-11'` and guarded by `NOT EXISTS`, so re‑running is safe and never duplicates.

### 3. Cash tab in `src/routes/_app.ledger.tsx`
- Add a third toggle button **Cash** (Wallet icon) next to Customers / Suppliers.
- When **Cash** is selected:
  - Hide the party search/list (not needed) and show the full cash ledger immediately.
  - Header card shows: **Opening Balance**, total Debit, total Credit, and **Closing Balance** (Dr/Cr).
  - Transactions table: Date · Type (Receipt/Sale/Payment/Credit Note badges) · Voucher · Account · Debit · Credit · running **Balance** (with Dr/Cr suffix).
  - Receipt/Sale = green credit-in styling; Payment/Credit Note = debit-out styling, matching the existing ledger look.
- Customers and Suppliers tabs are unchanged.

## Verification after import
- Query the table: confirm 130 rows (1 opening + 129), Debit sum = ₹29,64,190, Credit sum = ₹21,15,197.
- Confirm computed closing balance = ₹3,32,76,963.70 Dr, matching the file's last line.
- Open `/ledger` → **Cash** tab and confirm the running balance on the final row matches.

## Technical notes
- The CrNt (credit note) row's debit/credit orientation will be taken verbatim from the file during parsing so the running balance stays exact.
- Schema change goes through a migration; the 130 data rows are inserted as data (not in the migration), guarded for idempotency.
- No changes to sales/purchases/receipts logic — this Cash ledger is a standalone, file-accurate view as requested ("import this ledger as-is").
