# Parameterized Stock: Cleaner Sales picker, Inventory parameters & Admin direct stock-in

## Data model (already in place)
- `products.subcategory_id` → **sub-category** (e.g. `Alternate`, `14 Number Birangee`)
- `products.item_group` → the underlying item (e.g. `12MM 8*4 ALT`)
- `products.finish` → the **parameter** (e.g. `Comet`, `1.25*14`)
- Each item+finish is its own product row with its own stock. No schema change needed for the picker/inventory work.

## 1. Sales picker — Sub-category → Parameter only
In `src/components/erp/SaleBillForm.tsx`:
- **Remove the middle "item group" stage.** The flow becomes two levels:
  1. **Stage A:** list sub-categories first, then standalone items (products with no sub-category) below them, as before.
  2. **Stage B:** after a sub-category is picked, show a **flat list of every product (parameter)** in it — no separate item step.
- Each Stage-B entry is labelled by its `finish` (the parameter). When the same finish name appears under different items, show the `item_group` as small grey subtitle text so the two are distinguishable.
- Sub-categories with **no parameters** (plain items) simply list their items in Stage B; picking one adds it.
- If a sub-category resolves to exactly **one** product, auto-add it on pick (proceed directly, no second click).
- Standalone items keep adding in one step from Stage A.
- Line name stays `Item — Finish` (e.g. `12MM 8*4 ALT — Comet`); when there is no finish it's just the name.

```text
Sub-category ─▶ Parameter (finish)  ─▶ added to bill
(no parameters) Sub-category ─▶ Item ─▶ added to bill
Standalone item ─▶ added directly
```

The `buildItemPool` / group-stage logic (`draftGroup`, `openDraftGroup`, `addFinishAndReset`) is replaced by a simple "products in this sub-category" list.

## 2. Inventory — show parameters under sub-categories
In `src/routes/_app.inventory.index.lazy.tsx`:
- The page already groups rows by sub-category. Make the **parameter visible on each row**: when a product has a `finish`, render the finish as a badge next to the item name (e.g. `12MM 8*4 ALT` with a `Comet` chip), and use `item_group` as the row's primary label instead of the raw `name` when they differ.
- Add a small "Parameter" sub-label/column so a sub-category like `Alternate` clearly reads as a list of items × parameters, each with its own stock level (the existing stock bar already reflects per-finish stock).

## 3. Admin-only direct stock-in + label printing
A new screen to add real, labelled stock for a sub-category + parameter **without a supplier bill** (opening stock / manual mint).

### a. Database (migration)
Add an RPC `mint_stock_entry(_product_id uuid, _qty int, _cost numeric, _actor_user_id uuid)` that mirrors the minting logic in `mint_item_instances` but with **no purchase_item**:
- For `hardware` category: increment the shared lot row (or create one) by `_qty`.
- Otherwise: mint `_qty` unique `item_instances` via `next_item_id(prefix)`.
- Set `cost_price = _cost`, build the same `qr_payload` shape, and write `item_history` rows with event `purchased` and note `Manual stock entry`.
- Return the minted `item_instances` so the UI can print labels.
- `SECURITY DEFINER`, `search_path = public`, granted to `authenticated`.

### b. Screen
New route `src/routes/_app.inventory.stock-entry.tsx` (Admin-only):
- Guard: redirect non-admins to `/inventory` using the `isAdmin` helper from `src/lib/roles.ts`; only show its sidebar entry for admins.
- UI: the same two-stage **Sub-category → Parameter** picker (reuse `SubCategoryThenItemPicker`, updated to the parameter-only flow), plus **quantity** and **cost price** inputs and an optional **godown** selector.
- On submit: call `mint_stock_entry`, then open the existing `ReprintLabelDialog` / `LabelSheet` with the returned units so the admin can **print labels** immediately (thermal/A4).
- Link the screen from the Inventory header (Admin only).

### c. Picker reuse
Update `src/components/erp/SubCategoryThenItemPicker.tsx` to the same parameter-only flow (drop the item-group stage) so Purchases, the Admin stock-entry screen, and Sales behave consistently.

## Verify
- Sales: pick `Alternate` → see parameters (with item subtitles) → add; pick a single-product sub-category → auto-adds; standalone item still one-click.
- Inventory: expand a sub-category → each row shows its parameter and independent stock.
- Admin stock-entry: mint N units for a chosen parameter, confirm stock rises for that exact finish only, and labels print. Confirm employees can't open the screen.

## Technical notes
- No changes to `record_sale`, `mint_item_instances`, returns, or reports — stock stays per `product_id`.
- The new RPC is additive; existing purchase-based minting is untouched.
- Admin gating is enforced both in the route component and in the sidebar.
