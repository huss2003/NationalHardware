# Parameterized Stock: Item → Finish (P1)

## Goal
In your Google Sheet each **Item** (e.g. `10" CHANNEL`) has several **finishes** under *P1 (Finesh)* (e.g. `BQ`, `GODREJ`, `HATTICH`…), each with its own unit. You want: when billing/purchasing, the user first picks an item, then must pick a finish — and each item+finish keeps its **own separate stock**.

## How it will work
Each **item + finish** becomes its own stock line in your catalog (its own on‑hand quantity, its own purchases/sales history). The current app already tracks stock per catalog item, so making each finish its own catalog entry gives you "separate stock per finish" automatically, without rebuilding the inventory/scanning engine.

The item picker in **New Sale** and **New Purchase** gets one extra step:

```text
Sub-category  ─▶  Item (e.g. 10" CHANNEL)  ─▶  Finish (BQ / GODREJ / …)  ─▶ added to bill
```

- Picking a finish is **required** for any item that has finishes (you cannot add the bare item).
- Items that have no finishes keep working exactly as today (no extra step).
- Each line shows the item with its finish, e.g. `10" CHANNEL — GODREJ`, on screen, on bills and in reports.

## What gets imported
All ~116 items and ~584 finishes from the sheet:
- Where an item already exists in your catalog, it is reused as that item's **first** finish (so its existing history and stock stay intact), and the remaining finishes are added as new entries copied from it (same unit, GST, HSN, prices, sub-category).
- Items not yet in your catalog are created fresh from the sheet (using the sheet's Unit), grouped under the item, one entry per finish.
- The sheet's per-row Unit is applied to each finish.

## Steps

### 1. Database (migration)
Add two columns to the `products` table:
- `item_group` (text) — the parent item name used for grouping (e.g. `10" CHANNEL`).
- `finish` (text) — the P1 finish value (e.g. `GODREJ`); empty for items without finishes.

Add an index on `item_group` for fast grouping. No changes to sales, purchases, stock, scanning or minting logic are required — those already key on the catalog item.

### 2. Import the sheet data
A one-time import (run with admin credentials, reading the sheet through the connected Google Sheets connection):
- Parse the sheet into item → [finishes] with each finish's unit.
- Match items to existing products by normalized name.
- Update the matched product: set `item_group` and the first `finish`.
- Insert new product rows for the remaining finishes (cloning prefix/category/unit/HSN/GST/prices/sub-category from the matched item).
- Create brand-new grouped products for unmatched sheet items.
- Newly created finishes start at 0 stock; you build stock per finish through normal purchases.

### 3. Sales screen (`SaleBillForm` inline picker)
- Add a finish stage: after an item with finishes is chosen, show that item's finishes; selecting one adds the line.
- Block adding an item that has finishes until a finish is selected (required).
- Show `item — finish` as the line name.

### 4. Purchase screen (`SubCategoryThenItemPicker`, used by New Purchase)
- Same three-stage flow (sub-category → item → finish), with finish required for items that have finishes.
- Selecting a finish adds the purchase line for that finish's catalog entry, so minted units stock that specific finish.
- Show `item — finish` as the line name.

### 5. Verify
- New Purchase: pick an item with finishes, confirm finish is required, save, and confirm units mint against the chosen finish only.
- New Sale: confirm the same item's other finishes have independent stock and the finish appears on the line.
- Confirm items without finishes still add in one step.

## Technical notes
- Model: finish is a product-level variant. `products.item_group` + `products.finish` identify a variant; stock stays per `product_id` via `item_instances`, so `record_sale`, `mint_item_instances`, and `stock_by_product` are untouched.
- Pickers group candidate products by `item_group`; a group with >1 finish (or any non-empty `finish`) renders the extra finish stage; single, finish-less items skip it.
- Line display composes `name` + `finish`; stored `sales_items`/`purchase_items` rows continue to reference only `product_id`.
- Inventory and product-list pages keep working unchanged; finishes simply appear as distinct catalog entries (a later enhancement could group them visually if desired).

## Scope
DB: add two columns + index to `products` (additive, non-breaking). Data: one-time import from the sheet. Frontend: item-picker changes in the Sales and Purchase entry screens plus line-name display. No changes to stock math, scanning, returns, or reports logic.
