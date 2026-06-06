import { createLazyFileRoute, getRouteApi } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/erp/PageHeader";
import { DetailSkeleton, TableSkeleton } from "@/components/erp/Skeletons";
import { inr, fmtDate } from "@/lib/codes";
import { LabelSheet, type LabelItem } from "@/components/erp/LabelSheet";
import { Printer } from "lucide-react";

export const Route = createLazyFileRoute("/_app/purchases/$id")({ component: PurchaseDetail });

const routeApi = getRouteApi("/_app/purchases/$id");

function PurchaseDetail() {
  const { id } = routeApi.useParams();
  const [pur, setPur] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [units, setUnits] = useState<LabelItem[]>([]);
  const [format, setFormat] = useState<"thermal" | "a4">("thermal");

  useEffect(() => {
    (async () => {
      const { data: p } = await supabase.from("purchases").select("*, suppliers(name)").eq("id", id).single();
      setPur(p);
      const { data: pi } = await supabase.from("purchase_items").select("*, products(name)").eq("purchase_id", id);
      setItems(pi ?? []);
      const ids = (pi ?? []).map((x: any) => x.id);
      if (ids.length) {
        const { data: u } = await supabase.from("item_instances").select("id, qr_payload, products(name)").in("source_purchase_item_id", ids);
        setUnits((u ?? []).map((x: any) => ({ id: x.id, name: x.products?.name ?? "", qr_payload: x.qr_payload })));
      }
    })();
  }, [id]);

  if (!pur) return (<div className="p-8 max-w-[1400px] mx-auto space-y-4"><DetailSkeleton rows={3} /><TableSkeleton rows={5} columns={5} /></div>);

  return (
    <>
      <PageHeader
        title={`Bill ${pur.bill_no ?? pur.id.slice(0,8)}`}
        subtitle={`${pur.suppliers?.name ?? "—"} • ${fmtDate(pur.bill_date)}`}
        actions={
          <div className="flex gap-2 no-print">
            <select className="h-12 rounded-md border bg-background px-3 font-semibold" value={format} onChange={(e) => setFormat(e.target.value as any)}>
              <option value="thermal">Thermal 50×25mm</option>
              <option value="a4">A4 sticker sheet</option>
            </select>
            <Button className="h-12" onClick={() => window.print()}><Printer className="mr-1 h-5 w-5" />Print labels</Button>
          </div>
        }
      />
      <div className="px-4 sm:px-6 lg:px-8 pb-8 space-y-5 no-print">
        <Card className="overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted text-left text-sm">
              <tr><th className="p-3">Product</th><th className="p-3">Qty</th><th className="p-3">Rate</th><th className="p-3">GST%</th><th className="p-3">Total</th></tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-t">
                  <td className="p-3 font-semibold">{it.products?.name}</td>
                  <td className="p-3">{it.qty}</td>
                  <td className="p-3">{inr(it.rate)}</td>
                  <td className="p-3">{it.gst_rate}%</td>
                  <td className="p-3 font-bold">{inr(it.line_total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-muted">
              <tr><td colSpan={4} className="p-3 text-right font-semibold">Subtotal</td><td className="p-3 font-bold">{inr(pur.subtotal)}</td></tr>
              <tr><td colSpan={4} className="p-3 text-right font-semibold">Tax</td><td className="p-3 font-bold">{inr(pur.tax_total)}</td></tr>
              <tr><td colSpan={4} className="p-3 text-right font-extrabold text-lg">Total</td><td className="p-3 font-extrabold text-lg">{inr(pur.grand_total)}</td></tr>
            </tfoot>
          </table>
        </Card>
        <Card className="p-5">
          <div className="font-bold mb-3">{units.length} unit labels generated</div>
          <div className="text-sm text-muted-foreground">Pick format above and tap Print labels. Use Ctrl/Cmd+P preview to verify before printing.</div>
        </Card>
      </div>
      <LabelSheet items={units} format={format} />
    </>
  );
}
