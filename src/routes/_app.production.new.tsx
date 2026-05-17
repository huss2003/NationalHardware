import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/erp/PageHeader";
import { useAuth } from "@/lib/auth-store";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/production/new")({ component: NewOrder });

function NewOrder() {
  const nav = useNavigate();
  const user = useAuth(s => s.user);
  const [boms, setBoms] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [bomId, setBomId] = useState("");
  const [qty, setQty] = useState(1);
  const [assigned, setAssigned] = useState("");
  useEffect(() => {
    supabase.from("bom").select("*, products!finished_product_id(*)").eq("active", true).then(({ data }) => setBoms(data ?? []));
    supabase.from("shop_users").select("*").eq("active", true).then(({ data }) => setStaff(data ?? []));
  }, []);
  const save = async () => {
    const bom = boms.find(b => b.id === bomId);
    if (!bom) { toast.error("Select a BOM"); return; }
    const { data, error } = await supabase.from("production_orders").insert({
      finished_product_id: bom.finished_product_id, bom_id: bom.id, qty, assigned_to: assigned || null, created_by: user?.id, status: "in_progress",
    }).select().single();
    if (error) { toast.error(error.message); return; }
    nav({ to: "/production/$id", params: { id: data.id } });
  };
  return (
    <>
      <PageHeader title="New production order" />
      <div className="px-8 pb-8 max-w-xl">
        <Card className="p-5 space-y-3">
          <select className="h-12 w-full rounded-md border bg-background px-3" value={bomId} onChange={(e) => setBomId(e.target.value)}>
            <option value="">-- Choose BOM --</option>
            {boms.map(b => <option key={b.id} value={b.id}>{b.products?.name} v{b.version}</option>)}
          </select>
          <Input type="number" className="h-12" placeholder="Qty" value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value)))} />
          <select className="h-12 w-full rounded-md border bg-background px-3" value={assigned} onChange={(e) => setAssigned(e.target.value)}>
            <option value="">-- Assign worker --</option>
            {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <Button className="h-12 w-full" onClick={save}>Create order</Button>
        </Card>
      </div>
    </>
  );
}
