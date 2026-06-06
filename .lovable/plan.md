# Import FY 2026-27 Creditors Ledger

## Goal
Load the FY 2026-27 ledger from the new Google Sheet as the authoritative source for that year, excluding the "Closing Balance" summary rows that break reconciliation, and present each financial year so it matches the Tally export exactly.

## What the sheet contains
- One tab, **Creditors** (titled "26-27"), covering **1-Apr-2026 to 11-Jun-2026**.
- **95 party ledgers**: 13 suppliers (Purchase/Payment), 5 customers (Sales/Receipt), and 76 opening-balance-only parties.
- Each active block ends with a **"Closing Balance"** summary row plus dashed separators — these are totals, not transactions.

## Decisions (confirmed)
1. The sheet is the **source of truth** for FY 2026-27.
2. Route by entry type: blocks with Sales/Receipt go to the **customer** ledger; everything else (Purchase/Payment/Journal/Return and opening-only) goes to the **supplier** ledger. Missing parties are auto-created.
3. **Exclude** every "Closing Balance" row and separator on import.

## How it will work

### 1. Import the data
Parse the sheet and write rows tagged with a new source `gsheet_fy2627`:
- **Opening balance** row per party (Dr/Cr taken from the Balance column).
- **Transactions** for the year (Sale, Receipt, Sales Return, Purchase, Payment, Purchase Return, Journal).
- Customer blocks → `sales_ledger`; supplier and opening-only blocks → `purchase_ledger`.
- Parties matched to existing customers/suppliers by normalized name; missing ones created.
- "Closing Balance" rows and dashed separators are skipped entirely.

Cash & bank are **not** rebuilt from this tab: a dedicated FY 2026-27 cash import already exists, and the creditors tab would only contribute partial contra entries (avoids double counting).

### 2. Add a Financial Year toggle to the Ledger page
The Ledger currently stacks the FY 2025-26 import with live app data, which would double-count the new year's opening balance. To keep each year exact:
- Add an **FY 2025-26 / FY 2026-27** switch (defaults to FY 2026-27).
- **FY 2025-26** shows only the `gsheet_fy2526` import (its own opening + transactions).
- **FY 2026-27** shows the `gsheet_fy2627` import (its own opening + transactions) plus live in-app activity dated **on/after 12-Jun-2026** (the day after the sheet's coverage), so nothing in the sheet's window is duplicated.

Because each year starts from its own sheet opening balance and the running balance is computed independently, every party's balance column will line up with the Tally export, and the spurious "Closing Balance" line disappears.

Cash & Bank tabs are unchanged in this work.

## Verification
After import, spot-check several parties against the sheet (e.g. ADARSH MARKETING → 1,77,678 Cr; ANIL RAGUVANSHI (ADITYA JAIN) → 1,97,969 Dr; GARAVJAIN → 18,318 Cr; BKG INTERNATIONAL SCHOOL → 39,400 Dr) and confirm the running balance matches with no closing-balance row.

---

### Technical notes
- New import is a one-off (edge-function/script with service role) reading the sheet via the connector gateway, mirroring the existing `import-ledger-fy2526` flow; source tag `gsheet_fy2627`; idempotent (deletes `source='gsheet_fy2627'` before re-inserting).
- Direct debit/credit mapping (no sign flip) — the view's `running = debit - credit` reproduces the sheet's Dr/Cr Balance column.
- UI change is confined to `src/routes/_app.ledger.tsx`: add FY state, filter the ledger query by source, and switch the live-append cutoff to `2026-06-12` for the FY26-27 view (no live append for FY25-26).
