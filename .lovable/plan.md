# Restructure Sub-Category → Item flow

## 1. Sales & Purchase (`_app.sales.new.tsx`, `_app.purchases.new.tsx`)

**Remove** the standalone "Sub-Category / Item" block above the line-items grid.

**Replace** the current product autocomplete inside each row's first cell (Item column) with a single inline picker that works in two stages:

- Stage A — empty / typing: dropdown lists matching **Sub-Categories** (from `product_subcategories`, filtered by typed text). Each row shows the sub-category name + category badge.
- Stage B — after the user clicks a sub-category: the same dropdown switches to list **Items** belonging to that sub-category (`products.subcategory_id = chosen.id`), filtered by further typing. A small "← back to sub-categories" / chip showing the picked sub-category appears at the top so the user can reset.
- Selecting an item fills the row exactly like today (price, unit, alt-unit, GST, source pickers all unchanged).
- Keyboard: ↑/↓ to move, Enter to select, Esc to close, Backspace on empty input returns to Stage A.

No changes to totals, payment, customer block, scan input, or "Add Door" custom flow.

## 2. Inventory list (`_app.inventory.index.tsx`)

Replace the current flat product table with a **sub-category-grouped** view:

```text
▸ Plywood — 18MM 8*4 LC          12 items
▸ Plywood — 12MM 8*4              5 items
▸ Door  — Teak Flush 7x3          3 items
▸ Uncategorized                   4 items
```

- Each row is a collapsible header (chevron). Clicking expands and renders the existing product table rows for that sub-category inline.
- Search box filters across sub-category name + item name; matching groups auto-expand.
- "Uncategorized" bucket holds products with `subcategory_id IS NULL`.
- All existing product actions (edit, QR, stock, delete, row click → detail) stay intact.

## 3. Shared picker component

Add `SubCategoryThenItemPicker` (new file `src/components/erp/SubCategoryThenItemPicker.tsx`) implementing the two-stage suggestion described above. Sales and Purchase rows both use it. The existing `SubCategoryPicker` / `ItemBySubCategoryPicker` components are removed from Sales/Purchase imports (kept only where Inventory's "New product" dialog still needs `SubCategoryPicker` for creation).

## Out of scope

- Sub-category management page (`_app.inventory.subcategories.tsx`) and DB schema — unchanged.
- New product dialog still uses the existing sub-category picker.
- No pricing/calculation logic changes.
