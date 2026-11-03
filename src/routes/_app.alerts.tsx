import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/erp/PageHeader";
import { fmtDateTime } from "@/lib/codes";
import { PackageX, Search, Truck } from "lucide-react";

export const Route = createFileRoute("/_app/alerts")({ component: Alerts });

type ReorderRow = { product_id: string; name: string; unit: string | null; qty: number; reorder_level: number; supplier_name: string | null };

function Alerts() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: reorder = [] } = useQuery({
    queryKey: ["reorder-list"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("reorder_list");
      if (error) throw error;
      return (data as ReorderRow[]) ?? [];
    },
    staleTime: 60_000,
  });

  const { data: rows = [] } = useQuery({
    queryKey: ["alerts"],
    queryFn: async () => {
      const { data } = await supabase.from("alerts").select("*").order("created_at", { ascending: false }).limit(100);
      return data ?? [];
    },
    staleTime: 30_000,
  });

  const markRead = async (id: string) => {
    await supabase.from("alerts").update({ read_at: new Date().toISOString() }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["alerts"] });
  };

  // Group the reorder list by supplier (derived from last purchase).
  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q ? reorder.filter((r) => r.name.toLowerCase().includes(q) || (r.supplier_name ?? "").toLowerCase().includes(q)) : reorder;
    const map = new Map<string, ReorderRow[]>();
    for (const r of filtered) {
      const key = r.supplier_name || "No supplier (never purchased)";
      (map.get(key) ?? map.set(key, []).get(key)!).push(r);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [reorder, search]);

  return (
    <>
      <PageHeader title="Alerts" />
      <div className="mx-auto max-w-5xl px-4 sm:px-6 pb-10 space-y-6">
        {/* Reorder / low stock */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <PackageX className="h-5 w-5 text-amber-500" /> Reorder list
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-sm font-bold text-amber-700">{reorder.length}</span>
            </h2>
            <div className="relative ml-auto">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search item or supplier" className="w-56 pl-8" />
            </div>
          </div>

          {reorder.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">Nothing to reorder — all stock above its level.</Card>
          ) : groups.map(([supplier, items]) => (
            <Card key={supplier} className="overflow-hidden">
              <div className="flex items-center gap-2 border-b bg-slate-50 px-4 py-2 text-sm font-bold text-slate-700">
                <Truck className="h-4 w-4 text-slate-400" /> {supplier}
                <span className="text-xs font-normal text-muted-foreground">({items.length})</span>
              </div>
              <div className="divide-y">
                {items.map((r) => {
                  const shortfall = Math.max(0, r.reorder_level - r.qty);
                  return (
                    <div key={r.product_id} className="grid grid-cols-[1fr_auto] items-center gap-2 px-4 py-2.5 text-sm">
                      <span className="truncate font-medium text-slate-700">{r.name}</span>
                      <span className="flex items-center gap-3 tabular-nums text-xs">
                        <span className="text-slate-500">{r.qty} / {r.reorder_level} {r.unit ?? ""}</span>
                        {shortfall > 0 && <span className="rounded bg-red-50 px-1.5 py-0.5 font-bold text-red-600">order {shortfall}</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </section>

        {/* System alerts */}
        {rows.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-bold">Notifications</h2>
            {rows.map((a) => (
              <Card key={a.id} className={`p-4 border-l-4 ${a.severity === "critical" ? "border-destructive" : a.severity === "warning" ? "border-amber-500" : "border-primary"}`}>
                <div className="flex justify-between gap-4">
                  <div>
                    <div className="font-bold uppercase">{a.type}</div>
                    <div className="text-xs text-muted-foreground">{fmtDateTime(a.created_at)}</div>
                    <pre className="text-xs mt-1 whitespace-pre-wrap">{JSON.stringify(a.payload, null, 2)}</pre>
                  </div>
                  {!a.read_at && <Button variant="outline" onClick={() => markRead(a.id)}>Mark read</Button>}
                </div>
              </Card>
            ))}
          </section>
        )}
      </div>
    </>
  );
}
