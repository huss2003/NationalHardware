## Godown Stock In / Stock Out

Add two action buttons on each Godown tile (and a header pair when "All Locations" is selected) that open dedicated dialogs.

### Stock In dialog

Tabs:
1. **Move existing** — searchable list of `item_instances` with `status='available'` and `godown_id` ≠ this godown (includes unassigned). Multi-select → updates `godown_id` to chosen godown, writes `item_history` event `moved`.
2. **Receive new** — pick product + qty → mints fresh `item_instances` via the same logic the purchase flow uses (unique units get N stickers; hardware reuses/creates a lot row). New rows get `godown_id` set. Auto-opens the print dialog (LabelSheet) for the minted stickers.

### Stock Out dialog

Step 1: pick units from this godown (scan or multi-select list, filtered to `godown_id = this`, `status='available'`).

Step 2: destination tabs:
- **To Shop floor** — set `godown_id = null`, status stays `available`, write `moved` history.
- **To Sales bill** — autocomplete on `sales` (recent + search by invoice_no/customer). On confirm: insert into `sales_items` with `item_instance_id`, recompute `sales.subtotal/grand_total`, mark instance `sold` (or decrement lot qty), write `sold` history with `ref_table='sales'`.

After EITHER destination is committed, automatically mint NEW sequential stickers for the moved units (one per unique unit; lot units skip mint per your choice) using the existing `mintReprintForSale` helper in `src/lib/relabel.ts` — original row is marked moved/sold, new sticker carries `replaces: <oldId>`. The new stickers open in the existing `ReprintLabelDialog` for printing.

**Hardware lots:** Stock Out asks for qty, decrements `qty_on_hand` on the lot row, reprints the existing lot sticker only (no new ID minted). If qty becomes 0, status flips to `sold`/`moved`.

### Files

- New: `src/components/erp/GodownStockInDialog.tsx`
- New: `src/components/erp/GodownStockOutDialog.tsx`
- New: `src/lib/godown-stock.ts` — helpers: `moveToGodown`, `moveOutOfGodown`, `attachUnitsToSale`, `mintFreshIntoGodown` (wraps existing mint pattern).
- Edit: `src/routes/_app.godowns.index.tsx` — add "Stock In" / "Stock Out" buttons on tile + page header; mount the two dialogs and the existing `ReprintLabelDialog`.
- Reuse: `src/lib/relabel.ts` (`mintReprintForSale`) for the new-sticker mint on stock-out.

### Notes

- No schema changes — `item_instances.godown_id` already exists, `item_history` already supports `moved`.
- Sale total recomputation mirrors what `record_sale` does (subtotal + GST split). Done client-side via `supabase.update` on `sales` after inserting the line.
- "Stock Out" buttons only enabled when a specific godown (not "All") is selected.