import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/erp/PageHeader";
import { ScanInput } from "@/components/erp/ScanInput";
import { useAuth } from "@/lib/auth-store";
import { toast } from "sonner";
import { inr } from "@/lib/codes";
import {
  AlertOctagon, Trash2, ArrowLeft, Check, User, Wallet, ScanLine,
  ShoppingCart, Banknote, CreditCard, Smartphone, Clock, Minus, Plus,
} from "lucide-react";
import { useUiConfig } from "@/lib/ui-config";
import { buildInvoicePdf, invoiceFileName, shareInvoiceOnWhatsApp } from "@/lib/invoice-pdf";
import { MessageCircle } from "lucide-react";
import { ScanWarning, type ScanWarningKind } from "@/components/erp/ScanWarning";
import { QuickCreatePartyDialog } from "@/components/erp/QuickCreatePartyDialog";

export const Route = createFileRoute("/_app/sales/new")({ component: NewSale });

type Line = {
  product_id: string; item_instance_id: string | null; name: string;
  qty: number; rate: number; gst_rate: number; hsn?: string | null;
  alt_unit?: string | null; alt_conversion?: number | null;
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

  useEffect(() => {
    supabase.from("customers").select("*").order("name").then(({ data }) => setCustomers(data ?? []));
    supabase.from("products").select("prefix").then(({ data }) =>
      setKnownPrefixes(Array.from(new Set((data ?? []).map((p: any) => p.prefix).filter(Boolean))))
    );
  }, []);
  useEffect(() => {
    const c = customers.find((x) => x.id === customerId);
    setCustomerState(c?.state ?? "");
  }, [customerId, customers]);

  const onScan = async (code: string) => {
    setWarn(null);
    const prefix = code.split("-")[0]?.toUpperCase();
    if (knownPrefixes.length && (!prefix || !knownPrefixes.includes(prefix))) {
      setWarn({ kind: "wrong_prefix", code,
        msg: `Prefix "${prefix || "?"}" is not a known category. Expected one of: ${knownPrefixes.join(", ")}.` });
      return;
    }
    if (lines.find(l => l.item_instance_id === code)) {
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
    setLines([...lines, {
      product_id: item.product_id, item_instance_id: item.id, name: item.products.name,
      qty: 1, rate: Number(item.products.default_price), gst_rate: Number(item.products.gst_rate),
      hsn: item.products.hsn,
      alt_unit: (item.products as any).alt_unit ?? null,
      alt_conversion: (item.products as any).alt_conversion ?? null,
    }]);
    toast.success(`Added ${item.id}`);
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

  return (
    <>
      <PageHeader
        title="New Sale"
        subtitle="Scan items, choose a customer, and record payment."
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => nav({ to: "/sales" })}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button size="sm" disabled={busy} onClick={save} className="gap-2">
              <Check className="h-4 w-4" /> {busy ? "Saving…" : "Save Invoice"}
            </Button>
          </>
        }
      />
      <div className="px-8 pb-10 max-w-[1400px] mx-auto w-full">
        <div className="grid gap-5 grid-cols-1 lg:grid-cols-3">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-5">
            {/* Scanner */}
            <Card className="p-6">
              <SectionHeader
                icon={ScanLine}
                title="Scan Items"
                description="Use a barcode or QR scanner to add available stock."
              />
              <div className="mt-5">
                <ScanInput onScan={onScan} invalid={!!warn} />
              </div>
              {warn && <ScanWarning kind={warn.kind} message={warn.msg} code={warn.code} />}
            </Card>

            {/* Cart */}
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <SectionHeader
                  icon={ShoppingCart}
                  title="Cart"
                  description={`${lines.length} item${lines.length === 1 ? "" : "s"} in this invoice.`}
                />
                {lines.length > 0 && (
                  <span className="text-sm font-semibold tabular-nums">
                    {inr(subtotal)}
                  </span>
                )}
              </div>

              <div className="mt-5">
                {lines.length === 0 ? (
                  <div className="border border-dashed border-border/60 rounded-xl py-14 px-6 text-center">
                    <ScanLine className="h-7 w-7 text-muted-foreground mx-auto mb-2" />
                    <div className="text-sm font-semibold text-foreground">No items scanned yet</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Scan a barcode above to add an item to this sale.
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border/60">
                          <th className="text-left font-medium py-2 pr-3">Item</th>
                          <th className="text-left font-medium py-2 px-3 w-36">Qty</th>
                        <th className="text-left font-medium py-2 px-3 w-32">Alt. Unit</th>
                          <th className="text-left font-medium py-2 px-3 w-28">Rate</th>
                          {f.gst_rate.visible && (
                            <th className="text-left font-medium py-2 px-3 w-20">GST</th>
                          )}
                          <th className="text-right font-medium py-2 px-3 w-28">Total</th>
                          <th className="w-8"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {lines.map((l, i) => (
                          <tr key={i}>
                            <td className="py-3 pr-3">
                              <div className="font-medium text-foreground">{l.name}</div>
                              <div className="font-mono text-[11px] text-muted-foreground truncate max-w-[220px]">
                                {l.item_instance_id}
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <div className="inline-flex items-center rounded-md border border-input">
                                <button
                                  type="button"
                                  className="h-8 w-8 grid place-items-center text-muted-foreground hover:text-foreground"
                                  onClick={() => upd(i, { qty: Math.max(1, l.qty - 1) })}
                                >
                                  <Minus className="h-3 w-3" />
                                </button>
                                <input
                                  className="h-8 w-12 text-center text-sm bg-transparent border-x border-input focus:outline-none tabular-nums"
                                  type="number"
                                  value={l.qty}
                                  onChange={(e) =>
                                    upd(i, { qty: Math.max(1, Number(e.target.value)) })
                                  }
                                />
                                <button
                                  type="button"
                                  className="h-8 w-8 grid place-items-center text-muted-foreground hover:text-foreground"
                                  onClick={() => upd(i, { qty: l.qty + 1 })}
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                              </div>
                            </td>
                            <td className="py-3 px-3 text-xs tabular-nums">
                              {l.alt_unit && l.alt_conversion
                                ? <span className="text-foreground font-medium">{(l.qty * Number(l.alt_conversion)).toLocaleString("en-IN", { maximumFractionDigits: 3 })} <span className="text-muted-foreground font-normal">{l.alt_unit}</span></span>
                                : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="py-3 px-3">
                              <Input
                                className="h-8 tabular-nums"
                                type="number"
                                value={l.rate}
                                onChange={(e) => upd(i, { rate: Number(e.target.value) })}
                              />
                            </td>
                            {f.gst_rate.visible && (
                              <td className="py-3 px-3">
                                <Input
                                  className="h-8 tabular-nums"
                                  type="number"
                                  value={l.gst_rate}
                                  onChange={(e) =>
                                    upd(i, { gst_rate: Number(e.target.value) })
                                  }
                                />
                              </td>
                            )}
                            <td className="py-3 px-3 text-right font-semibold tabular-nums">
                              {inr(l.qty * l.rate)}
                            </td>
                            <td className="py-3 pl-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => rm(i)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            <Card className="p-6 lg:sticky lg:top-6 space-y-5">
              {f.customer.visible && (
                <div>
                  <FieldLabel icon={User}>
                    Customer {f.customer.required && <span className="text-destructive">*</span>}
                  </FieldLabel>
                  <div className="flex gap-2">
                    <select
                      className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                      value={customerId}
                      onChange={(e) => setCustomerId(e.target.value)}
                    >
                      <option value="">
                        {f.customer.required ? "Select customer" : "Walk-in customer"}
                      </option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <Button type="button" variant="outline" size="sm" className="h-10 gap-1" onClick={() => setCreateCustomerOpen(true)}>
                      <Plus className="h-4 w-4" /> New
                    </Button>
                  </div>
                </div>
              )}

              {f.payment_mode.visible && (
                <div>
                  <FieldLabel icon={Wallet}>Payment Method</FieldLabel>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { v: "cash", label: "Cash", icon: Banknote },
                      { v: "upi", label: "UPI", icon: Smartphone },
                      { v: "card", label: "Card", icon: CreditCard },
                      { v: "credit", label: "Credit", icon: Clock },
                    ].map((o) => {
                      const Icon = o.icon;
                      const active = paymentMode === o.v;
                      return (
                        <button
                          key={o.v}
                          type="button"
                          onClick={() => setPaymentMode(o.v)}
                          className={`flex items-center gap-2 h-10 px-3 rounded-md text-sm font-medium transition-colors border ${
                            active
                              ? "border-primary bg-primary/5 text-foreground"
                              : "border-input text-muted-foreground hover:text-foreground hover:bg-muted/50"
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                          {o.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {f.discount.visible && (
                <div>
                  <FieldLabel>
                    Discount {f.discount.required && <span className="text-destructive">*</span>}
                  </FieldLabel>
                  <Input
                    className="h-10 tabular-nums"
                    type="number"
                    placeholder="0"
                    value={discount}
                    onChange={(e) => setDiscount(Number(e.target.value))}
                  />
                </div>
              )}

              <div className="border-t border-border/60 pt-4 space-y-2.5 text-sm">
                <Row label="Subtotal" value={inr(subtotal)} />
                <Row label="GST" value={inr(tax)} />
                {f.discount.visible && discount > 0 && (
                  <Row label="Discount" value={`− ${inr(discount)}`} />
                )}
              </div>
              <div className="border-t border-border/60 pt-4 flex items-baseline justify-between">
                <span className="text-sm font-medium text-muted-foreground">Total</span>
                <span className="text-2xl font-semibold tracking-tight tabular-nums">
                  {inr(total)}
                </span>
              </div>

              <Button
                className="w-full gap-2"
                size="lg"
                disabled={busy}
                onClick={save}
              >
                <Check className="h-4 w-4" />
                {busy ? "Saving…" : "Save Invoice"}
              </Button>
              <Button
                variant="outline"
                className="w-full gap-2"
                size="lg"
                disabled={busy}
                onClick={saveAndWhatsApp}
              >
                <MessageCircle className="h-4 w-4" />
                Save & Send WhatsApp
              </Button>
              <Button
                variant="ghost"
                className="w-full -mt-2"
                onClick={() => nav({ to: "/sales" })}
              >
                Cancel
              </Button>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}

function SectionHeader({
  icon: Icon, title, description,
}: { icon: any; title: string; description?: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
    </div>
  );
}

function FieldLabel({
  icon: Icon, children,
}: { icon?: any; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {children}
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}
