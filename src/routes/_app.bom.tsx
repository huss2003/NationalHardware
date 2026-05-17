import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/erp/PageHeader";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/bom")({ component: BomPage });

function BomPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [boms, setBoms] = useState<any[]>([]);
  const [finishedId, setFinishedId] = useState("");
  const [lines, setLines] = useState<{ component_product_id: string; qty: number }[]>([]);

  const load = async () => {
    const { data: p } = await supabase.from("products").select("*").eq("active", true).order("name");
    setProducts(p ?? []);
    const { data: b } = await supabase.from("bom").select("*, products!finished_product_id(name), bom_items(qty, products(name))").eq("active", true).order("created_at", { ascending: false });
    setBoms(b ?? []);
  };
  useEffect(() => { load(); }, []);

  const addLine = () => setLines([...lines, { component_product_id: "", qty: 1 }]);
  const save = async () => {
    if (!finishedId || lines.length === 0) { toast.error("Pick finished product and components"); return; }
    const { data: bom, error } = await supabase.from("bom").insert({ finished_product_id: finishedId, version: 1 }).select().single();
    if (error) { toast.error(error.message); return; }
    const { error: e2 } = await supabase.from("bom_items").insert(lines.map(l => ({ bom_id: bom.id, ...l })));
    if (e2) { toast.error(e2.message); return; }
    toast.success("BOM saved");
    setFinishedId(""); setLines([]); load();
  };

  return (
    <>
      <PageHeader title="Bill of Materials" subtitle="Define what raw materials make a finished product" />
      <div className="px-8 pb-8 grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="p-5 space-y-3">
          <div className="font-bold text-lg">New BOM</div>
          <select className="h-12 w-full rounded-md border bg-background px-3" value={finishedId} onChange={(e) => setFinishedId(e.target.value)}>
            <option value="">-- Finished product --</option>
            {products.filter(p => p.category === "door" || p.category === "other").map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="flex gap-2 items-center">
                <select className="flex-1 h-11 rounded-md border bg-background px-2" value={l.component_product_id} onChange={(e) => setLines(lines.map((x, idx) => idx===i ? {...x, component_product_id: e.target.value} : x))}>
                  <option value="">-- component --</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <Input className="w-24 h-11" type="number" value={l.qty} onChange={(e) => setLines(lines.map((x, idx) => idx===i ? {...x, qty: Number(e.target.value)} : x))} />
                <Button size="icon" variant="ghost" onClick={() => setLines(lines.filter((_, idx) => idx !== i))}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <Button variant="outline" onClick={addLine}><Plus className="h-4 w-4 mr-1" />Add component</Button>
          </div>
          <Button className="w-full h-12" onClick={save}>Save BOM</Button>
        </Card>
        <Card className="p-5">
          <div className="font-bold text-lg mb-3">Existing BOMs</div>
          <div className="space-y-3">
            {boms.map(b => (
              <div key={b.id} className="p-3 border rounded-xl">
                <div className="font-bold">{b.products?.name} <span className="text-xs text-muted-foreground">v{b.version}</span></div>
                <ul className="text-sm mt-1 list-disc pl-5">
                  {b.bom_items.map((bi: any, idx: number) => <li key={idx}>{bi.qty} × {bi.products?.name}</li>)}
                </ul>
              </div>
            ))}
            {boms.length === 0 && <div className="text-muted-foreground">No BOMs yet</div>}
          </div>
        </Card>
      </div>
    </>
  );
}
