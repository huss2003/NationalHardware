import { createLazyFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/erp/PageHeader";
import { inr } from "@/lib/codes";
// XLSX is ~400KB. Loaded on demand only when the user clicks "Export Excel".

export const Route = createLazyFileRoute("/_app/reports")({ component: Reports });

function Reports() {
  const [tab, setTab] = useState<"sales"|"purchase"|"stock"|"movement"|"damaged">("sales");
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      if (tab === "sales") {
        const { data } = await supabase.from("sales").select("invoice_no, invoice_date, grand_total, payment_mode, customers(name)").is("deleted_at", null).order("invoice_date", { ascending: false });
        setRows(data ?? []);
      } else if (tab === "purchase") {
        const { data } = await supabase.from("purchases").select("bill_no, bill_date, grand_total, suppliers(name)").is("deleted_at", null).order("bill_date", { ascending: false });
        setRows(data ?? []);
      } else if (tab === "stock") {
        const { data } = await supabase.from("products").select("name, prefix, reorder_level, item_instances(status)");
        setRows((data ?? []).map((p: any) => ({
          name: p.name, prefix: p.prefix,
          available: p.item_instances.filter((i: any) => i.status === "available").length,
          sold: p.item_instances.filter((i: any) => i.status === "sold").length,
          damaged: p.item_instances.filter((i: any) => i.status === "damaged").length,
          reorder: p.reorder_level,
        })));
      } else if (tab === "movement") {
        const { data } = await supabase.from("item_history").select("item_id, event, created_at, notes").order("created_at", { ascending: false }).limit(200);
        setRows(data ?? []);
      } else if (tab === "damaged") {
        const { data } = await supabase.from("item_instances").select("id, products(name), cost_price, updated_at").eq("status", "damaged");
        setRows(data ?? []);
      }
    })();
  }, [tab]);

  const exportXlsx = async () => {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(rows.map(flat));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, tab);
    XLSX.writeFile(wb, `${tab}-report.xlsx`);
  };

  return (
    <>
      <PageHeader title="Reports" actions={<><Button variant="outline" className="h-12" onClick={() => window.print()}>Print</Button><Button className="h-12" onClick={exportXlsx}>Export Excel</Button></>} />
      <div className="px-8 pb-8 space-y-4">
        <div className="flex gap-2 flex-wrap">
          {(["sales","purchase","stock","movement","damaged"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-full font-semibold text-sm ${tab===t?"bg-primary text-primary-foreground":"bg-card border"}`}>{t.toUpperCase()}</button>
          ))}
        </div>
        <Card className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left">
              <tr>{rows[0] && Object.keys(flat(rows[0])).map(k => <th key={k} className="p-2">{k}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t">
                  {Object.values(flat(r)).map((v: any, j) => <td key={j} className="p-2">{typeof v === "number" && String(Object.keys(flat(r))[j]).includes("total") ? inr(v) : String(v ?? "")}</td>)}
                </tr>
              ))}
              {rows.length === 0 && <tr><td className="p-10 text-center text-muted-foreground">No data</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}
function flat(o: any) { const r: any = {}; for (const k of Object.keys(o)) { const v = o[k]; if (v && typeof v === "object" && !Array.isArray(v)) r[k] = v.name ?? JSON.stringify(v); else r[k] = v; } return r; }
