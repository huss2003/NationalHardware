import { createLazyFileRoute, getRouteApi } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/erp/PageHeader";
import { DetailSkeleton, TableSkeleton } from "@/components/erp/Skeletons";
import { inr, fmtDate, fmtDateTime } from "@/lib/codes";
import { Printer, MessageCircle } from "lucide-react";
// jspdf + jspdf-autotable (~250KB) loaded only when the user clicks Send.
import { toast } from "sonner";

export const Route = createLazyFileRoute("/_app/sales/$id")({ component: SaleDetail });

const routeApi = getRouteApi("/_app/sales/$id");

function SaleDetail() {
  const { id } = routeApi.useParams();
  const [s, setS] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [shop, setShop] = useState<any>(null);
  const [sending, setSending] = useState(false);
  useEffect(() => {
    (async () => {
      const [a, b, c] = await Promise.all([
        supabase.from("sales").select("*, customers(*)").eq("id", id).single(),
        supabase.from("sales_items").select("*, products(name, hsn)").eq("sale_id", id),
        supabase.from("app_settings").select("*").eq("id", true).maybeSingle(),
      ]);
      setS(a.data); setItems(b.data ?? []); setShop(c.data);
    })();
  }, [id]);
  if (!s) return (<div className="p-8 max-w-[1400px] mx-auto space-y-4"><DetailSkeleton rows={3} /><TableSkeleton rows={5} columns={5} /></div>);
  const sendWhatsApp = async () => {
    if (!s.customers?.phone) { toast.error("Customer has no phone"); return; }
    setSending(true);
    try {
      const { buildInvoicePdf, shareInvoiceOnWhatsApp } = await import("@/lib/invoice-pdf");
      const pdf = buildInvoicePdf({
        shop, sale: s, customer: s.customers,
        items: items.map((it) => ({
          name: it.products?.name ?? "Item", hsn: it.products?.hsn,
          qty: it.qty, rate: it.rate, gst_rate: it.gst_rate,
          line_total: it.line_total, item_instance_id: it.item_instance_id,
        })),
      });
      const blob = pdf.output("blob");
      const path = `${new Date(s.invoice_date).getFullYear()}/${s.invoice_no}.pdf`;
      const up = await supabase.storage.from("invoices").upload(path, blob, { upsert: true, contentType: "application/pdf" });
      let publicUrl: string | undefined;
      if (!up.error) {
        const signed = await supabase.storage.from("invoices").createSignedUrl(path, 60 * 60 * 24 * 30);
        publicUrl = signed.data?.signedUrl;
      }
      await shareInvoiceOnWhatsApp({
        pdf, invoiceNo: s.invoice_no, phone: s.customers.phone,
        shopName: shop?.shop_name, total: Number(s.grand_total), publicUrl,
      });
    } catch (e: any) { toast.error(e.message); }
    setSending(false);
  };
  return (
    <>
      <PageHeader title={`Invoice ${s.invoice_no}`} subtitle={fmtDateTime(s.invoice_date)} actions={
        <div className="flex gap-2 no-print">
          <Button variant="outline" className="h-11 gap-2" disabled={sending} onClick={sendWhatsApp}>
            <MessageCircle className="h-4 w-4" /> {sending ? "Sending…" : "Send WhatsApp Again"}
          </Button>
          <Button className="h-11 gap-2" onClick={() => window.print()}><Printer className="h-4 w-4" />Print</Button>
        </div>
      } />
      <div className="px-4 sm:px-6 lg:px-8 pb-8">
        <Card className="print-area max-w-3xl mx-auto overflow-hidden shadow-lg">
          {/* Brand band */}
          <div className="bg-slate-900 text-white px-8 py-6 flex justify-between items-start">
            <div>
              <div className="text-2xl font-extrabold tracking-tight">{shop?.shop_name ?? "National Hardware and Plywood"}</div>
              {shop?.address && <div className="text-xs opacity-80 mt-1">{shop.address}</div>}
              {shop?.gstin && <div className="text-xs opacity-80">GSTIN: {shop.gstin}</div>}
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-widest opacity-70">Tax Invoice</div>
              <div className="font-extrabold text-xl mt-0.5">{s.invoice_no}</div>
              <div className="text-xs opacity-80">{fmtDate(s.invoice_date)}</div>
            </div>
          </div>

          {/* Bill to + meta */}
          <div className="grid grid-cols-2 gap-4 p-8 pb-4">
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Bill To</div>
              <div className="font-bold text-base mt-1">{s.customers?.name ?? "Walk-in customer"}</div>
              {s.customers?.phone && <div className="text-xs text-muted-foreground">Phone: {s.customers.phone}</div>}
              {s.customers?.gstin && <div className="text-xs text-muted-foreground">GSTIN: {s.customers.gstin}</div>}
              {s.customers?.address && <div className="text-xs text-muted-foreground mt-1">{s.customers.address}</div>}
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-xs space-y-1.5">
              <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1">Invoice Details</div>
              <div className="flex justify-between"><span className="text-muted-foreground">Date</span><b>{fmtDate(s.invoice_date)}</b></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Payment</span><b className="uppercase">{s.payment_mode}</b></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Invoice #</span><b>{s.invoice_no}</b></div>
            </div>
          </div>

          {/* Items */}
          <div className="px-4 sm:px-6 lg:px-8 pb-4">
            <table className="w-full text-sm border rounded-md overflow-hidden">
              <thead>
                <tr className="bg-slate-900 text-white text-left text-xs uppercase tracking-wider">
                  <th className="p-3 font-semibold">Item</th>
                  <th className="p-3 font-semibold">HSN</th>
                  <th className="p-3 font-semibold text-right">Qty</th>
                  <th className="p-3 font-semibold text-right">Rate</th>
                  <th className="p-3 font-semibold text-right">GST%</th>
                  <th className="p-3 font-semibold text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={it.id} className={i % 2 ? "bg-muted/30" : ""}>
                    <td className="p-3">
                      <div className="font-semibold">{it.products?.name}</div>
                      {it.item_instance_id && <div className="font-mono text-[10px] text-muted-foreground">{it.item_instance_id}</div>}
                    </td>
                    <td className="p-3">{it.products?.hsn ?? "—"}</td>
                    <td className="p-3 text-right tabular-nums">{it.qty}</td>
                    <td className="p-3 text-right tabular-nums">{inr(it.rate)}</td>
                    <td className="p-3 text-right">{it.gst_rate}%</td>
                    <td className="p-3 text-right font-semibold tabular-nums">{inr(it.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="px-4 sm:px-6 lg:px-8 pb-8 flex justify-end">
            <div className="w-full max-w-sm bg-muted/50 rounded-lg p-5 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><b className="tabular-nums">{inr(s.subtotal)}</b></div>
              {Number(s.discount) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><b className="tabular-nums text-destructive">− {inr(s.discount)}</b></div>}
              {Number(s.cgst) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">CGST</span><b className="tabular-nums">{inr(s.cgst)}</b></div>}
              {Number(s.sgst) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">SGST</span><b className="tabular-nums">{inr(s.sgst)}</b></div>}
              {Number(s.igst) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">IGST</span><b className="tabular-nums">{inr(s.igst)}</b></div>}
              <div className="flex justify-between text-lg border-t pt-2 mt-2">
                <span className="font-bold">Grand Total</span>
                <b className="tabular-nums">{inr(s.grand_total)}</b>
              </div>
            </div>
          </div>

          <div className="border-t px-8 py-4 text-xs text-muted-foreground flex justify-between">
            <span>Thank you for your business — {shop?.shop_name ?? "National Hardware and Plywood"}.</span>
            <span>System-generated invoice</span>
          </div>
        </Card>
      </div>
    </>
  );
}
