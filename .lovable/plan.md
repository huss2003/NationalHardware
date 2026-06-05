# Make the Ledger match the FY25-26 Google Sheet exactly

## Source of truth
The shared Google Sheet "Ledger" has two tabs that are Tally account-ledger exports for **1-Apr-2025 → 31-Mar-2026**:
- **Debtors** — 262 customer ledgers (202 with opening balance), 923 sales, 346 receipts, 62 sales-returns, plus some payments/journals.
- **Creditors** — 93 supplier ledgers (80 with opening balance), 243 purchases, 199 payments, plus returns/journals.

Each party block has an opening balance, every transaction row (Date, Type, Vch No, Account, Debit, Credit) and a running balance with `Dr`/`Cr`.

## Approach
Import the sheet rows verbatim into the purpose-built (currently empty) `sales_ledger` (customers) and `purchase_ledger` (suppliers) tables, plus a rebuilt cash/bank ledger, and render the Ledger page from this authoritative data. FY26-27 (≥ 1-Apr-2026) activity entered live in the app keeps appending after, so the current outstanding stays live — only the **FY25-26 portion** is guaranteed to match the sheet (closing balance will differ by FY26-27 activity, as you noted).

To avoid wiping inventory/sales history, existing `sales`/`receipts`/`purchases` rows are **kept**; double-counting is prevented by the 1-Apr-2026 cutoff (everything ≤ 31-Mar-2026 comes from the imported ledger, everything ≥ 1-Apr-2026 from the live tables). Only the ledger tables and cash/bank ledger are rebuilt.

## Steps

### 1. Schema (migration)
- Add to `sales_ledger` and `purchase_ledger`: `party_id uuid`, `party_name text`, plus an ordering column `seq int` and index on `party_id`. (`txn_date, txn_type, vch_no, account_name, debit, credit, narration, source` already exist.)
- Keep existing RLS/grants (tables already have policies).

### 2. Import script (run in build mode)
Parse both tabs via the Google Sheets connector:
- Split into party blocks on `*** NAME ***`; strip the markers.
- Keep rows dated **01-04-2025 … 31-03-2026** only; drop FY26-27 rows, separators and "Closing Balance" rows.
- Parse the opening-balance row (amount + `Dr`/`Cr`) into an `opening` row: `Dr` → debit side, `Cr` → credit side.
- Map types: `OpBal→opening, Sale→sale, Rcpt→receipt, SlRt→sales_return, Purc→purchase, Pymt→payment, Jrnl→journal, CrNt→credit_note, DrNt→debit_note`.
- Match party to an existing customer/supplier by normalized name; **auto-create** missing ones (name only).
- Insert all rows into `sales_ledger` (Debtors) / `purchase_ledger` (Creditors) with `party_id`, `party_name`, `seq`, `source='gsheet_fy2526'`.

### 3. Cash & Bank ledger rebuild
- Clear FY25-26 rows from `cash_transactions` and rebuild from every sheet row whose Account is `Cash` or `Hdfc Bank`, taking the contra side (party-credit → account debit/inflow; party-debit → account credit/outflow).
- Store both accounts, distinguished by `account_name`.

### 4. Ledger page rendering (`src/routes/_app.ledger.tsx`)
- **Customer/Supplier:** read FY25-26 rows from `sales_ledger`/`purchase_ledger` by `party_id`, append live `sales`/`receipts`/`sales_returns` (or `purchases`/`purchase_returns`/`supplier_payments`) dated ≥ 1-Apr-2026, order by date then `seq`, and compute running balance as `Σ(debit − credit)` with a `Dr`/`Cr` suffix by sign — reproducing the sheet's balance column exactly (including suppliers shown in `Cr` terms).
- **Cash:** filter `cash_transactions` to `Cash`; add a new **Bank** tab filtering `Hdfc Bank`. Each shows opening (if known), movements, running balance, and totals.
- Dates already display as DD/MM/YYYY via `fmtDate`.

## Verification
- Spot-check several parties (e.g. AAROGIYM, ABDUL REHMAN MANDU, ACE MICA, ADARSH MARKETING) so opening balance, each row's debit/credit, and the running `Dr/Cr` balance match the sheet line-for-line through 31-Mar-2026.
- Confirm every imported row has a debit or credit (only sales/purchase returns may be one-sided), satisfying the earlier "no empty entries" requirement.

## Notes / Technical details
- Cash/Bank **opening** balances aren't in the sheet (no cash/bank account tab), so their closing won't be absolute — only the movements match. Confirmed acceptable.
- Rendering reads ledger tables for history; the app stays live for new transactions.
- Import uses `psql` (insert access) for the ~3,500 rows; schema change goes through a migration.
