# Category → Sub-Category → Item hierarchy

Today the app has a fixed `category` enum (plywood / door / hardware / mica / others) on `products`, and every "item" in inventory is actually a product. The request is to add a real **3-level hierarchy** so the user can group products like:

```text
Plywood  (Category)
  └── 18MM 8x4 LC  (Sub-Category)
        ├── Blackhud
        ├── Comet
        ├── Kisan
        ├── Platinium
        ├── Rocktouch
        ├── Salimar
        ├── Supreme Go
        └── VELOCITY
```

…and have Purchase/Sales bill rows first suggest sub-categories, then suggest items inside the chosen sub-category.

## Data model (new tables)

1. `product_subcategories`
   - `id uuid pk`
   - `category product_category not null` (reuses existing enum: plywood / door / hardware / mica / others)
   - `name text not null` (e.g. `"18MM 8*4 LC"`)
   - `dimension_label text` (free text shown in suggestions, optional)
   - `default_price_per_sqft numeric`, `default_price_per_pc numeric` (optional defaults pushed into new items)
   - `active bool default true`, timestamps
   - unique (`category`, `lower(name)`)

2. Add `subcategory_id uuid` (nullable, FK-by-convention to `product_subcategories.id`) on **`products`**.
   - Existing products stay as-is (NULL sub-category = "Uncategorized"). No data migration needed.
   - When a sub-category is chosen on the New Product dialog, its `category` is auto-filled and locked, and `default_price_*` prefill the price field.

3. RLS: same `auth read/write/update/delete` policies as the rest of the app.

No changes to `item_instances` — products are still the "item brand" level; instances remain individual stickers / lots.

## UI changes

### A. Inventory → "Sub-Categories" management
- New tab/page `src/routes/_app.inventory.subcategories.tsx` listing sub-categories grouped by category, with **Add Sub-Category** dialog (fields: Category dropdown, Name, optional default price). Edit / deactivate inline.

### B. New Product dialog (`_app.inventory.index.tsx`, existing `NewProductDialog`)
- Replace the bare Category select with a two-step block:
  1. **Category** select (existing 5 values).
  2. **Sub-Category** combobox filtered by chosen category, with an inline "+ Create new" option that opens a sub-dialog and inserts into `product_subcategories`.
- "Name" field becomes the **item brand name** (Blackhud, Comet…). Tooltip: "Brand / item name under this sub-category."
- Persist `subcategory_id` on the product. Everything else (sizes, QR, pricing, dim-unit logic, sqft conversion, PCS to add) stays exactly as built.

### C. Inventory list
- Add a third grouping level: Category → Sub-Category → Products. Use a collapsible tree (Sub-Category rows show product count + total qty). Search box filters across all three levels.

### D. Purchases bill (`_app.purchases.new.tsx`) and Sales bill (`_app.sales.new.tsx`)
Each line row currently has a single product picker. Replace with a **two-step picker**:
1. First input suggests **Sub-Categories** (typeahead over `product_subcategories.name`, optionally scoped by Category chip).
2. Once a sub-category is chosen, the second input suggests **Items (products)** whose `subcategory_id` matches — typeahead on product name. Selecting an item fills rate from the existing product/instance defaults.
- A small "Change sub-category" link resets the row to step 1.
- For backwards compatibility, products without a sub-category appear under a synthetic "Uncategorized" group so existing flows keep working.

### E. Scan flow
Scanning a barcode/QR continues to resolve directly to a product/instance — no change.

## Implementation order
1. **Migration**: create `product_subcategories`, add `subcategory_id` to `products`, RLS policies.
2. Sub-category management page + reusable `<SubCategoryCombobox>` component (used by New Product, Purchases, Sales).
3. Wire into New Product dialog (keep all current size/QR/pricing logic intact).
4. Wire into Purchases new bill and Sales new bill rows.
5. Inventory list grouping update.

## Technical notes
- New combobox lives in `src/components/erp/SubCategoryCombobox.tsx` and `ItemPicker.tsx` (item-by-subcategory). Both use shadcn `Command` + `Popover`.
- Suggestions query: `supabase.from("product_subcategories").select("id,name,category").eq("active", true).ilike("name", `%${q}%`).limit(20)`. Items: `.from("products").select("id,name,default_price,unit").eq("subcategory_id", subId).ilike("name", `%${q}%`)`.
- No changes to `item_instances`, sales/purchases tables, or invoicing math.

## Out of scope
- Migrating existing products into sub-categories (user can re-assign manually from inventory list, or leave under Uncategorized).
- Per-sub-category QR templates (uses existing per-item QR).

Confirm and I'll run the migration and ship the UI.
