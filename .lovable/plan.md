# Fix empty FY 2026-27 ledgers (carry forward opening balance)

## Problem

The Ledger page defaults to **FY 2026-27**. That view only shows rows tagged `source = gsheet_fy2627`, which were created from the *Creditors* sheet — covering only **90 suppliers and 5 customers**. Every other party (517 customers, 70 suppliers) has no FY26-27 row and no live activity yet (live cutoff is 12-Jun-2026), so their ledger shows "No transactions yet" even though they had a real FY25-26 balance.

Example: *Abizer Bhai Barwani* has no FY26-27 entry, so the page shows ₹0.00 / empty.

## Fix

In FY 2026-27, when a party has **no imported FY26-27 ledger rows**, synthesize an **Opening Balance** entry equal to that party's **FY 2025-26 closing balance**, then append live in-app activity as today. Parties that *do* have FY26-27 sheet rows are left unchanged (their sheet already contains its own opening row, so we must not double it).

This is the standard year-end carry-forward and ensures no party with prior history looks empty. Default year stays **FY 2026-27**.

## Implementation

Single file: `src/routes/_app.ledger.tsx` — inside the `["ledger","entries",...]` query (`queryFn`). No database or schema changes.

1. After fetching the FY26-27 imported rows (`led`) for the selected party:
   - If `led` has rows → behave exactly as today (push them, then append live activity).
   - If `led` is empty AND `fy === "2627"` → fetch that party's FY 2025-26 rows from the same ledger table (`sales_ledger` for customers, `purchase_ledger` for suppliers) filtered by `source = "gsheet_fy2526"`, and compute the closing balance:
     ```text
     closing2526 = sum(debit) - sum(credit)   // over all gsheet_fy2526 rows for the party
     ```
   - Push a single synthetic opening entry at the top (`seq = 0`, date = `2026-04-01`, type `opening`, ref "Opening Balance"):
     - if `closing2526 >= 0` → `debit = closing2526, credit = 0` (Dr)
     - else → `debit = 0, credit = -closing2526` (Cr)
   - Only add the opening row when `closing2526 !== 0` (skip truly zero-balance parties so they still read empty, which is correct).

2. Keep the existing live-activity appending (sales/receipts/returns for customers, purchases/payments/returns for suppliers) unchanged — it already runs for `fy === "2627"` and stacks on top of the opening row.

3. The running-balance, totals (`totalDebit`/`totalCredit`/`closing`) and header card already derive from `entries`, so they update automatically once the opening row is included.

## Verification

- Select *Abizer Bhai Barwani* (FY26-27): should now show an Opening Balance row matching their FY25-26 closing, instead of empty.
- Select a supplier already in the FY26-27 sheet (e.g. *Anil Raguvanshi*): unchanged — single opening from the sheet, no duplicate.
- Spot-check a customer with FY25-26 history: FY26-27 opens with the correct Dr/Cr carry-forward.
