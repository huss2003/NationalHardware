# Import Busy ledger data into Supabase

Load party masters and their bill-wise opening outstanding from `nh_20260602_MSAll.DAT` into the existing schema. No schema changes — everything maps to current tables, and outstanding bills become seed sales/purchase documents so the current Ledger math picks them up automatically.

## What gets imported

- **502 customers** (Sundry Debtors) → `customers`
- **136 suppliers** (Sundry Creditors) → `suppliers`
- **4,152 customer outstanding bills** → seed `sales` / `receipts`
- **1,355 supplier outstanding bills** → seed `purchases` / `purchase_returns`
- **Items: excluded** (per your choice)

## Field mapping (parties)

| Busy field | customers / suppliers column |
|---|---|
| `Name` (`PrintName`) | `name` |
| `Mobile` (fallback `WhatsAppNo`) | `phone` |
| `StateName` | `state` |
| `CityName` + `AreaName` + `RegionName` | `address` |
| — (not present in file) | `gstin` left empty |

Note: this export has **no GSTIN and no email** for parties, so those stay blank.

## Opening outstanding → seed entries

Each party's balance equals the sum of its bill-reference `Value1` amounts. Busy sign convention in this file: for a customer, a negative bill value = they owe us; for a supplier, a positive value = we owe them. Each bill becomes one document, preserving bill-wise detail (`RefNo` → invoice/bill no, `Date` → date):

**Customers**
- Bill where customer owes → one `sales` row: `grand_total` = amount, `paid_amount` = 0, `invoice_no` = `RefNo`, `invoice_date` = bill `Date`.
- Bill that is a credit/advance → one `receipts` row (amount), so the balance nets correctly.

**Suppliers**
- Bill where we owe → one `purchases` row: `grand_total` = amount, `bill_no` = `RefNo`, `bill_date` = bill `Date`.
- Reverse/advance bill → one `purchase_returns` row, so the balance nets correctly.

All seed rows get `notes` = `"Opening balance (Busy import 2026-06-02)"` so they're identifiable and reversible later. Seed sales/purchases carry **no line items and no stock movement** — they are balance-only opening documents (the `record_sale` stock RPC is NOT used).

## Process

```text
1. Parse the DAT (ISO-8859-1 XML) → extract Accounts under
   Sundry Debtors / Sundry Creditors + their BillByBill bills.
2. De-dupe: skip a party if name (+phone) already exists in the table;
   otherwise insert and capture its new id.
3. For each party's bills, build the matching sales/receipts or
   purchases/purchase_returns rows linked by customer_id / supplier_id.
4. Bulk-insert in order: parties first, then their documents.
5. Print a summary: parties inserted/skipped, docs created, total
   customer due and supplier due, and a few sample ledgers to verify
   the running balance matches Busy OPBal.
```

## Verification

- Cross-check imported customer due (~₹39.3L) and supplier due (~₹10.1L) against the file totals.
- Open 2–3 parties in the **Ledger** page and confirm the bill-wise rows and outstanding balance render correctly.

## Notes / trade-offs

- Seed opening sales will appear in the **Sales list** (and purchases in the Purchases list), tagged with the import note. This is expected when modelling opening balances as documents.
- No literal transaction history (real invoices/receipts over time) exists in this file, so the ledger reflects the **opening position**, not historical movements.
- The whole import is one-time and re-runnable safely thanks to the de-dupe + note tagging.
