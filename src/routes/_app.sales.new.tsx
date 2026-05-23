import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScanInput } from "@/components/erp/ScanInput";
import { useAuth } from "@/lib/auth-store";
import { toast } from "sonner";
import { inr } from "@/lib/codes";
import {
  Trash2, ArrowLeft, Check, ScanLine,
  Plus, Calendar, MessageCircle,
} from "lucide-react";
import { useUiConfig } from "@/lib/ui-config";
// jspdf + jspdf-autotable (~250KB) loaded only when finalize() actually runs.
import { ScanWarning, type ScanWarningKind } from "@/components/erp/ScanWarning";
import { QuickCreatePartyDialog } from "@/components/erp/QuickCreatePartyDialog";

export const Route = createFileRoute("/_app/sales/new")({ component: NewSale });

type Line = {
  product_id: string; item_instance_id: string | null; name: string;
  qty: number; rate: number; gst_rate: number; hsn?: string | null;
  alt_unit?: string | null; alt_conversion?: number | null;
  is_lot?: boolean; max_qty?: number;
};

type ProductRow = {
  id: string; name: string; prefix: string; hsn: string | null;
  default_price: number; gst_rate: number; unit: string;
  alt_unit: string | null; alt_conversion: number | null;
};

function NewSale() {
  const nav = useNavigate();
  const user = useAuth(s => s.user);
  const cfg = useUiConfig();
  const f = cfg.forms.new_sale.fields;
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [customerState, setCustomerState] = useState<string>("");
  const [paymentMode, setPaymentMode] = useState("cash");
  const [discount, setDiscount] = useState(0);
  const [lines, setLines] = useState<Line[]>([]);
  const [warn, setWarn] = useState<{ kind: ScanWarningKind; msg: string; code?: string } | null>(null);
  const [knownPrefixes, setKnownPrefixes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [createCustomerOpen, setCreateCustomerOpen] = useState(false);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [draftQuery, setDraftQuery] = useState("");
  const [draftFocused, setDraftFocused] = useState(false);
  const [activeSuggest, setActiveSuggest] = useState(0);
  const draftRef = useRef<HTMLInputElement>(null);
  const scanRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from("customers").select("*").order("name").then(({ data }) => setCustomers(data ?? []));
    supabase.from("products")
      .select("id,name,prefix,hsn,default_price,gst_rate,unit,alt_unit,alt_conversion")
      .eq("active", true)
      .order("name")
      .then(({ data }) => {
        const rows = (data ?? []) as ProductRow[];
        setProducts(rows);
        setKnownPrefixes(Array.from(new Set(rows.map(p => p.prefix).filter(Boolean))));
      });
  }, []);
  useEffect(() => {
    const c = customers.find((x) => x.id === customerId);
    setCustomerState(c?.state ?? "");
  }, [customerId, customers]);

  // Keyboard shortcut: F2 to focus entry
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "F2") { e.preventDefault(); draftRef.current?.focus(); }
      if (e.key === "F3") { e.preventDefault(); scanRef.current?.focus(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const draftSuggestions = useMemo(() => {
    const q = draftQuery.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.hsn ?? "").toLowerCase().includes(q) ||
        p.prefix.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [products, draftQuery]);

  const looksLikeCode = (s: string) => /-/.test(s) && /^[A-Za-z0-9-]+$/.test(s);

  const onScan = async (code: string) => {
    setWarn(null);
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
    const isLot = !!(item as any).is_lot;
    const maxQty = isLot ? Number((item as any).qty_on_hand ?? 1) : 1;
    if (isLot && maxQty <= 0) {
      setWarn({ kind: "generic", code, msg: "Out of stock." });
      return;
    }
    setLines([...lines, {
      product_id: item.product_id, item_instance_id: item.id, name: item.products.name,
      qty: 1, rate: Number(item.products.default_price), gst_rate: Number(item.products.gst_rate),
      hsn: item.products.hsn,
      alt_unit: (item.products as any).alt_unit ?? null,
      alt_conversion: (item.products as any).alt_conversion ?? null,
      is_lot: isLot, max_qty: maxQty,
    }]);
    toast.success(`Added ${item.id}`);
  };

  const addProductLine = (p: ProductRow, qty = 1) => {
    setLines(prev => [...prev, {
      product_id: p.id, item_instance_id: null, name: p.name,
      qty, rate: Number(p.default_price), gst_rate: Number(p.gst_rate),
      hsn: p.hsn, alt_unit: p.alt_unit, alt_conversion: p.alt_conversion,
      is_lot: true, max_qty: undefined,
    }]);
    setDraftQuery(""); setActiveSuggest(0);
    // refocus the draft row so user can keep typing next line (Sheets-like)
    setTimeout(() => draftRef.current?.focus(), 0);
  };

  const handleDraftCommit = () => {
    const s = draftQuery.trim();
    if (!s) return;
    if (looksLikeCode(s)) { onScan(s); setDraftQuery(""); return; }
    if (draftSuggestions.length > 0) addProductLine(draftSuggestions[activeSuggest] ?? draftSuggestions[0], 1);
    else toast.error("No matching product");
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
    nav({ to: "/sales/$id", params: { id: saleId } });
  };
  const save = () => finalize(false);
  const saveAndWhatsApp = () => finalize(true);

  const today = new Date().toISOString().slice(0, 10);
  const invoicePreview = `INV-${new Date().getFullYear()}-NEW`;

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
                    <Plus className="h-4 w-4" /> <span className="hidden sm:inline">New</span>
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
          {customerState && (
            <div className="mt-3 text-[11px] text-[#94a3b8]">
              GST State: <span className="text-slate-600 font-medium">{customerState}</span>
            </div>
          )}
        </header>

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
        </div>

        {warn && (
          <div className="rounded-lg overflow-hidden border border-[#e8ecf1]">
            <ScanWarning kind={warn.kind} message={warn.msg} code={warn.code} />
          </div>
        )}

        {/* Hidden auto-focus scanner (catches wedge input anywhere on page) */}
        <div className="sr-only">
          <ScanInput onScan={onScan} invalid={!!warn} />
        </div>

        {/* Google-Sheets-style grid */}
        <div className="bg-white border border-slate-300 rounded-md overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[920px] text-[13px] font-mono">
              <colgroup>
                <col style={{ width: 40 }} />
                <col />
                <col style={{ width: 90 }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 110 }} />
                <col style={{ width: 110 }} />
                {f.gst_rate.visible && <col style={{ width: 70 }} />}
                <col style={{ width: 120 }} />
                <col style={{ width: 36 }} />
              </colgroup>
              <thead>
                <tr className="bg-slate-100 text-[11px] uppercase tracking-wide text-slate-600 font-sans">
                  <th className="border border-slate-300 px-2 py-1.5 text-center font-semibold">#</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-left font-semibold">Product</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-left font-semibold">HSN</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-center font-semibold">Qty</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-left font-semibold">Alt Unit</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-right font-semibold">Rate</th>
                  {f.gst_rate.visible && <th className="border border-slate-300 px-2 py-1.5 text-right font-semibold">GST%</th>}
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
                    <td className="border border-slate-300 px-2 py-0 text-slate-600 text-[12px]">{l.hsn ?? ""}</td>
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
                    </td>
                    <td className="border border-slate-300 px-2 py-0 text-[12px] text-slate-600">
                      {l.alt_unit && l.alt_conversion
                        ? `${(l.qty * Number(l.alt_conversion)).toLocaleString("en-IN", { maximumFractionDigits: 3 })} ${l.alt_unit}`
                        : ""}
                    </td>
                    <td className="border border-slate-300 px-0 py-0">
                      <input
                        type="number"
                        value={l.rate}
                        onChange={(e) => upd(i, { rate: Number(e.target.value) })}
                        className="w-full h-full px-2 py-1.5 text-right bg-transparent focus:outline-none focus:bg-blue-50 focus:ring-2 focus:ring-inset focus:ring-[#3b82f6]"
                        aria-label={`Rate for ${l.name}`}
                      />
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
                          if (draftQuery.trim()) { e.preventDefault(); handleDraftCommit(); }
                        } else if (e.key === "ArrowDown") {
                          e.preventDefault();
                          setActiveSuggest((n) => Math.min(n + 1, draftSuggestions.length - 1));
                        } else if (e.key === "ArrowUp") {
                          e.preventDefault();
                          setActiveSuggest((n) => Math.max(0, n - 1));
                        } else if (e.key === "Escape") {
                          setDraftQuery("");
                        }
                      }}
                      placeholder="Scan barcode or type product name…"
                      className="w-full h-full px-2 py-1.5 bg-transparent focus:outline-none focus:bg-white focus:ring-2 focus:ring-inset focus:ring-[#3b82f6] placeholder:text-slate-400 font-sans"
                      aria-label="Add new line"
                    />
                    {draftFocused && draftSuggestions.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-300 rounded-md shadow-xl z-30 max-h-72 overflow-auto font-sans">
                        {draftSuggestions.map((p, idx) => (
                          <button
                            key={p.id}
                            type="button"
                            onMouseDown={(e) => { e.preventDefault(); addProductLine(p, 1); }}
                            className={`w-full text-left px-3 py-2 border-b border-slate-100 last:border-0 flex items-center justify-between gap-2 ${
                              idx === activeSuggest ? "bg-[#3b82f6]/10" : "hover:bg-slate-50"
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-slate-800 truncate">{p.name}</div>
                              <div className="text-[11px] text-slate-500">
                                {p.prefix}{p.hsn ? ` · HSN ${p.hsn}` : ""} · {p.gst_rate}% GST · {p.unit}
                              </div>
                            </div>
                            <div className="text-sm font-bold tabular-nums text-[#3b82f6] shrink-0">
                              {inr(Number(p.default_price))}
                            </div>
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
                  <td className="border border-slate-300 px-2 py-1.5 text-right text-slate-300">0.00</td>
                  <td className="border border-slate-300 px-1 py-1.5 text-center">
                    <Plus className="h-3.5 w-3.5 text-slate-400 mx-auto" />
                  </td>
                </tr>

                {/* Filler empty rows so it looks like a sheet */}
                {Array.from({ length: Math.max(0, 4 - lines.length) }).map((_, idx) => (
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
                    <td className="border border-slate-300 px-1 py-1.5"></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Sticky Totals Bar */}
      <footer className="fixed bottom-3 left-3 right-3 md:left-6 md:right-6 z-20 bg-white border border-[#e8ecf1] rounded-2xl p-3 md:p-5 shadow-2xl shadow-slate-200/60">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-6">
          <div className="flex flex-wrap gap-4 md:gap-7">
            <div>
              <p className="text-[10px] uppercase font-bold text-[#94a3b8]">Subtotal</p>
              <p className="text-sm md:text-base font-bold text-slate-800 tabular-nums">{inr(subtotal)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-[#94a3b8]">Tax (GST)</p>
              <p className="text-sm md:text-base font-bold text-slate-800 tabular-nums">{inr(tax)}</p>
            </div>
            {f.discount.visible && (
              <div>
                <p className="text-[10px] uppercase font-bold text-[#94a3b8]">Discount (₹)</p>
                <input
                  type="number"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  className="w-20 border-b border-[#e8ecf1] focus:border-[#3b82f6] focus:outline-none text-sm md:text-base font-bold tabular-nums text-slate-800 bg-transparent"
                  aria-label="Discount"
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 md:gap-5">
            <div className="text-right">
              <p className="text-[10px] uppercase font-bold text-[#3b82f6]">Grand Total</p>
              <p className="text-xl md:text-3xl font-bold text-slate-900 tabular-nums">{inr(total)}</p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={saveAndWhatsApp}
                disabled={busy}
                className="bg-[#25D366] hover:bg-[#20bd5c] text-white px-3 md:px-5 py-3 rounded-xl font-bold min-h-[44px] gap-2"
                aria-label="Save and send WhatsApp"
              >
                <MessageCircle className="h-4 w-4" />
                <span className="hidden sm:inline">Send</span>
              </Button>
              <Button
                type="button"
                onClick={save}
                disabled={busy}
                className="bg-[#3b82f6] hover:bg-blue-600 text-white px-4 md:px-7 py-3 rounded-xl font-bold shadow-lg shadow-blue-500/20 min-h-[44px] gap-2"
              >
                <Check className="h-4 w-4" />
                {busy ? "Saving…" : <><span className="hidden sm:inline">Save Bill</span><span className="sm:hidden">Save</span></>}
              </Button>
            </div>
          </div>
        </div>
      </footer>

      <QuickCreatePartyDialog
        open={createCustomerOpen}
        onOpenChange={setCreateCustomerOpen}
        kind="customer"
        onCreated={(c) => {
          setCustomers((prev) => [...prev, c].sort((a, b) => a.name.localeCompare(b.name)));
          setCustomerId(c.id);
        }}
      />
    </div>
  );
}
