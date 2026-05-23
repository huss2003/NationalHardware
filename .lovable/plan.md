## Goal

Rework Sales Returns and Purchase Returns so the user picks items from a checklist after selecting the invoice/bill (scanning becomes optional). Add sticker reprint flows that mint brand-new sequential IDs.

## Sales Returns (`src/routes/_app.sales-returns.index.tsx`)

1. After choosing an Invoice in the dialog, load every `sales_items` row joined with `item_instances` (id, status, product name, rate, gst_rate).
2. Render a checklist table of all items on that invoice:
   - Columns: checkbox · Item ID · Product · Rate · GST · Status badge.
   - Disable + grey-out rows whose status is not `sold` (already returned/damaged) with a small reason tag.
   - "Select all available" toggle in header.
3. Keep the existing ScanInput as an optional shortcut — scanning just toggles the matching row's checkbox.
4. The cart/totals/refund mode/reason block stays, driven from the checked rows.
5. **Reprint stickers (new):**
   - On every checked row add a "Reprint sticker" icon button.
   - Clicking it calls a new helper `mintReplacementSticker(originalItemId)` that:
     - Looks up the original instance's `product_id` to get the prefix.
     - Calls `supabase.rpc("next_item_id", { _prefix })` to allocate the next sequential ID.
     - Inserts a fresh `item_instances` row (status `available`, `is_lot=false`, qty 1, cost_price copied, qr_payload rebuilt with new id) — leaves the old row untouched.
     - Writes an `item_history` row (`event: 'reprinted'` or `'minted'`, `notes: 'Reprint via sales return <return_no?>'`) on both old + new.
     - Opens a print view using existing `LabelSheet` (single-item array) in a Dialog with a "Print" button (`window.print()`).
   - Reprint is allowed any time after the row is checked; no need to save the return first.
6. After "Record Return" save, also surface a "Reprint stickers for returned items" bulk button in a success toast/dialog that reprints all checked items in one LabelSheet.

## Purchase Returns (`src/routes/_app.purchase-returns.index.tsx`)

1. Same checklist treatment: after picking a bill, list every `item_instances` row sourced from that bill's `purchase_items` (already fetched today). Show status badges; disable rows that are not `available`.
2. Scan input stays as an optional helper that toggles a row.
3. Cart/Totals/Status/Reason block unchanged, driven by the checklist.
4. **Reprint sticker for a replacement (new):**
   - Each checked row gets a "Reprint for replacement" button.
   - Clicking opens a small dialog: "This sticker is being returned to the supplier. Mint a new sticker for the replacement piece you received?" with a product picker (default = same product as the returned item) and qty input (default 1).
   - On confirm: for each qty, call `next_item_id(prefix of picked product)`, insert new `item_instances` row (`status='available'`, `is_lot=false`, qty 1, cost_price = original rate, qr_payload rebuilt, `source_purchase_item_id` = original instance's purchase_item_id so it stays tied to that bill), and write an `item_history` row (`event: 'minted'`, ref `purchase_returns`, notes "Replacement for <old id>").
   - Show the new stickers in a printable LabelSheet inline.
5. Save flow unchanged otherwise.

## Shared bits

- New small component `src/components/erp/ReprintLabelDialog.tsx` — wraps `LabelSheet` for one or many items with a Print button.
- New helper `src/lib/relabel.ts` exporting:
  - `mintReprintForSale(originalItemId, actorUserId): Promise<ItemInstance>` (sales-side, same product).
  - `mintReplacementForPurchase(originalItemId, productId, qty, actorUserId): Promise<ItemInstance[]>` (purchase-side, possibly different product).
  - Both build `qr_payload` the same way the SQL function does, ensure `barcode_payload = new_id`.
- No DB schema changes needed — `next_item_id` RPC already exists, `item_instances` and `item_history` accept inserts.

## Technical notes

- Status filter for clickable rows: sales-return enables only `sold`; purchase-return enables only `available`.
- Use the existing `Checkbox` from `@/components/ui/checkbox` for selection.
- Keep `qty_on_hand` semantics: lot/hardware rows skipped from the reprint UI (show a "lot — no sticker" hint) since lots share a single label.
- Print uses existing `LabelSheet` `format='thermal'` (or read from `app_settings.default_label_format`).
- All inserts go through the regular `supabase` browser client (RLS already allows anon/auth writes to these tables per current policies).
