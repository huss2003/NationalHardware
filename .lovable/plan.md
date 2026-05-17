# Hardware & Door Manufacturing ERP — Build Plan

A scan-first, card-based warehouse ERP. Unit-level tracking is the spine: every physical item has its own ID, barcode, QR, history, and status.

## Stack

- React + TanStack Start (existing template), Tailwind, shadcn/ui
- Supabase: Postgres + Auth + Storage + Realtime
- Auth model: **Shared device + 4–6 digit PIN per user**. One Supabase auth session per device (device account); active staff identity stored in app state and stamped on every action.
- Region: **India — INR ₹, GST (CGST/SGST/IGST), HSN per product**
- Barcode/QR: `bwip-js` (barcodes), `qrcode` (QR), print via browser `@page` CSS
- Label printing: **both thermal (50×25mm) and A4 sticker sheets**, user toggles in print preview
- PDFs (invoices, reports): `@react-pdf/renderer`
- Charts: `recharts`
- Scanner input: USB HID (keyboard-wedge) + mobile camera via `@zxing/browser`

## Design system

- Dark premium left sidebar, light content area, large cards, bold type, big touch targets
- Status color tokens: AVAILABLE / SOLD / DAMAGED / USED / RETURNED / RESERVED
- Every action button minimum 56px; primary CTAs full-width on mobile

## Information architecture (routes)

```
/login                          PIN pad
/_app                           Authenticated shell (sidebar + topbar)
  /dashboard
  /inventory                    Card grid of products
  /inventory/$productId         Product detail + units list
  /inventory/scan               Universal scan-to-lookup
  /units/$itemId                Single physical item timeline
  /purchases                    List
  /purchases/new                Purchase entry wizard
  /purchases/$id                Detail + reprint labels
  /sales                        List
  /sales/new                    Scan-first POS
  /sales/$id                    Invoice + print
  /production                   Orders list
  /production/new               Create order (pick BOM)
  /production/$id               Scan materials, finish, mint DOR-xxxxxx
  /bom                          Bill of Materials manager
  /reports                      Hub
  /reports/$type                Sales/Purchase/Stock/Movement/Production/Damage/Profit
  /employees                    Staff + PIN management (admin)
  /alerts                       Notifications inbox
  /settings                     Shop info, GST, label sizes, prefixes, recycle bin
```

## Database (Supabase, all RLS-enabled)

Core entities:
- `shop_users` — id, name, pin_hash, role (`admin|billing|store|production`), active, login history
- `suppliers`, `customers`
- `products` — id, name, sku, category (`plywood|hardware|door|other`), prefix (PLY/HDR/DOR/…), hsn, gst_rate, unit, image_url, reorder_level, default_cost, default_price
- `bom` + `bom_items` — finished product → required components & qty
- `purchases` — supplier, bill_no, bill_date, bill_image_url, totals, created_by
- `purchase_items` — product, qty, rate, tax
- `item_instances` — **unit-level**: id (PLY-000123), product_id, source_purchase_item_id, status, current_location, cost_price, barcode_payload, qr_payload, created_at
- `sales` — customer, invoice_no, totals (subtotal, CGST, SGST, IGST, discount, grand_total), payment_mode (cash/credit), created_by
- `sales_items` — item_instance_id (nullable for bulk), product_id, qty, rate, tax
- `production_orders` — finished_product_id, qty, status, assigned_to, created_by
- `production_materials` — order_id, item_instance_id (consumed), product_id, qty
- `produced_items` — order_id → new item_instance_id (the door)
- `item_history` — item_instance_id, event_type, ref_table, ref_id, actor_user_id, notes, created_at (append-only, written by triggers)
- `id_sequences` — prefix → next number (atomic via `update … returning`)
- `recycle_bin` — soft-deleted invoices/purchases payload + deleted_by
- `audit_log` — every write, actor, before/after
- `alerts` — type, severity, payload, read flag

Triggers:
- On `purchase_items` insert → mint N `item_instances` and N `item_history` rows (`PURCHASED`)
- On `sales_items` insert with item_instance_id → set status `SOLD`, write history
- On `production_materials` insert → set source instance `USED_IN_PRODUCTION`
- On `produced_items` insert → mint DOR-xxxxxx instance with status `AVAILABLE`
- Block direct UPDATEs to `item_instances.status` outside SECURITY DEFINER RPCs

RPCs (SECURITY DEFINER, called from client):
- `mint_item_instances(product_id, qty, purchase_item_id)`
- `record_sale(payload)` — atomic invoice + stock decrement
- `consume_material(order_id, item_id, actor_id)`
- `complete_production(order_id, qty)`
- `mark_damaged(item_id, reason, actor_id)`
- `soft_delete_invoice(sale_id, reason, actor_id)` (admin only)

RLS: all reads gated to authenticated; writes gated by role via `has_role(actor, role)` helper. Actor = active PIN user passed in payload and validated server-side against device session.

## Module specs

**Auth / PIN**
- Single Supabase device account per shop terminal (admin sets up)
- `/login` shows large numeric PIN pad → resolves `shop_users` row, stored in Zustand + sessionStorage
- Topbar shows active user avatar + "Switch user" (re-prompt PIN)
- Every mutation includes `actor_user_id`

**Inventory**
- Card grid: product image, in-stock count (computed: `item_instances` where status=AVAILABLE), low-stock badge, category chip
- Tap card → product detail with paginated unit list, filter by status, "Scan a unit" big button
- Universal `/inventory/scan` route: type/scan ID → routes to `/units/$itemId`

**Purchases**
- Wizard: supplier → add products (visual selector, +/- big buttons for qty) → rates → bill image upload → save
- On save: mints unique IDs, generates barcode+QR payloads, shows **Print Labels** screen
- Print Labels: toggle thermal vs A4, preview, bulk print all or reprint by range

**Sales (scan-first POS)**
- Top: customer picker (optional), payment mode, GST toggle
- Big scan input always focused; supports rapid USB scans and mobile camera
- Scanned item card appears with green pulse; **red full-screen warning** if already SOLD/DAMAGED
- Auto-fills qty=1, rate=last sale price (editable with big +/- )
- Discount %, GST split auto-computed (intra/inter-state from customer state)
- Save → thermal/A4 invoice PDF, stock decremented atomically

**Production**
- Create order: pick finished product (must have BOM) + qty → system lists required materials
- Scan each material instance; progress bar fills; cannot finish until BOM satisfied
- On finish: mints DOR-xxxxxx units, consumed items → `USED_IN_PRODUCTION`
- Worker assignment + timestamps

**BOM**
- Per finished product: components + qty, versioned

**Item history / timeline**
- `/units/$itemId` — vertical timeline of events with actor, time, links to source docs
- Big status pill at top, current location, cost, sale info if sold

**Dashboard**
- Cards: today sales ₹, today purchase ₹, stock value ₹, low-stock count, production today, pending credit ₹
- Charts: 14-day sales trend, top products, status mix
- Recent activity feed + open alerts

**Reports**
- Daily sales, purchase, stock, item movement, employee activity, production, damaged, profit
- Filters: date range, product, supplier, customer, user
- Export: PDF, Excel (`xlsx`), print view

**Employees (admin)**
- CRUD staff, set/reset PIN, role, active toggle
- Login history view

**Alerts**
- Auto-generated: low stock (≤ reorder_level), damaged item logged, failed scan streak, pending payment > N days
- Bell icon in topbar with unread count

**Settings**
- Shop info (name, GSTIN, address for invoices)
- ID prefixes per category
- Label size presets
- Recycle bin (admin-only restore)
- GST defaults

## Security rules

- No UI for manual `item_instances.status` edits; only via RPCs
- All writes go through audit_log trigger
- Invoice/purchase delete = soft delete to recycle_bin (admin only)
- "Critical actions" (delete, price override > X%, status force-change) require admin PIN re-entry modal

## Storage buckets

- `bill-images` (private) — purchase bill scans
- `product-images` (public) — catalog
- `invoices` (private) — generated PDFs

## Build order (single pass, all modules)

1. Supabase schema + RLS + RPCs + triggers + seed
2. Auth shell: device login, PIN pad, sidebar layout, role guards
3. Products + suppliers + customers CRUD with image upload
4. Purchase module + ID minting + label generator + print preview
5. Inventory card grid + product detail + unit timeline + universal scan
6. Sales POS scan-first + GST invoice PDF + thermal print
7. BOM manager
8. Production orders + material scanning + finished good minting
9. Dashboard with live data
10. Reports hub with PDF/Excel export
11. Employees + alerts + settings + recycle bin
12. End-to-end QA pass (purchase → label → sell, purchase → produce → sell door)

## Out of scope (call out)

- Native mobile apps (web is responsive + camera scan works in mobile browsers)
- Multi-shop / multi-warehouse (single shop in v1; schema leaves room for `location`)
- E-way bill / Tally integration
- OCR on bill images (stored as reference only, per your spec)

## Confirm before I start

Reply "go" and I'll implement in the order above. Speak up now if any module priority should shift or a field is missing.
