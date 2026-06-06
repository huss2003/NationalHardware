## Goal
Make ScanFlow comfortable to use on phones and tablets — primarily 9-inch devices — and make text darker and bolder for easy reading. Desktop stays essentially the same.

## Current problems
- The sidebar is a fixed 240px column always on screen (`_app.tsx` → `AppSidebar`). On a 9" portrait/phone it eats most of the width and there's no way to hide it.
- Page padding is a hard `px-8` (2rem each side) and the page titles are a fixed 32px — too wide/large on small screens.
- `--muted-foreground` (gray secondary text) is fairly light and body/sidebar text weight is light, hurting visibility.

## Changes

### 1. Responsive app shell (`src/routes/_app.tsx` + `src/components/layout/AppSidebar.tsx`)
- Keep the fixed sidebar on large screens (`lg` / 1024px+ — covers 9" landscape).
- Below `lg` (9" portrait, phones): hide the fixed sidebar and add a slim sticky top bar with the ScanFlow logo and a hamburger button.
- Tapping the hamburger opens the existing sidebar inside a slide-out `Sheet` (shadcn drawer already in the project). Selecting any nav link or signing out closes the drawer.
- Refactor `AppSidebar` so the same nav list renders both in the static desktop column and inside the mobile drawer (extract the inner content; add an `onNavigate` callback to close the sheet on click).

### 2. Responsive page chrome
- `src/components/erp/PageHeader.tsx`: padding `px-4 sm:px-6 lg:px-8`, top/bottom padding reduced on small screens, and title scales (`text-2xl sm:text-3xl lg:text-[32px]`). Actions wrap cleanly.
- Page content wrappers: replace the hard `px-8` with `px-4 sm:px-6 lg:px-8` across the route files (≈22 files) so content isn't cramped against the edges on small screens. KPI/stat grids already use responsive `grid-cols-*`, so they reflow automatically.

### 3. Tables on small screens
- Data tables already render inside a horizontally-scrollable wrapper, so they stay usable. I'll verify the key list pages (Sales, Purchases, Inventory, Ledger) scroll rather than clip, and adjust any `overflow-hidden` card that traps the scroll.

### 4. Darker, bolder fonts (`src/styles.css`)
- Darken secondary text: `--muted-foreground` from `oklch(0.55 …)` to about `oklch(0.44 …)` so hints/labels are clearly readable.
- Increase base body weight (≈500) and bump heading weight to 700, and make sidebar links a touch bolder.
- Keep antialiasing/letter-spacing tweaks so bolder text still looks clean.

### 5. 9-inch / tablet tuning
- Treat `lg` (1024px) as the "full layout" breakpoint so a 9" tablet in landscape gets the desktop sidebar, while portrait/phone use the drawer.
- Make primary action buttons and nav rows comfortable touch targets (min ~44px height) on small screens.

## Verification
- Preview at mobile (~390px), tablet portrait (~768px), and 9" landscape (~1024px) to confirm the drawer toggles, content has breathing room, tables scroll, and text reads darker/bolder. Adjust spacing where anything overflows.

## Technical notes
- No backend, schema, or data changes — purely layout/styling.
- Reuses existing `Sheet` component and `useIsMobile` hook; no new dependencies.
- Design tokens stay in `src/styles.css` (Tailwind v4 `@theme`/`:root`).