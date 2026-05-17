import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/erp/PageHeader";
import { inr } from "@/lib/codes";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_app/purchases")({ component: Purchases });

function Purchases() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("purchases")
        .select("*, suppliers(name)")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(50);
      setRows(data ?? []);
    })();
  }, []);

  return (
    <>
      <PageHeader title="Purchases" subtitle="Bills received from suppliers" actions={
        <Button asChild className="h-12"><Link to="/purchases/new"><Plus className="mr-1 h-5 w-5" />New purchase</Link></Button>
      } />
      <div className="px-8 pb-8">
        <Card className="overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted text-left text-sm">
              <tr><th className="p-3">Date</th><th className="p-3">Bill #</th><th className="p-3">Supplier</th><th className="p-3">Total</th><th className="p-3"></th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3">{new Date(r.bill_date).toLocaleDateString()}</td>
                  <td className="p-3 font-mono">{r.bill_no ?? "—"}</td>
                  <td className="p-3 font-semibold">{r.suppliers?.name ?? "—"}</td>
                  <td className="p-3 font-bold">{inr(r.grand_total)}</td>
                  <td className="p-3 text-right"><Link to="/purchases/$id" params={{ id: r.id }} className="text-primary font-semibold">View →</Link></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={5} className="p-10 text-center text-muted-foreground">No purchases yet</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}
