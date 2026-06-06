# Fix Door page tablet / 9-inch UX

## Problem
On a ~9-inch device (viewport ≈1000px), the Door page scrolls horizontally and content gets cut off on the left (as in the screenshot). Verified in the preview: at 1024×768 the page's `scrollWidth` (1050) exceeds the viewport (1000) → unwanted sideways scroll.

Two causes:
1. **Native `<select>` won't shrink.** The "Customer / Name" dropdown sits in a `flex` row inside a grid column with no `min-w-0`. A native select keeps the intrinsic width of its longest option (e.g. a long customer name), pushing its grid column — and the whole page — wider than the screen.
2. **Forms are too dense for the width.** Both the General "Add door" form and the Vypaari form use `md:grid-cols-3`, which is tight on a 9-inch screen and contributes to overflow.

## Fix

### 1. Stop the horizontal overflow (`src/routes/_app.door.tsx`)
- Add `min-w-0` to the flex wrappers around the customer dropdowns (both General and Vypaari forms).
- Give the native `<select>` elements `w-full min-w-0` so they shrink to their track instead of forcing width.
- Add `min-w-0` to grid item wrappers (the `Field` component) so no field can blow out its column.

### 2. Make the forms breathe on tablet / 9-inch
- Change the dense form grids from `grid-cols-1 md:grid-cols-3` to a progressive `grid-cols-1 sm:grid-cols-2 xl:grid-cols-3` so a 9-inch screen shows a comfortable 2-column layout and only very wide screens get 3 columns. Applies to:
  - General header card (Order No. / Date / Customer)
  - General "Add door" draft grid
  - Vypaari form grid
- Let the "Add door" footer (sqft summary + button) and the order footer (Notes + Grand total + actions) wrap gracefully with `flex-wrap` and full-width notes on small screens, so the action buttons never get pushed off-screen.

### 3. Keep wide data tables contained
- The "Doors in this order" and "Recent orders" tables already live in an `overflow-auto` wrapper, so they scroll *inside their card* rather than stretching the page. Add `min-w-[640px]` (or similar) to those tables so columns stay readable while scrolling happens only within the card — never at the page level.

## Verification
- Reload `/door` in the preview at 1024×768 (9-inch) and confirm `scrollWidth == clientWidth` (no page-level horizontal scroll).
- Check at 768px (portrait tablet) and ~390px (phone) that the forms stack to 1–2 columns, the customer dropdown + "New" button fit, and the Save/Add buttons stay on screen.
- Confirm the data tables scroll horizontally only within their own card.

## Scope
Frontend-only, limited to `src/routes/_app.door.tsx`. No data, schema, or business-logic changes. The same `min-w-0` safeguard pattern can be rolled out to other form-heavy pages later if you see the same issue elsewhere.
