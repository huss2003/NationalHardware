import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/erp/PageHeader";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_app/production")({ component: Production });
function Production() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("production_orders").select("*, products!finished_product_id(name)").order("created_at", { ascending: false }).then(({ data }) => setRows(data ?? []));
  }, []);
  return (
    <>
      <PageHeader title="Production" subtitle="Door manufacturing orders" actions={<Button asChild className="h-12"><Link to="/production/new"><Plus className="mr-1 h-5 w-5" />New order</Link></Button>} />
      <div className="px-8 pb-8">
        <Card className="overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted text-left text-sm"><tr><th className="p-3">Date</th><th className="p-3">Product</th><th className="p-3">Qty</th><th className="p-3">Status</th><th></th></tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t">
                  <td className="p-3">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="p-3 font-bold">{r.products?.name}</td>
                  <td className="p-3">{r.qty}</td>
                  <td className="p-3"><span className="px-2 py-1 rounded-full text-xs font-bold bg-muted uppercase">{r.status}</span></td>
                  <td className="p-3 text-right"><Link to="/production/$id" params={{ id: r.id }} className="text-primary font-semibold">Open →</Link></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={5} className="p-10 text-center text-muted-foreground">No production orders</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}
