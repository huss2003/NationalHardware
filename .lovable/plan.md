## Goal
Add a tabbed multi-bill system to `/sales/new` so the user can open up to **5 independent sale bills** at once (matching the uploaded screenshots: "Sale #1 … Sale #5" tabs with a `+` to add and `×` to close each). Every bill keeps its own customer, items, payment, discount, godown source, and totals — **no data is shared/merged between bills**. Tabs persist across page refresh, and saving one bill closes only that tab.

## Approach
The current route file is a single ~819-line `NewSale` component that mixes:
- **Per-bill state** — customer, payment mode, discount, lines, source godown, draft picker, scan warnings, busy flag.
- **Shared reference data** — customers, products, sub-categories, godowns, known prefixes.

I'll split these: shared data is fetched once in a container; per-bill state moves into a reusable form component instantiated once per tab.

```text
NewSale (route container)
├── fetch shared data once (customers, products, subcats, godowns, prefixes)
├── tab bar:  [Sale #1] [Sale #2] … [+]      (close × on each, max 5)
└── render ALL open bills, only the active one visible (others hidden)
        SaleBillForm  (tab 1)  ← own isolated state
        SaleBillForm  (tab 2)  ← own isolated state
        …
```

Keeping every form **mounted but hidden** (via a `hidden` class) is what guarantees each bill's state survives tab switches with zero cross-contamination.

## Changes

### 1. New component `src/components/erp/SaleBillForm.tsx`
- Move all per-bill state, effects, handlers, and the entire JSX (header, scanner strip, scan warning, sheet grid, sticky totals footer, QuickCreateParty dialog) out of the current `NewSale` into this component.
- Props: `tabId`, `active`, `customers`, `products`, `subcats`, `godowns`, `knownPrefixes`, `onCustomerCreated`, `onSaved(tabId)`.
- Stop fetching reference data here — receive it via props.
- Gate global side-effects on `active` so background tabs don't steal input:
  - F2/F3 keyboard shortcuts.
  - The hidden auto-focus `ScanInput`.
- **Persistence:** read/write this bill's serializable state (customerId, paymentMode, discount, lines, sourceGodownId) to `sessionStorage` under `sale_tab_<tabId>` — restore on mount, save on change.
- **Post-save:** `finalize()` no longer navigates away. On success it clears this tab's stored draft and calls `onSaved(tabId)`. (Door flow `pending_door_lines` restore stays, targeting the active tab.)

### 2. Rewrite route `src/routes/_app.sales.new.tsx` as the container
- Fetch shared reference data once (customers, products, subcats, godowns, prefixes) — same queries currently in the effect.
- Manage `tabs: { id: string }[]` (max 5) and `activeId`, both persisted to `sessionStorage` (`sale_tabs`) so open tabs survive refresh.
- Render the **tab bar** styled like the screenshot: pills labelled `Sale #1…#N`, a `×` close button per tab (closing also removes its `sale_tab_<id>` storage; minimum 1 tab), and a `+` button to add a new blank tab (disabled at 5).
- Render one `SaleBillForm` per tab; wrap each in a container that is `hidden` unless it's the active tab.
- `onCustomerCreated` updates the shared customers list so a party created in one bill is available to all.
- `onSaved(tabId)`: remove that tab; if it was the last one, replace it with a fresh blank tab so the screen always has at least one bill. Show the existing "Sale recorded" toast.

### 3. Keep behavior identical within each bill
No changes to `record_sale` RPC, totals math, scan validation, door flow, or WhatsApp share — they simply run inside whichever form is active.

## Technical notes
- Tab IDs are generated with `crypto.randomUUID()` and used as React keys and sessionStorage suffixes.
- Hidden forms use `hidden` (display:none); the draft dropdown uses `getBoundingClientRect`, which only runs while focused — a hidden input can't be focused, so there's no positioning glitch.
- Persistence stores only plain data already in state; no DB/schema changes.

## Verification
- Open `/sales/new`: one "Sale #1" tab shows the normal form.
- Click `+`: "Sale #2" opens blank; add items to #2, switch back to #1 — #1 is unchanged (no merge). Confirm up to 5 tabs, `+` disabled at 5.
- Add different customers/items per tab and confirm totals are independent.
- Refresh the page: open tabs and their data reload.
- Save one tab: that tab closes, others remain; saving the only tab leaves a fresh blank bill.
- `×` closes a tab and drops its data.
