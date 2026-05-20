import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/erp/PageHeader";
import { DetailSkeleton, TableSkeleton } from "@/components/erp/Skeletons";
import { ScanInput } from "@/components/erp/ScanInput";
import { useAuth } from "@/lib/auth-store";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/production/$id")({ component: OrderPage });

function OrderPage() {
  const { id } = Route.useParams();
  const user = useAuth(s => s.user);
  const [order, setOrder] = useState<any>(null);
  const [need, setNeed] = useState<{ product_id: string; name: string; qty: number; consumed: number }[]>([]);
  const [produced, setProduced] = useState<any[]>([]);

  const load = async () => {
    const { data: o } = await supabase.from("production_orders").select("*, products!finished_product_id(name), bom(*, bom_items(*, products(*)))").eq("id", id).single();
    setOrder(o);
    const { data: mats } = await supabase.from("production_materials").select("product_id").eq("order_id", id);
    const consumed: Record<string, number> = {};
    (mats ?? []).forEach((m: any) => consumed[m.product_id] = (consumed[m.product_id] ?? 0) + 1);
    if (!o) { setNeed([]); return; }
    const list = (o.bom?.bom_items ?? []).map((bi: any) => ({
      product_id: bi.component_product_id, name: bi.products.name,
      qty: bi.qty * o.qty, consumed: consumed[bi.component_product_id] ?? 0,
    }));
    setNeed(list);
    const { data: pr } = await supabase.from("produced_items").select("item_instance_id").eq("order_id", id);
    setProduced(pr ?? []);
  };
  useEffect(() => { load(); }, [id]);

  const onScan = async (code: string) => {
    const { data: it } = await supabase.from("item_instances").select("*").eq("id", code).maybeSingle();
    if (!it) { toast.error(`Unknown ${code}`); return; }
    const row = need.find(n => n.product_id === it.product_id);
    if (!row) { toast.error(`${it.product_id.slice(0,6)} not in BOM`); return; }
    if (row.consumed >= row.qty) { toast.error(`Already enough for ${row.name}`); return; }
    const { error } = await supabase.rpc("consume_material", { _order_id: id, _item_id: code, _actor_user_id: user?.id ?? "" });
    if (error) { toast.error(error.message); return; }
    toast.success(`Consumed ${code}`);
    load();
  };

  const finish = async () => {
    const { error } = await supabase.rpc("complete_production", { _order_id: id, _actor_user_id: user?.id ?? "" });
    if (error) { toast.error(error.message); return; }
    toast.success("Production complete — units minted");
    load();
  };

  if (!order) return (<div className="p-8 max-w-[1400px] mx-auto space-y-4"><DetailSkeleton rows={3} /><TableSkeleton rows={5} columns={5} /></div>);
  const ready = need.every(n => n.consumed >= n.qty);
  return (
    <>
      <PageHeader title={`Order: ${order.products?.name} × ${order.qty}`} subtitle={`Status: ${order.status.toUpperCase()}`} />
      <div className="px-8 pb-8 grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="p-5 space-y-4">
          <div className="font-bold text-lg">Required materials</div>
          {need.map(n => {
            const pct = Math.min(100, (n.consumed / n.qty) * 100);
            return (
              <div key={n.product_id}>
                <div className="flex justify-between font-semibold"><span>{n.name}</span><span>{n.consumed} / {n.qty}</span></div>
                <div className="h-3 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary" style={{ width: `${pct}%` }} /></div>
              </div>
            );
          })}
          {order.status !== "completed" && <ScanInput onScan={onScan} placeholder="Scan a material unit ID" />}
          {order.status !== "completed" && <Button className="w-full h-14 text-lg" disabled={!ready} onClick={finish}>Finish & mint finished units</Button>}
        </Card>
        <Card className="p-5">
          <div className="font-bold text-lg mb-3">Produced units ({produced.length})</div>
          <div className="grid grid-cols-2 gap-2">
            {produced.map(p => <div key={p.item_instance_id} className="p-3 border rounded-lg font-mono font-bold text-center">{p.item_instance_id}</div>)}
            {produced.length === 0 && <div className="text-muted-foreground col-span-2">No finished units yet</div>}
          </div>
        </Card>
      </div>
    </>
  );
}
