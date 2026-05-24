# Add alternate unit (sqft) to New Product dialog

Apply only to the **Plywood** and **Door** categories in `NewProductDialog` (`src/routes/_app.inventory.index.tsx`). Hardware / Mica / Others stay unchanged.

## Units

- **Plywood** — main unit = **Feet** (Length, Breadth in ft), alternate = **Square Feet**.
  Formula: `sqft = L_ft × B_ft` (and reverse).
- **Door** — main unit = **Inches** (Length, Breadth in inches), alternate = **Square Feet**.
  Formula: `sqft = L_in × B_in ÷ 144` (and reverse).

These match the existing formulas already shown on the product detail page (`_app.inventory.$productId.tsx`).

## Dialog changes

Replace the current "Length / Breadth" two-field grid with a three-field block:

```text
[ Length ({unit}) ]  [ Breadth ({unit}) ]
[ Area (sqft) — alternate unit ]
```

Behavior (two-way live sync, no submit needed):

1. Editing **Length** or **Breadth** → recompute **Area** instantly using the category formula.
2. Editing **Area** directly → recompute **Breadth** from `Area / Length` (reverse formula, doors multiply by 144 first). If Length is empty/zero, leave Breadth untouched and just store the entered Area.
3. The unit label next to Length/Breadth switches with category (`ft` for plywood, `in` for door).
4. Door area formula in the preview line becomes `L × B ÷ 144`; plywood stays `L × B`.

Use a small `lastEdited` ref/state (`"dim" | "area"`) to avoid feedback loops between the two effects.

## Pricing

- Price input stays **₹ per sqft** for both Plywood and Door (already the case).
- `unitPrice = pricePerSqft × areaSqft` — unchanged.

## Persistence

When inserting `item_instances` for Plywood/Door:
- `length_value`, `width_value` → store in their **native unit** (ft for ply, in for door).
- `dimension_unit` → `"ft"` for plywood, `"in"` for door (currently hard-coded to `"ft"`).
- `area_sqft` → always the computed/entered sqft value.
- `qr_payload`: keep `length_ft`/`width_ft` for plywood; for door switch to `length_in`/`width_in` plus `area_sqft`.
- `sizeLabel`: `"LxB ft"` for plywood, `"LxB in"` for door.

## Validation

- Require either (Length AND Breadth) OR a non-zero Area before submit.
- Require `pricePerSqft > 0`.

## Out of scope

- Hardware/Mica/Others input (unchanged single Size field, price per pc).
- Existing inventory rows / DB schema — no migration needed; `dimension_unit` column already supports `"in"`.
