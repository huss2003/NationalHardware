# Fix Ledger: Dates + Missing Debit/Credit

## Problem found
1. **Dates** show as `M/D/YYYY` (US format) everywhere because the code uses `new Date(x).toLocaleDateString()` with no locale.
2. **692 sales (7-Oct-2025 → 31-Mar-2026)** have `grand_total = 0` and `subtotal = 0`, so the ledger shows `—` for both Debit and Credit and the balance never moves. This is because the Tally "List of Sales Vouchers" export used for those rows only contained item names + quantities — **no rupee amounts**. Receipts, payments and journals already have amounts and are fine.

The fix has two independent parts: a display fix (dates) and a data fix (sale amounts).

---

## Part 1 — Date format DD/MM/YYYY (whole app)

1. Add a shared helper in `src/lib/codes.ts`:
   ```ts
   export function fmtDate(d: string | number | Date | null | undefined): string {
     if (!d) return "—";
     const date = new Date(d);
     if (isNaN(date.getTime())) return "—";
     return date.toLocaleDateString("en-GB"); // DD/MM/YYYY
   }
   ```
2. Replace every user-facing `new Date(...).toLocaleDateString()` / `.toLocaleString()` date display with `fmtDate(...)` across the ledger and all other screens:
   - `src/routes/_app.ledger.tsx` (sale/receipt rows + cash rows)
   - `_app.sales.index.lazy.tsx`, `_app.sales.all.lazy.tsx`, `_app.sales.$id.lazy.tsx`, `_app.sales.receipts.tsx`
   - `_app.purchases.index.lazy.tsx`, `_app.purchases.all.lazy.tsx`, `_app.purchases.$id.lazy.tsx`, `_app.purchases.new.lazy.tsx`
   - `_app.sales-returns.index.tsx`, `_app.purchase-returns.index.tsx`
   - `_app.inventory.index.lazy.tsx`, `_app.inventory.$productId.tsx`, `_app.units.$itemId.tsx`, `_app.door.tsx`, `_app.alerts.tsx`, `_app.dashboard.lazy.tsx`
   - `src/components/erp/ReturnTimelineDialog.tsx`, `src/components/erp/SaleBillForm.tsx`
   - `src/lib/invoice-pdf.ts` (printed invoice date)
3. Leave non-display date math untouched (`calendar.tsx`, `chart.tsx`, `seed.ts`, sorting/`localeCompare`, `.toISOString()`).

## Part 2 — Import the missing sale amounts (data fix)

You will upload a file that contains each sale's rupee amount. Once uploaded:

1. Parse the file and build a map of **bill/voucher number → amount** (the imported sales store the bill number in `invoice_no`, e.g. `443`).
2. For each matched sale, UPDATE `public.sales`:
   - `subtotal` and `grand_total` = the sale amount.
   - For **cash** sales: set `paid_amount = grand_total` (paid on the spot, nets to zero outstanding). For **credit** sales: leave `paid_amount = 0` (settled later by receipts).
3. After the update, the ledger automatically renders Debit = `grand_total` for every sale (it already maps `debit: grand_total`), so every sale, purchase and receipt row will carry a value. Sales-returns / purchase-returns remain allowed to be value-less, as you specified.
4. Report any bill numbers in the file that did not match a sale (and vice-versa) so we can reconcile leftovers.

### Notes on matching
- I will match on `invoice_no` exactly first; if the file uses a different format (e.g. `2526/443`), I will normalize both sides (strip prefix) before matching.
- I will only update rows where `grand_total = 0` so already-correct sales are never overwritten.

---

## Result
- All dates display as DD/MM/YYYY across the app.
- Every sale, purchase and receipt in the ledger has a Debit or Credit and correctly moves the running balance; only sales/purchase returns may remain value-less.

## Next step
Please upload the file with the sale amounts (Excel/CSV/Tally export). It needs at least the **bill/voucher number** and the **amount** per sale. Once it's attached I'll implement Part 1 immediately and run Part 2 against your file.
