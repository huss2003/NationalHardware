## Goal
Show standalone products (items with no sub-category) in the first-stage suggestion list on `/sales/new`, alongside sub-categories — same behaviour already in `/purchases/new`.

## Root cause
`src/routes/_app.sales.new.tsx` does NOT use the shared `SubCategoryThenItemPicker`. It has its own inline picker (lines ~53–171, ~613–690) whose first-stage `draftSuggestions` only reads from `subcats`. Standalone products are never merged in, so the dropdown header stays "SUB-CATEGORIES" with only sub-cats visible. Purchases already works because it uses the shared picker (which was fixed last turn).

## Changes (single file: `src/routes/_app.sales.new.tsx`)

1. **`draftSuggestions` memo (~line 160)** — when `draftSub` is null, build the pool as:
   - sub-categories tagged `__kind: "sub"`, plus
   - products where `subcategory_id == null && active` tagged `__kind: "item"`.
   Filter by query, slice ~14.

2. **`handleDraftCommit` (~line 261)** and the suggestion `onClick` (~line 667) — branch on `pick.__kind`: if `"item"`, call `addProductLine(pick, 1)`; otherwise `pickDraftSub(pick)`.

3. **Dropdown header (~line 656)** — change `"Sub-categories"` label to `"Items & Sub-categories"` when at first stage.

4. **Suggestion row meta (~line 677)** — for `__kind === "item"`, render a small "ITEM" badge before the category text to distinguish from sub-cats.

5. **Input placeholder (~line 634)** — change first-stage placeholder to `"Scan barcode or type item / sub-category…"`.

No changes to DB, purchases page, or shared picker.

## Verification
- Open `/sales/new`, focus the product cell — dropdown header reads "ITEMS & SUB-CATEGORIES" and lists the 16 Mica items (Ebony, Glossy White, …) below the Plywood sub-categories.
- Typing `mica` filters to Mica items + Mica sub-cat (if any).
- Clicking an item adds it as a line directly; clicking a sub-cat drills into its items as before.
