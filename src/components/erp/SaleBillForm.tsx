import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScanInput } from "@/components/erp/ScanInput";
import { useAuth } from "@/lib/auth-store";
import { toast } from "sonner";
import { inr, parseScannedCode } from "@/lib/codes";
import {
  Trash2, ArrowLeft, Check, ScanLine, History,
  Plus, Calendar, MessageCircle, DoorOpen, Warehouse,
} from "lucide-react";
import { useUiConfig } from "@/lib/ui-config";
import { ScanWarning, type ScanWarningKind } from "@/components/erp/ScanWarning";
import { QuickCreatePartyDialog } from "@/components/erp/QuickCreatePartyDialog";
import { PlyWizardDialog } from "@/components/erp/PlyWizardDialog";

// Inactive placeholder product that custom PLY wizard lines reference (sales_items.product_id is NOT NULL).
const PLY_CUSTOM_PRODUCT_ID = "3b53f4d0-550d-4206-b5a7-582a1e18fc09";

type Line = {
  product_id: string; item_instance_id: string | null; name: string;
  qty: number; rate: number; gst_rate: number; hsn?: string | null;
  unit?: string | null; alt_unit?: string | null; alt_conversion?: number | null;
  is_lot?: boolean; max_qty?: number;
  source_godown_id?: string | null;
};

export type ProductRow = {
  id: string; name: string; prefix: string; hsn: string | null;
  default_price: number; gst_rate: number; unit: string;
  alt_unit: string | null; alt_conversion: number | null;
  subcategory_id: string | null;
  item_group?: string | null; finish?: string | null;
};

type Customer = { id: string; name: string; state?: string | null; phone?: string | null };
type SubCat = { id: string; name: string; category: string };
type Godown = { id: string; name: string };

type Props = {
  tabId: string;
  active: boolean;
  /** "scan" = barcode strip + entry grid (default). "tiles" = PLY/MICA/HARDWARE placeholder tiles. */
  entryMode?: "scan" | "tiles";
  customers: Customer[];
  products: ProductRow[];
  subcats: SubCat[];
  godowns: Godown[];
  knownPrefixes: string[];
  onCustomerCreated: (c: Customer) => void;
  onSaved: (tabId: string) => void;
};

type PersistShape = {
  customerId: string;
  paymentMode: string;
  discount: number;
  lines: Line[];
  sourceGodownId: string;
};

export function SaleBillForm({
  tabId, active, entryMode = "scan", customers, products, subcats, godowns, knownPrefixes,
  onCustomerCreated, onSaved,
}: Props) {
  const nav = useNavigate();
  const user = useAuth(s => s.user);
  const cfg = useUiConfig();
  const f = cfg.forms.new_sale.fields;

  const storageKey = `sale_tab_${tabId}`;

  const [customerId, setCustomerId] = useState("");
  const [customerState, setCustomerState] = useState<string>("");
  const [paymentMode, setPaymentMode] = useState("cash");
  const [discount, setDiscount] = useState(0);
  const [lines, setLines] = useState<Line[]>([]);
  const [sourceGodownId, setSourceGodownId] = useState<string>(""); // "" = shop floor
  const [warn, setWarn] = useState<{ kind: ScanWarningKind; msg: string; code?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [createCustomerOpen, setCreateCustomerOpen] = useState(false);
  const [plyOpen, setPlyOpen] = useState(false);
  const [draftSub, setDraftSub] = useState<any | null>(null);
  const [draftQuery, setDraftQuery] = useState("");
  const [draftFocused, setDraftFocused] = useState(false);
  const [activeSuggest, setActiveSuggest] = useState(0);
  const draftRef = useRef<HTMLInputElement>(null);
  const scanRef = useRef<HTMLInputElement>(null);
  const [draftRect, setDraftRect] = useState<{ left: number; top: number; width: number; placement: "below" | "above"; maxHeight: number } | null>(null);

  const [rateHistoryOpen, setRateHistoryOpen] = useState(false);
  const [rateHistoryRow, setRateHistoryRow] = useState<number | null>(null);
  const [rateHistoryData, setRateHistoryData] = useState<{ date: string; invoice_no: string | null; rate: number; qty: number }[]>([]);
  const [rateHistoryProduct, setRateHistoryProduct] = useState("");
  const [rateHistoryLoading, setRateHistoryLoading] = useState(false);

  const hydrated = useRef(false);

  const today = new Date().toISOString().slice(0, 10);
  const invoicePreview = `INV-${new Date().getFullYear()}-NEW`;

  // Restore persisted state for this tab (+ pending door lines on the active tab) on mount.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        const d = JSON.parse(raw) as PersistShape;
        if (typeof d.customerId === "string") setCustomerId(d.customerId);
        if (typeof d.paymentMode === "string") setPaymentMode(d.paymentMode);
        if (typeof d.discount === "number") setDiscount(d.discount);
        if (typeof d.sourceGodownId === "string") setSourceGodownId(d.sourceGodownId);
        if (Array.isArray(d.lines)) setLines(d.lines);
      }
      if (active) {
        const doorRaw = sessionStorage.getItem("pending_door_lines");
        if (doorRaw) {
          const doorLines: Line[] = JSON.parse(doorRaw);
          if (Array.isArray(doorLines) && doorLines.length) {
            setLines((prev) => [...prev, ...doorLines]);
            toast.success(`${doorLines.length} door line(s) added to bill`);
          }
          sessionStorage.removeItem("pending_door_lines");
          sessionStorage.removeItem("sale_draft");
        }
      }
    } catch (e) { console.error(e); }
    hydrated.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist this tab's state whenever it changes (after initial hydration).
  useEffect(() => {
    if (!hydrated.current) return;
    try {
      const payload: PersistShape = { customerId, paymentMode, discount, lines, sourceGodownId };
      sessionStorage.setItem(storageKey, JSON.stringify(payload));
    } catch (e) { console.error(e); }
  }, [customerId, paymentMode, discount, lines, sourceGodownId, storageKey]);

  useEffect(() => {
    if (!draftFocused) return;
    const update = () => {
      const el = draftRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const spaceBelow = vh - r.bottom - 12;
      const spaceAbove = r.top - 12;
      const preferBelow = spaceBelow >= 240 || spaceBelow >= spaceAbove;
      if (preferBelow) {
        setDraftRect({ left: r.left, top: r.bottom + 6, width: r.width, placement: "below", maxHeight: Math.max(160, Math.min(320, spaceBelow)) });
      } else {
        setDraftRect({ left: r.left, top: Math.max(8, r.top - 6), width: r.width, placement: "above", maxHeight: Math.max(160, Math.min(320, spaceAbove)) });
      }
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [draftFocused, draftQuery]);

  const goAddDoor = () => {
    try {
      const cust = customers.find((c) => c.id === customerId);
      sessionStorage.setItem("sale_draft", JSON.stringify({
        customerId,
        customerName: cust?.name ?? "",
        invoiceNo: invoicePreview,
        paymentMode, discount, lines,
      }));
    } catch {}
    nav({ to: "/door", search: { returnTo: "sale" } as any });
  };

  useEffect(() => {
    const c = customers.find((x) => x.id === customerId);
    setCustomerState(c?.state ?? "");
  }, [customerId, customers]);

  // Keyboard shortcut: F2 to focus entry — only for the active tab.
  useEffect(() => {
    if (!active) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "F2") { e.preventDefault(); draftRef.current?.focus(); }
      if (e.key === "F3") { e.preventDefault(); scanRef.current?.focus(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [active]);

  // Parameter (finish) label for a product variant, else its name.
  const variantLabel = (p: ProductRow) => (p.finish && String(p.finish).trim() ? p.finish : p.name);

  const openRateHistory = async (i: number, line: Line) => {
    if (!customerId) return;
    setRateHistoryRow(i);
    setRateHistoryProduct(line.name);
    setRateHistoryLoading(true);
    setRateHistoryOpen(true);

    // Step 1: get all sale IDs for this customer
    const { data: saleRows } = await supabase
      .from("sales")
      .select("id, invoice_no, invoice_date")
      .eq("customer_id", customerId)
      .order("invoice_date", { ascending: false });

    if (!saleRows || saleRows.length === 0) {
      setRateHistoryData([]);
      setRateHistoryLoading(false);
      return;
    }

    const saleMap = new Map(saleRows.map((s: any) => [s.id, s]));
    const saleIds = saleRows.map((s: any) => s.id);

    // Step 2: get sales_items for those sales + this product
    const { data: itemRows } = await supabase
      .from("sales_items")
      .select("rate, qty, sale_id")
      .eq("product_id", line.product_id)
      .in("sale_id", saleIds)
      .order("qty", { ascending: false });

    const rows = (itemRows ?? []).map((r: any) => {
      const sale = saleMap.get(r.sale_id);
      const raw = sale?.invoice_date ?? "";
      const dateStr = raw ? new Date(raw).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
      return {
        date: dateStr,
        invoice_no: sale?.invoice_no ?? "—",
        rate: Number(r.rate),
        qty: Number(r.qty),
      };
    });
    setRateHistoryData(rows);
    setRateHistoryLoading(false);
  };

  // Build item groups: every product collapses by name (within its sub-category)
  // into one selectable item. Its rows become the parameters (finishes).
  const itemGroups = useMemo<any[]>(() => {
    const map = new Map<string, any>();
    for (const p of products) {
      const itemName = (p.item_group || p.name) as string;
      const key = `${p.subcategory_id ?? "none"}||${itemName}`;
      let g = map.get(key);
      if (!g) {
        g = { id: key, name: itemName, prefix: p.prefix, products: [] as ProductRow[] };
        map.set(key, g);
      }
      g.products.push(p);
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);

  // Stage A: items (product names) — no group names shown. Search matches any
  // sequence anywhere in the name. Stage B (item picked): its parameters.
  const draftSuggestions = useMemo<any[]>(() => {
    const q = draftQuery.trim().toLowerCase();
    if (!draftSub) {
      const pool = itemGroups.map((g) => ({ ...g, __kind: "group" as const }));
      if (!q) return pool;
      return pool.filter((g: any) =>
        g.name.toLowerCase().includes(q) ||
        (g.prefix ? String(g.prefix).toLowerCase().includes(q) : false),
      );
    }
    const pool = (draftSub.products as ProductRow[])
      .slice()
      .sort((a, b) => String(variantLabel(a)).localeCompare(String(variantLabel(b))))
      .map((p) => ({ ...p, __kind: "variant" as const }));
    if (!q) return pool.slice(0, 60);
    return pool.filter((p: any) =>
      String(variantLabel(p)).toLowerCase().includes(q) ||
      (p.finish ?? "").toLowerCase().includes(q),
    ).slice(0, 60);
  }, [itemGroups, draftSub, draftQuery]);

  const looksLikeCode = (s: string) => /-/.test(s) && /^[A-Za-z0-9-]+$/.test(s);

  const onScan = async (raw: string) => {
    setWarn(null);
    const code = parseScannedCode(raw);
    const prefix = code.split("-")[0]?.toUpperCase();
    if (knownPrefixes.length && (!prefix || !knownPrefixes.includes(prefix))) {
      setWarn({ kind: "wrong_prefix", code,
        msg: `Prefix "${prefix || "?"}" is not a known category. Expected one of: ${knownPrefixes.join(", ")}.` });
      return;
    }
    const existingIdx = lines.findIndex(l => l.item_instance_id === code);
    if (existingIdx !== -1) {
      const existing = lines[existingIdx];
      if (existing.is_lot) {
        const nextQty = existing.qty + 1;
        if (existing.max_qty != null && nextQty > existing.max_qty) {
          setWarn({ kind: "generic", code, msg: `Only ${existing.max_qty} in stock for this item.` });
          return;
        }
        setLines(lines.map((l, i) => i === existingIdx ? { ...l, qty: nextQty } : l));
        toast.success(`+1 ${existing.name}`);
        return;
      }
      setWarn({ kind: "duplicate", code, msg: "This item is already in the cart." }); return;
    }
    const { data: item } = await supabase.from("item_instances").select("*, products(*)").eq("id", code).maybeSingle();
    if (!item) {
      setWarn({ kind: "unknown", code, msg: "No item exists with this ID in inventory." });
      return;
    }
    if (item.status !== "available") {
      const kind: ScanWarningKind =
        item.status === "sold" ? "sold"
        : item.status === "damaged" ? "damaged"
        : item.status === "used_in_production" ? "used"
        : "generic";
      setWarn({ kind, code, msg: `Status is ${String(item.status).toUpperCase()} — cannot be sold.` });
      return;
    }
    // Validate stock source
    if (sourceGodownId) {
      if (item.godown_id !== sourceGodownId) {
        const g = godowns.find((x) => x.id === sourceGodownId)?.name ?? "selected godown";
        setWarn({ kind: "generic", code, msg: `This item is not in ${g}. Change the source above or stock it in first.` });
        return;
      }
    } else {
      if (item.godown_id) {
        setWarn({ kind: "generic", code, msg: `This item is in a godown, not on the shop floor. Change the source above.` });
        return;
      }
    }
    const isLot = !!(item as any).is_lot;
    const maxQty = isLot ? Number((item as any).qty_on_hand ?? 1) : 1;
    if (isLot && maxQty <= 0) {
      setWarn({ kind: "generic", code, msg: "Out of stock." });
      return;
    }
    setLines([...lines, {
      product_id: item.product_id, item_instance_id: item.id,
      name: (item.products as any).finish ? `${item.products.name} — ${(item.products as any).finish}` : item.products.name,
      qty: 1, rate: Number(item.products.default_price), gst_rate: 0,
      hsn: item.products.hsn, unit: (item.products as any).unit ?? 'pcs',
      alt_unit: (item.products as any).alt_unit ?? null,
      alt_conversion: (item.products as any).alt_conversion ?? null,
      is_lot: isLot, max_qty: maxQty,
      source_godown_id: (item as any).godown_id ?? null,
    }]);
    toast.success(`Added ${item.id}`);
  };

  const addProductLine = (p: ProductRow, qty = 1) => {
    const display = p.finish ? `${p.name} — ${p.finish}` : p.name;
    setLines(prev => [...prev, {
      product_id: p.id, item_instance_id: null, name: display,
      qty, rate: Number(p.default_price), gst_rate: 0,
      hsn: p.hsn, unit: p.unit ?? 'pcs', alt_unit: p.alt_unit, alt_conversion: p.alt_conversion,
      is_lot: true, max_qty: undefined,
      source_godown_id: sourceGodownId || null,
    }]);
    setDraftQuery(""); setActiveSuggest(0);
    setTimeout(() => draftRef.current?.focus(), 0);
  };

  // PLY wizard line: qty = area (sq ft), rate = user rate. amount = qty*rate.
  const addPlyLine = (item: { name: string; area: number; rate: number }) => {
    setLines((prev) => [...prev, {
      product_id: PLY_CUSTOM_PRODUCT_ID, item_instance_id: null, name: item.name,
      qty: item.area, rate: item.rate, gst_rate: 0,
      hsn: null, unit: "sqft", alt_unit: null, alt_conversion: null,
      is_lot: false, max_qty: undefined,
      source_godown_id: sourceGodownId || null,
    }]);
  };

  const pickDraftGroup = (g: any) => {
    const variants = (g.products ?? []) as ProductRow[];
    // Single product (no parameters) → add it directly. Else go to parameters.
    if (variants.length === 1) {
      addProductLine(variants[0], 1);
      setDraftSub(null);
      return;
    }
    setDraftSub(g); setDraftQuery(""); setActiveSuggest(0);
    setTimeout(() => draftRef.current?.focus(), 0);
  };

  const handleDraftCommit = () => {
    const s = draftQuery.trim();
    if (s && looksLikeCode(s)) { onScan(s); setDraftQuery(""); return; }
    const pick = draftSuggestions[activeSuggest] ?? draftSuggestions[0];
    if (!pick) { toast.error(draftSub ? "No matching parameter" : "No matching item"); return; }
    if (!draftSub) {
      pickDraftGroup(pick);
    } else {
      addAndReset(pick as ProductRow);
    }
  };

  const addAndReset = (p: ProductRow) => {
    addProductLine(p, 1);
    setDraftSub(null);
  };

  const rm = (i: number) => setLines(lines.filter((_, idx) => idx !== i));
  const upd = (i: number, patch: Partial<Line>) => setLines(lines.map((l, idx) => idx === i ? { ...l, ...patch } : l));

  const subtotal = lines.reduce((a, l) => a + l.qty * l.rate, 0);
  const tax = lines.reduce((a, l) => a + (l.qty * l.rate * l.gst_rate / 100), 0);
  const total = subtotal + tax - discount;

  const finalize = async (alsoWhatsApp: boolean) => {
    if (lines.length === 0) { toast.error("Scan or add items"); return; }
    if (f.customer.visible && f.customer.required && !customerId) { toast.error("Customer is required"); return; }
    if (f.payment_mode.visible && f.payment_mode.required && !paymentMode) { toast.error("Payment mode is required"); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("record_sale", {
      _payload: {
        customer_id: customerId || null,
        customer_state: customerState,
        payment_mode: paymentMode,
        paid_amount: paymentMode === "cash" ? total : 0,
        discount,
        items: lines,
      } as any,
      _actor_user_id: user?.id ?? "",
    });
    if (error) { setBusy(false); toast.error(error.message); return; }
    const saleId = data as string;
    toast.success("Sale recorded");
    if (alsoWhatsApp) {
      try {
        const customer = customers.find((c) => c.id === customerId);
        if (!customer?.phone) { toast.error("Customer has no phone — cannot send WhatsApp"); }
        else {
          const [{ data: sale }, { data: shop }] = await Promise.all([
            supabase.from("sales").select("*").eq("id", saleId).single(),
            supabase.from("app_settings").select("*").eq("id", true).maybeSingle(),
          ]);
          const { buildInvoicePdf, shareInvoiceOnWhatsApp } = await import("@/lib/invoice-pdf");
          const pdf = buildInvoicePdf({
            shop, sale: sale as any, customer,
            items: lines.map((l) => ({ ...l, line_total: l.qty * l.rate })),
          });
          const blob = pdf.output("blob");
          const path = `${new Date().getFullYear()}/${sale!.invoice_no}.pdf`;
          const up = await supabase.storage.from("invoices").upload(path, blob, { upsert: true, contentType: "application/pdf" });
          let publicUrl: string | undefined;
          if (!up.error) {
            const signed = await supabase.storage.from("invoices").createSignedUrl(path, 60 * 60 * 24 * 30);
            publicUrl = signed.data?.signedUrl;
          }
          await shareInvoiceOnWhatsApp({
            pdf, invoiceNo: sale!.invoice_no ?? saleId,
            phone: customer.phone, shopName: shop?.shop_name,
            total: Number(sale!.grand_total), publicUrl,
          });
        }
      } catch (e: any) { toast.error(`WhatsApp share failed: ${e.message}`); }
    }
    setBusy(false);
    try { sessionStorage.removeItem(storageKey); } catch {}
    onSaved(tabId);
  };
  const save = () => finalize(false);
  const saveAndWhatsApp = () => finalize(true);

  return (
    <div className="min-h-[calc(100dvh-1rem)] w-full bg-[#fafbfc] p-3 md:p-6 pb-32">
      <div className="max-w-7xl mx-auto flex flex-col gap-4 md:gap-6">

        {/* Top Header */}
        <header className="bg-white border border-[#e8ecf1] rounded-xl p-4 md:p-5 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-center gap-3 md:gap-4">
              <Button variant="ghost" size="icon" aria-label="Back to sales" className="h-9 w-9 -ml-1" onClick={() => nav({ to: "/sales" })}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="space-y-0.5">
                <p className="text-[10px] uppercase tracking-wider text-[#94a3b8] font-bold">Invoice No.</p>
                <h2 className="text-base md:text-lg font-bold text-slate-800 tabular-nums">{invoicePreview}</h2>
              </div>
              <div className="h-10 w-px bg-[#e8ecf1] hidden md:block" />
              <div className="space-y-0.5 hidden md:block">
                <p className="text-[10px] uppercase tracking-wider text-[#94a3b8] font-bold">Billing Date</p>
                <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                  <Calendar className="h-3.5 w-3.5 text-[#94a3b8]" />
                  {today}
                </div>
              </div>
            </div>

            {f.customer.visible && (
              <div className="flex-1 min-w-[220px] space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-[#94a3b8] font-bold">
                  Customer {f.customer.required && <span className="text-red-500">*</span>}
                </label>
                <div className="flex gap-2">
                  <select
                    className="flex-1 h-10 px-3 bg-[#fafbfc] border border-[#e8ecf1] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/20 focus:border-[#3b82f6]"
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                  >
                    <option value="">{f.customer.required ? "Select customer" : "Walk-in customer"}</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}{c.state ? ` — ${c.state}` : ""}</option>
                    ))}
                  </select>
                  <Button type="button" variant="outline" size="sm" className="h-10 gap-1" onClick={() => setCreateCustomerOpen(true)}>
                    <Plus className="h-4 w-4" /> <span>New</span>
                  </Button>
                </div>
              </div>
            )}

            {f.payment_mode.visible && (
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-[#94a3b8] font-bold">Payment</label>
                <div className="flex bg-[#fafbfc] p-1 border border-[#e8ecf1] rounded-lg">
                  {["cash", "upi", "card", "credit"].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPaymentMode(m)}
                      className={`px-3 py-1.5 text-xs font-bold rounded transition-all capitalize min-h-[32px] ${
                        paymentMode === m
                          ? "bg-white shadow-sm text-[#3b82f6]"
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <label className="text-[10px] uppercase tracking-wider text-[#94a3b8] font-bold flex items-center gap-1">
              <Warehouse className="h-3 w-3" /> Stock source
            </label>
            <button
              type="button"
              onClick={() => setSourceGodownId("")}
              className={`px-3 h-7 text-xs font-bold rounded-md border transition-all ${
                sourceGodownId === ""
                  ? "bg-[#3b82f6] text-white border-[#3b82f6]"
                  : "bg-white text-slate-600 border-[#e8ecf1] hover:bg-slate-50"
              }`}
            >
              Shop
            </button>
            <select
              value={sourceGodownId}
              onChange={(e) => setSourceGodownId(e.target.value)}
              className={`h-7 px-2 text-xs font-bold rounded-md border ${
                sourceGodownId
                  ? "bg-[#3b82f6] text-white border-[#3b82f6]"
                  : "bg-white text-slate-600 border-[#e8ecf1]"
              }`}
            >
              <option value="" className="bg-white text-slate-800">— Godown —</option>
              {godowns.map((g) => (
                <option key={g.id} value={g.id} className="bg-white text-slate-800">{g.name}</option>
              ))}
            </select>
            <span className="text-[10px] text-[#94a3b8]">Scans must come from the selected location.</span>
          </div>
          {customerState && (
            <div className="mt-3 text-[11px] text-[#94a3b8]">
              GST State: <span className="text-slate-600 font-medium">{customerState}</span>
            </div>
          )}
        </header>

        {entryMode === "tiles" ? (
          // ponytail: placeholder category tiles; PLY/MICA/HARDWARE click filtering wired later. DOORS reuses Add Door flow.
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {(["PLY", "MICA", "HARDWARE", "DOORS"] as const).map((label) => (
              <button
                key={label}
                type="button"
                onClick={label === "DOORS" ? goAddDoor : label === "PLY" ? () => setPlyOpen(true) : undefined}
                className="group flex flex-col items-center justify-center gap-3 bg-white border border-[#e8ecf1] rounded-xl p-6 shadow-sm transition-all hover:border-[#3b82f6] hover:shadow-md active:scale-[0.98]"
              >
                <img
                  src={`https://placehold.co/320x200?text=${label}`}
                  alt={`${label} category`}
                  className="w-full h-32 object-cover rounded-lg bg-slate-100"
                />
                <span className="text-lg font-bold tracking-wide text-slate-700 group-hover:text-[#3b82f6]">{label}</span>
              </button>
            ))}
          </div>
        ) : null}

        {entryMode === "tiles" && (
          <>
            {lines.length > 0 && (
              <div className="bg-white border border-slate-300 rounded-md overflow-hidden shadow-sm mb-8">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse min-w-[720px] text-[13px] font-mono">
                    <colgroup>
                      <col style={{ width: 40 }} />
                      <col />
                      <col style={{ width: 120 }} />
                      <col style={{ width: 110 }} />
                      <col style={{ width: 130 }} />
                      <col style={{ width: 70 }} />
                      <col style={{ width: 130 }} />
                      <col style={{ width: 36 }} />
                    </colgroup>
                    <thead>
                      <tr className="bg-slate-100 text-[11px] uppercase tracking-wide text-slate-600 font-sans">
                        <th className="border border-slate-300 px-2 py-1.5 text-center font-semibold">#</th>
                        <th className="border border-slate-300 px-2 py-1.5 text-left font-semibold">Product</th>
                        <th className="border border-slate-300 px-2 py-1.5 text-center font-semibold">Qty</th>
                        <th className="border border-slate-300 px-2 py-1.5 text-left font-semibold">Alt Unit</th>
                        <th className="border border-slate-300 px-2 py-1.5 text-right font-semibold">Rate</th>
                        <th className="border border-slate-300 px-2 py-1.5 text-right font-semibold">GST%</th>
                        <th className="border border-slate-300 px-2 py-1.5 text-right font-semibold">Amount</th>
                        <th className="border border-slate-300 px-2 py-1.5" />
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((l, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="border border-slate-300 px-2 py-1.5 text-center text-slate-400">{i + 1}</td>
                          <td className="border border-slate-300 px-2 py-1.5 font-semibold text-slate-700">{l.name}</td>
                          <td className="border border-slate-300 px-1 py-1 text-center">
                            <input
                              type="number"
                              min={0}
                              value={l.qty}
                              onChange={(e) => upd(i, { qty: Number(e.target.value) })}
                              className="w-full bg-transparent text-center tabular-nums focus:outline-none focus:bg-blue-50"
                              aria-label={`Quantity for ${l.name}`}
                            />
                          </td>
                          <td className="border border-slate-300 px-2 py-1.5 text-slate-500">{l.unit ?? "—"}</td>
                          <td className="border border-slate-300 px-1 py-1 text-right">
                            <input
                              type="number"
                              min={0}
                              value={l.rate}
                              onChange={(e) => upd(i, { rate: Number(e.target.value) })}
                              className="w-full bg-transparent text-right tabular-nums focus:outline-none focus:bg-blue-50"
                              aria-label={`Rate for ${l.name}`}
                            />
                          </td>
                          <td className="border border-slate-300 px-2 py-1.5 text-right tabular-nums text-slate-500">{l.gst_rate}</td>
                          <td className="border border-slate-300 px-2 py-1.5 text-right font-bold tabular-nums text-slate-800">{inr(l.qty * l.rate)}</td>
                          <td className="border border-slate-300 px-1 py-1 text-center">
                            <button
                              type="button"
                              aria-label="Remove item"
                              onClick={() => rm(i)}
                              className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <PlyWizardDialog open={plyOpen} onOpenChange={setPlyOpen} onAdd={addPlyLine} />
          </>
        )}

        {entryMode === "scan" && (
        <>
        {/* Compact scanner strip (barcode wedge) */}
        <div className="flex items-center gap-2 bg-white border border-[#e8ecf1] rounded-lg px-3 py-2 shadow-sm">
          <ScanLine className="h-4 w-4 text-[#3b82f6] shrink-0" />
          <input
            ref={scanRef}
            type="text"
            placeholder="Scan barcode here (F3) — or just start typing in the row below"
            className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-[#94a3b8] font-mono"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const v = e.currentTarget.value.trim();
                if (v) { onScan(v); e.currentTarget.value = ""; }
              }
            }}
            aria-label="Barcode scan input"
          />
          <span className="text-[10px] text-[#94a3b8] hidden md:inline">F2 = focus row · Enter = add</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={goAddDoor}
            className="h-8 gap-1.5 border-[#a78bfa] text-[#7c3aed] hover:bg-[#a78bfa]/10 shrink-0"
          >
            <DoorOpen className="h-3.5 w-3.5" />
            <span className="text-xs font-semibold">Add Door</span>
          </Button>
        </div>

        {warn && (
          <div className="rounded-lg overflow-hidden border border-[#e8ecf1]">
            <ScanWarning kind={warn.kind} message={warn.msg} code={warn.code} />
          </div>
        )}

        {/* Hidden auto-focus scanner (catches wedge input anywhere on page) — active tab only */}
        {active && (
          <div className="sr-only">
            <ScanInput onScan={onScan} invalid={!!warn} />
          </div>
        )}

        {/* Google-Sheets-style grid */}
        <div className="bg-white border border-slate-300 rounded-md overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[830px] text-[13px] font-mono">
              <colgroup>
                <col style={{ width: 40 }} />
                <col />
                <col style={{ width: 110 }} />
                <col style={{ width: 110 }} />
                <col style={{ width: 110 }} />
                {f.gst_rate.visible && <col style={{ width: 70 }} />}
                <col style={{ width: 130 }} />
                <col style={{ width: 120 }} />
                <col style={{ width: 36 }} />
              </colgroup>
              <thead>
                <tr className="bg-slate-100 text-[11px] uppercase tracking-wide text-slate-600 font-sans">
                  <th className="border border-slate-300 px-2 py-1.5 text-center font-semibold">#</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-left font-semibold">Product</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-center font-semibold">Qty</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-left font-semibold">Alt Unit</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-right font-semibold">Rate</th>
                  {f.gst_rate.visible && <th className="border border-slate-300 px-2 py-1.5 text-right font-semibold">GST%</th>}
                  <th className="border border-slate-300 px-2 py-1.5 text-left font-semibold">Source</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-right font-semibold">Amount</th>
                  <th className="border border-slate-300 px-1 py-1.5"></th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {lines.map((l, i) => (
                  <tr key={i} className="hover:bg-[#fafbfc] group">
                    <td className="border border-slate-300 bg-slate-50 px-2 py-0 text-center text-slate-500 text-[11px] font-sans">{i + 1}</td>
                    <td className="border border-slate-300 px-2 py-1">
                      <div className="text-slate-800 truncate">{l.name}</div>
                      {l.item_instance_id && (
                        <div className="text-[10px] text-slate-400 truncate">{l.item_instance_id}</div>
                      )}
                    </td>
                    <td className="border border-slate-300 px-0 py-0">
                      <input
                        type="number"
                        min={1}
                        value={l.qty}
                        onChange={(e) => {
                          const v = Math.max(1, Number(e.target.value));
                          upd(i, { qty: l.max_qty != null ? Math.min(v, l.max_qty) : v });
                        }}
                        disabled={!l.is_lot}
                        className="w-full h-full px-2 py-1.5 text-center bg-transparent focus:outline-none focus:bg-blue-50 focus:ring-2 focus:ring-inset focus:ring-[#3b82f6] disabled:text-slate-500"
                        aria-label={`Quantity for ${l.name}`}
                      />
                      <div className="text-[10px] text-slate-500 text-center pb-0.5">
                        {l.alt_unit ? `${l.unit ?? 'pcs'} / ${l.alt_unit}` : (l.unit ?? 'pcs')}
                      </div>
                    </td>
                    <td className="border border-slate-300 px-2 py-0 text-[12px] text-slate-600">
                      {l.alt_unit && l.alt_conversion
                        ? `${(l.qty * Number(l.alt_conversion)).toLocaleString("en-IN", { maximumFractionDigits: 3 })} ${l.alt_unit}`
                        : "—"}
                    </td>
                    <td className="border border-slate-300 px-0 py-0">
                      <div className="flex items-center h-full">
                        <input
                          type="number"
                          value={l.rate}
                          onChange={(e) => upd(i, { rate: Number(e.target.value) })}
                          className="flex-1 h-full px-2 py-1.5 text-right bg-transparent focus:outline-none focus:bg-blue-50 focus:ring-2 focus:ring-inset focus:ring-[#3b82f6]"
                          aria-label={`Rate for ${l.name}`}
                        />
                        {customerId && (
                          <button
                            type="button"
                            title={`View price history for ${l.name}`}
                            onClick={() => openRateHistory(i, l)}
                            className="px-1 text-slate-400 hover:text-blue-500 shrink-0"
                          >
                            <History className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                    {f.gst_rate.visible && (
                      <td className="border border-slate-300 px-0 py-0">
                        <input
                          type="number"
                          value={l.gst_rate}
                          onChange={(e) => upd(i, { gst_rate: Number(e.target.value) })}
                          className="w-full h-full px-2 py-1.5 text-right bg-transparent focus:outline-none focus:bg-blue-50 focus:ring-2 focus:ring-inset focus:ring-[#3b82f6]"
                          aria-label={`GST rate for ${l.name}`}
                        />
                      </td>
                    )}
                    <td className="border border-slate-300 px-0 py-0">
                      {l.item_instance_id ? (
                        <div className="px-2 py-1.5 text-[11px] text-slate-600 font-sans truncate">
                          {godowns.find((g) => g.id === l.source_godown_id)?.name ?? "Shop"}
                        </div>
                      ) : (
                        <select
                          value={l.source_godown_id ?? ""}
                          onChange={(e) => upd(i, { source_godown_id: e.target.value || null })}
                          className="w-full h-full px-1 py-1.5 text-[12px] bg-transparent focus:outline-none focus:bg-blue-50 focus:ring-2 focus:ring-inset focus:ring-[#3b82f6] font-sans"
                          aria-label={`Source for ${l.name}`}
                        >
                          <option value="">Shop</option>
                          {godowns.map((g) => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="border border-slate-300 px-2 py-1.5 text-right font-semibold text-slate-800 bg-slate-50/60">
                      {inr(l.qty * l.rate)}
                    </td>
                    <td className="border border-slate-300 px-1 py-0 text-center">
                      <button
                        type="button"
                        aria-label={`Remove ${l.name}`}
                        onClick={() => rm(i)}
                        className="text-slate-400 hover:text-red-500 p-1 md:opacity-0 md:group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}

                {/* Always-present draft row (Google Sheets style) */}
                <tr className="bg-blue-50/30">
                  <td className="border border-slate-300 bg-slate-50 px-2 py-0 text-center text-slate-400 text-[11px] font-sans">
                    {lines.length + 1}
                  </td>
                  <td className="border border-slate-300 px-0 py-0 relative">
                    <input
                      ref={draftRef}
                      type="text"
                      value={draftQuery}
                      onChange={(e) => { setDraftQuery(e.target.value); setActiveSuggest(0); setWarn(null); }}
                      onFocus={() => setDraftFocused(true)}
                      onBlur={() => setTimeout(() => setDraftFocused(false), 150)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === "Tab") {
                          if (draftQuery.trim() || draftSuggestions.length > 0) {
                            e.preventDefault(); handleDraftCommit();
                          }
                        } else if (e.key === "ArrowDown") {
                          e.preventDefault();
                          setActiveSuggest((n) => Math.min(n + 1, draftSuggestions.length - 1));
                        } else if (e.key === "ArrowUp") {
                          e.preventDefault();
                          setActiveSuggest((n) => Math.max(0, n - 1));
                        } else if (e.key === "Escape") {
                          setDraftQuery(""); setDraftSub(null);
                        } else if (e.key === "Backspace" && !draftQuery && draftSub) {
                          e.preventDefault();
                          setDraftSub(null);
                        }
                      }}
                      placeholder={draftSub ? `Pick parameter in ${draftSub.name}…` : "Scan barcode or type item name…"}
                      className="w-full h-full px-2 py-1.5 bg-transparent focus:outline-none focus:bg-white focus:ring-2 focus:ring-inset focus:ring-[#3b82f6] placeholder:text-slate-400 font-sans"
                      aria-label="Add new line"
                    />
                    {draftSub && (
                      <div className="absolute left-1.5 top-0.5 flex items-center gap-1 text-[10px] font-bold uppercase bg-[#3b82f6]/10 text-[#3b82f6] px-1.5 py-0.5 rounded">
                        {draftSub.name}
                        <button type="button" className="ml-0.5 hover:text-red-500" onMouseDown={(e) => { e.preventDefault(); setDraftSub(null); }}>×</button>
                      </div>
                    )}
                    {draftFocused && draftSuggestions.length > 0 && (
                      <div
                        className="fixed bg-white border border-slate-300 rounded-md shadow-2xl z-50 overflow-auto font-sans"
                        style={{
                          left: draftRect?.left ?? 0,
                          width: draftRect?.width ?? 300,
                          top: draftRect?.top ?? 0,
                          transform: draftRect?.placement === "above" ? "translateY(-100%)" : undefined,
                          maxHeight: draftRect?.maxHeight ?? 320,
                        }}
                      >
                        <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                          <span>{draftSub ? `Parameters in ${draftSub.name}` : "Items"}</span>
                          {draftSub && (
                            <button type="button" onMouseDown={(e) => { e.preventDefault(); setDraftSub(null); }} className="text-[#3b82f6] hover:underline normal-case font-semibold">← back</button>
                          )}
                        </div>
                        {draftSuggestions.map((p: any, idx: number) => (
                          <button
                            key={p.id}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              if (!draftSub) {
                                pickDraftGroup(p);
                              } else {
                                addAndReset(p as ProductRow);
                              }
                            }}
                            className={`w-full text-left px-3 py-2 border-b border-slate-100 last:border-0 flex items-center justify-between gap-2 ${
                              idx === activeSuggest ? "bg-[#3b82f6]/10" : "hover:bg-slate-50"
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-slate-800 truncate">
                                {p.__kind === "variant" ? variantLabel(p) : p.name}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {p.__kind === "variant"
                                  ? (p.finish && p.item_group
                                      ? p.item_group
                                      : `${p.prefix} · ${p.gst_rate}% GST · ${p.unit}${p.alt_unit ? ` / ${p.alt_unit}` : ""}`)
                                  : (p.products.length > 1
                                      ? <span className="text-[#3b82f6] font-semibold">{p.products.length} parameters</span>
                                      : <span className="uppercase">{p.products[0]?.prefix}</span>)}
                              </div>
                            </div>
                            {p.__kind === "variant" ? (
                              <div className="text-sm font-bold tabular-nums text-[#3b82f6] shrink-0">
                                {inr(Number(p.default_price))}
                              </div>
                            ) : p.products.length === 1 ? (
                              <div className="text-sm font-bold tabular-nums text-[#3b82f6] shrink-0">
                                {inr(Number(p.products[0].default_price))}
                              </div>
                            ) : null}
                          </button>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="border border-slate-300 px-2 py-1.5 text-slate-300">—</td>
                  <td className="border border-slate-300 px-2 py-1.5 text-center text-slate-300">1</td>
                  <td className="border border-slate-300 px-2 py-1.5 text-slate-300">—</td>
                  <td className="border border-slate-300 px-2 py-1.5 text-right text-slate-300">0.00</td>
                  {f.gst_rate.visible && <td className="border border-slate-300 px-2 py-1.5 text-right text-slate-300">0</td>}
                  <td className="border border-slate-300 px-2 py-1.5 text-[11px] text-slate-300 font-sans">—</td>
                  <td className="border border-slate-300 px-2 py-1.5 text-right text-slate-300">0.00</td>
                  <td className="border border-slate-300 px-1 py-1.5 text-center">
                    <Plus className="h-3.5 w-3.5 text-slate-400 mx-auto" />
                  </td>
                </tr>

                {/* Filler empty rows so it looks like a sheet */}
                {Array.from({ length: Math.max(0, 7 - lines.length) }).map((_, idx) => (
                  <tr key={`filler-${idx}`} className="text-slate-300">
                    <td className="border border-slate-300 bg-slate-50 px-2 py-1.5 text-center text-[11px] font-sans">
                      {lines.length + 2 + idx}
                    </td>
                    <td className="border border-slate-300 px-2 py-1.5"></td>
                    <td className="border border-slate-300 px-2 py-1.5"></td>
                    <td className="border border-slate-300 px-2 py-1.5"></td>
                    <td className="border border-slate-300 px-2 py-1.5"></td>
                    <td className="border border-slate-300 px-2 py-1.5"></td>
                    {f.gst_rate.visible && <td className="border border-slate-300 px-2 py-1.5"></td>}
                    <td className="border border-slate-300 px-2 py-1.5"></td>
                    <td className="border border-slate-300 px-2 py-1.5"></td>
                    <td className="border border-slate-300 px-1 py-1.5"></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </>
        )}
      </div>

      {/* Sticky Totals Bar */}
      <footer className="sticky bottom-3 z-20 w-full max-w-7xl mx-auto bg-white border border-[#e8ecf1] rounded-2xl px-3 md:px-5 py-2.5 md:py-3 shadow-2xl shadow-slate-200/60">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 flex-nowrap">
          <div className="flex items-center gap-4 md:gap-6 min-w-0">
            <div className="shrink-0">
              <p className="text-[9px] uppercase font-bold text-[#94a3b8] leading-tight">Subtotal</p>
              <p className="text-sm font-bold text-slate-800 tabular-nums leading-tight">{inr(subtotal)}</p>
            </div>
            <div className="shrink-0">
              <p className="text-[9px] uppercase font-bold text-[#94a3b8] leading-tight">Tax (GST)</p>
              <p className="text-sm font-bold text-slate-800 tabular-nums leading-tight">{inr(tax)}</p>
            </div>
            {f.discount.visible && (
              <div className="shrink-0">
                <p className="text-[9px] uppercase font-bold text-[#94a3b8] leading-tight">Discount</p>
                <input
                  type="number"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  className="w-14 border-b border-[#e8ecf1] focus:border-[#3b82f6] focus:outline-none text-sm font-bold tabular-nums text-slate-800 bg-transparent leading-tight"
                  aria-label="Discount"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            <div className="text-right shrink-0">
              <p className="text-[9px] uppercase font-bold text-[#3b82f6] leading-tight">Grand Total</p>
              <p className="text-base md:text-xl font-bold text-slate-900 tabular-nums leading-tight whitespace-nowrap">{inr(total)}</p>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <Button
                type="button"
                onClick={saveAndWhatsApp}
                disabled={busy}
                className="bg-[#25D366] hover:bg-[#20bd5c] text-white px-3 h-9 rounded-lg font-semibold gap-1.5 text-sm"
                aria-label="Save and send WhatsApp"
              >
                <MessageCircle className="h-4 w-4" />
                <span className="hidden sm:inline">Send</span>
              </Button>
              <Button
                type="button"
                onClick={save}
                disabled={busy}
                className="bg-[#3b82f6] hover:bg-blue-600 text-white px-3 md:px-4 h-9 rounded-lg font-semibold shadow-lg shadow-blue-500/20 gap-1.5 text-sm"
              >
                <Check className="h-4 w-4" />
                {busy ? "Saving…" : <span>Save</span>}
              </Button>
            </div>
          </div>
        </div>
      </footer>

      {/* Price History Dialog */}
      {rateHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setRateHistoryOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50">
              <div>
                <div className="text-sm font-bold text-slate-800">Price History</div>
                <div className="text-xs text-slate-500 mt-0.5">{rateHistoryProduct}</div>
              </div>
              <button type="button" onClick={() => setRateHistoryOpen(false)} className="text-slate-400 hover:text-slate-600 text-lg leading-none">&times;</button>
            </div>
            <div className="px-5 py-3 max-h-[320px] overflow-y-auto">
              {rateHistoryLoading ? (
                <div className="py-6 text-center text-sm text-slate-400">Loading…</div>
              ) : rateHistoryData.length === 0 ? (
                <div className="py-6 text-center text-sm text-slate-400">No previous sales found for this item.</div>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-slate-100">
                      <th className="py-1.5 font-medium">Date</th>
                      <th className="py-1.5 font-medium">Bill No.</th>
                      <th className="py-1.5 font-medium text-right">Qty</th>
                      <th className="py-1.5 font-medium text-right">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rateHistoryData.map((r, idx) => (
                      <tr
                        key={idx}
                        className="border-b border-slate-50 hover:bg-blue-50 cursor-pointer"
                        onClick={() => {
                          if (rateHistoryRow != null) {
                            upd(rateHistoryRow, { rate: r.rate });
                          }
                          setRateHistoryOpen(false);
                        }}
                      >
                        <td className="py-2 text-slate-700">{r.date}</td>
                        <td className="py-2 text-slate-700">{r.invoice_no ?? "—"}</td>
                        <td className="py-2 text-right text-slate-700">{r.qty}</td>
                        <td className="py-2 text-right font-medium text-slate-800">{inr(r.rate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="px-5 py-2 border-t border-slate-100 bg-slate-50 text-[10px] text-slate-400 text-right">
              Click a row to apply that rate
            </div>
          </div>
        </div>
      )}

      <QuickCreatePartyDialog
        open={createCustomerOpen}
        onOpenChange={setCreateCustomerOpen}
        kind="customer"
        onCreated={(c) => {
          onCustomerCreated(c);
          setCustomerId(c.id);
        }}
      />
    </div>
  );
}
