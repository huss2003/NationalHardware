import { createLazyFileRoute, getRouteApi, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageHeader } from "@/components/erp/PageHeader";
import { DetailSkeleton, TableSkeleton } from "@/components/erp/Skeletons";
import { inr, fmtDate } from "@/lib/codes";
import { useAuth } from "@/lib/auth-store";
import { LabelSheet, type LabelItem } from "@/components/erp/LabelSheet";
import { Printer, Ban } from "lucide-react";
import { toast } from "sonner";

export const Route = createLazyFileRoute("/_app/purchases/$id")({ component: PurchaseDetail });

const routeApi = getRouteApi("/_app/purchases/$id");

function PurchaseDetail() {
  const { id } = routeApi.useParams();
  const [pur, setPur] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [units, setUnits] = useState<LabelItem[]>([]);
  const [format, setFormat] = useState<"thermal" | "a4">("thermal");
  const nav = useNavigate();
  const user = useAuth((s) => s.user);
  const isAdmin = user?.role === "admin";
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [voiding, setVoiding] = useState(false);

  const voidPurchase = async () => {
    setVoiding(true);
    const { error } = await supabase.rpc("void_purchase", {
      _purchase_id: id, _reason: voidReason.trim() || "Voided", _actor_user_id: user?.id ?? "",
    });
    setVoiding(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Purchase voided — stock reversed");
    setVoidOpen(false);
    nav({ to: "/purchases" });
  };

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
            {isAdmin && !pur?.deleted_at && (
              <Button variant="outline" className="h-12 gap-2 border-red-200 text-red-600 hover:bg-red-50" onClick={() => setVoidOpen(true)}>
                <Ban className="h-5 w-5" /> Void
              </Button>
            )}
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

      <Dialog open={voidOpen} onOpenChange={(v) => !v && setVoidOpen(false)}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-sm rounded-2xl">
          <DialogTitle>Void purchase {pur?.bill_no}?</DialogTitle>
          <p className="text-sm text-slate-500">
            This cancels the purchase and removes the stock it added. If any purchased item was already sold, it won’t void. The record is kept for audit.
          </p>
          <Input value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="Reason (optional)" />
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setVoidOpen(false)} disabled={voiding}>Cancel</Button>
            <Button className="bg-red-500 hover:bg-red-600" onClick={voidPurchase} disabled={voiding}>{voiding ? "Voiding…" : "Void purchase"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
