import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/erp/PageHeader";
import { inr } from "@/lib/codes";
import { Plus } from "lucide-react";
import { useUiConfig } from "@/lib/ui-config";

export const Route = createFileRoute("/_app/sales/")({ component: Sales });
function Sales() {
  const cfg = useUiConfig();
  const c = cfg.lists.sales.columns;
  const visibleCount = ["invoice","date","customer","mode","total"].filter((k) => c[k] !== false).length;
  const colSpan = visibleCount + 1;
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("sales").select("*, customers(name)").is("deleted_at", null).order("invoice_date", { ascending: false }).limit(50);
      setRows(data ?? []);
    })();
  }, []);
  return (
    <>
      <PageHeader title="Sales" subtitle="Invoices" actions={<Button asChild className="h-12"><Link to="/sales/new"><Plus className="mr-1 h-5 w-5" />New sale</Link></Button>} />
      <div className="px-8 pb-8">
        <Card className="overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted text-left text-sm">
              <tr>
                {c.invoice  && <th className="p-3">Invoice</th>}
                {c.date     && <th className="p-3">Date</th>}
                {c.customer && <th className="p-3">Customer</th>}
                {c.mode     && <th className="p-3">Mode</th>}
                {c.total    && <th className="p-3">Total</th>}
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  {c.invoice  && <td className="p-3 font-mono font-bold">{r.invoice_no}</td>}
                  {c.date     && <td className="p-3">{new Date(r.invoice_date).toLocaleString()}</td>}
                  {c.customer && <td className="p-3">{r.customers?.name ?? "Walk-in"}</td>}
                  {c.mode     && <td className="p-3 uppercase text-xs font-bold">{r.payment_mode}</td>}
                  {c.total    && <td className="p-3 font-bold">{inr(r.grand_total)}</td>}
                  <td className="p-3 text-right"><Link to="/sales/$id" params={{ id: r.id }} className="text-primary font-semibold">View →</Link></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={colSpan} className="p-10 text-center text-muted-foreground">No sales yet</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}
