import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/erp/PageHeader";
import { inr } from "@/lib/codes";
import { Printer } from "lucide-react";

export const Route = createFileRoute("/_app/sales/$id")({ component: SaleDetail });

function SaleDetail() {
  const { id } = Route.useParams();
  const [s, setS] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [shop, setShop] = useState<any>(null);
  useEffect(() => {
    (async () => {
      const [a, b, c] = await Promise.all([
        supabase.from("sales").select("*, customers(*)").eq("id", id).single(),
        supabase.from("sales_items").select("*, products(name, hsn)").eq("sale_id", id),
        supabase.from("app_settings").select("*").eq("id", true).single(),
      ]);
      setS(a.data); setItems(b.data ?? []); setShop(c.data);
    })();
  }, [id]);
  if (!s) return <div className="p-8">Loading…</div>;
  return (
    <>
      <PageHeader title={`Invoice ${s.invoice_no}`} subtitle={new Date(s.invoice_date).toLocaleString()} actions={
        <Button className="h-12 no-print" onClick={() => window.print()}><Printer className="mr-1 h-5 w-5" />Print</Button>
      } />
      <div className="px-8 pb-8">
        <Card className="print-area p-8 max-w-3xl mx-auto">
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="text-2xl font-extrabold">{shop?.shop_name}</div>
              <div className="text-sm text-muted-foreground">{shop?.address}</div>
              {shop?.gstin && <div className="text-sm">GSTIN: <b>{shop.gstin}</b></div>}
            </div>
            <div className="text-right">
              <div className="text-xs uppercase">Tax Invoice</div>
              <div className="font-extrabold text-xl">{s.invoice_no}</div>
              <div className="text-sm">{new Date(s.invoice_date).toLocaleDateString()}</div>
            </div>
          </div>
          <div className="mb-4">
            <div className="text-xs text-muted-foreground">Bill To</div>
            <div className="font-bold">{s.customers?.name ?? "Walk-in"}</div>
            {s.customers?.gstin && <div className="text-sm">GSTIN: {s.customers.gstin}</div>}
            {s.customers?.address && <div className="text-sm">{s.customers.address}</div>}
          </div>
          <table className="w-full text-sm border-t">
            <thead><tr className="text-left bg-muted"><th className="p-2">Item</th><th className="p-2">HSN</th><th className="p-2">Qty</th><th className="p-2">Rate</th><th className="p-2">GST%</th><th className="p-2 text-right">Total</th></tr></thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-t">
                  <td className="p-2"><b>{it.products?.name}</b>{it.item_instance_id && <div className="font-mono text-xs text-muted-foreground">{it.item_instance_id}</div>}</td>
                  <td className="p-2">{it.products?.hsn ?? "—"}</td>
                  <td className="p-2">{it.qty}</td>
                  <td className="p-2">{inr(it.rate)}</td>
                  <td className="p-2">{it.gst_rate}%</td>
                  <td className="p-2 text-right">{inr(it.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="ml-auto mt-4 w-full max-w-xs space-y-1 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><b>{inr(s.subtotal)}</b></div>
            <div className="flex justify-between"><span>Discount</span><b>− {inr(s.discount)}</b></div>
            <div className="flex justify-between"><span>CGST</span><b>{inr(s.cgst)}</b></div>
            <div className="flex justify-between"><span>SGST</span><b>{inr(s.sgst)}</b></div>
            <div className="flex justify-between"><span>IGST</span><b>{inr(s.igst)}</b></div>
            <div className="flex justify-between text-xl border-t pt-2"><span>Grand Total</span><b>{inr(s.grand_total)}</b></div>
            <div className="text-xs text-muted-foreground">Mode: {s.payment_mode.toUpperCase()}</div>
          </div>
        </Card>
      </div>
    </>
  );
}
