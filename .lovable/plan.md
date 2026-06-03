## Goal
Insert all 638 parties (502 Sundry Debtors → customers, 136 Sundry Creditors → suppliers) and their opening balances straight into Supabase with one SQL run. No endpoint, no publish.

## What I'll do

1. **Drop the endpoint approach**
   - Delete `src/routes/api/public/seed-accounts-import.ts`
   - Delete `src/data/accounts-import.json`
   These were only needed for the publish→trigger flow you don't want.

2. **Insert everything via a single SQL migration**
   The data is already parsed from `nh_ListofAccounts.xlsx`. One SQL run (wrapped in a transaction) inserts:
   - `customers` — 502 rows (name only)
   - `suppliers` — 136 rows (name only)
   - `sales` — 205 opening-balance invoices (`OB-OPENING`) for debtors with a net Dr balance
   - `receipts` — 30 opening-balance receipts for debtors with a net Cr (advance) balance
   - `purchases` — 60 opening-balance bills for creditors with a net Cr balance
   - `purchase_returns` — 31 opening-balance entries for creditors with a net Dr balance

   All opening-balance docs tagged `notes = "Opening balance (Accounts import 2026-06-03)"` so the Ledger computes each party's outstanding automatically (same modeling the Ledger page already reads).

3. **Verify**
   Query Supabase to confirm: 638 new parties exist and the opening-balance doc counts match (205 / 30 / 60 / 31), then spot-check a couple of party balances against the spreadsheet.

## Balance mapping (per the Ledger logic)
- Customer net = Dr − Cr → positive becomes a `sales` row (they owe us), negative becomes a `receipts` row (advance).
- Supplier net = Cr − Dr → positive becomes a `purchases` row (we owe them), negative becomes a `purchase_returns` row.
- Zero-balance parties get a row in customers/suppliers but no document.

## Technical notes
- Run as one `BEGIN; … COMMIT;` migration via the migration tool (full DB privileges; `psql`/exec DB access isn't available in this session, and the migration tool is the only way to execute writes here). It's all `INSERT`s — no schema change.
- Receipt numbers use an `AOB#####` prefix and purchase-return numbers `AOBR#####` to avoid clashing with any future Busy-import numbering.
- Idempotency: I'll confirm beforehand that no rows already carry the Accounts-import note (currently 0), so this runs clean once.
