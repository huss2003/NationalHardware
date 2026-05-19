import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/erp/PageHeader";
import { StatusPill } from "@/components/erp/StatusPill";
import { inr } from "@/lib/codes";

export const Route = createFileRoute("/_app/inventory/$productId")({ component: ProductDetail });

function ProductDetail() {
  const { productId } = Route.useParams();
  const [product, setProduct] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    (async () => {
      const { data: p } = await supabase.from("products").select("*").eq("id", productId).single();
      setProduct(p);
      const { data: i } = await supabase.from("item_instances").select("*").eq("product_id", productId).order("created_at", { ascending: false });
      setItems(i ?? []);
    })();
  }, [productId]);

  const filtered = filter === "all" ? items : items.filter((i) => i.status === filter);

  if (!product) return <div className="p-8">Loading…</div>;
  const prefix = (product.prefix ?? "").toUpperCase();
  const isPly = prefix === "PLY" || product.category === "plywood";
  const isDoor = prefix === "DOR" || product.category === "door";
  const hasDims = isPly || isDoor;
  const dimUnit = isPly ? "ft" : "in";
  const totalSqft = filtered.reduce((sum, i) => sum + (Number(i.area_sqft) || 0), 0);
  return (
    <>
      <PageHeader title={product.name} subtitle={`${product.category.toUpperCase()} • ${product.prefix} • HSN ${product.hsn ?? "—"} • GST ${product.gst_rate}%`} />
      <div className="px-8 pb-8 space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4"><div className="text-xs text-muted-foreground">Default cost</div><div className="text-2xl font-bold">{inr(product.default_cost)}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Default price</div><div className="text-2xl font-bold">{inr(product.default_price)}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Reorder level</div><div className="text-2xl font-bold">{product.reorder_level}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Total units</div><div className="text-2xl font-bold">{items.length}</div></Card>
        </div>
        {hasDims && (
          <Card className="p-4 bg-muted/30">
            <div className="text-xs text-muted-foreground uppercase font-semibold">Alternate unit • Square feet</div>
            <div className="text-sm mt-1">
              Main unit: <b>pieces</b> • Alt unit: <b>sqft</b> • Formula:{" "}
              <code className="font-mono">
                {isPly ? "Length × Width (in feet)" : "Length × Width ÷ 144 (inches)"}
              </code>
            </div>
            <div className="text-xl font-bold mt-2">
              {filtered.length} pcs • {totalSqft.toFixed(2)} sqft total
            </div>
          </Card>
        )}

        <div className="flex gap-2 flex-wrap">
          {["all","available","sold","damaged","used_in_production","returned","reserved"].map(s => (
            <button key={s} onClick={() => setFilter(s)} className={`px-4 py-2 rounded-full text-sm font-semibold border ${filter === s ? "bg-primary text-primary-foreground" : "bg-card"}`}>{s.replace("_"," ")}</button>
          ))}
        </div>

        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr className="text-left">
                <th className="p-3">Item ID</th>
                <th className="p-3">Status</th>
                <th className="p-3">Default (pcs)</th>
                {hasDims && <th className="p-3">L × W ({dimUnit})</th>}
                {hasDims && <th className="p-3">Alt (sqft)</th>}
                <th className="p-3">Cost</th>
                <th className="p-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => (
                <tr key={i.id} className="border-t hover:bg-muted/40">
                  <td className="p-3 font-mono font-bold"><Link to="/units/$itemId" params={{ itemId: i.id }} className="text-primary">{i.id}</Link></td>
                  <td className="p-3"><StatusPill status={i.status} /></td>
                  <td className="p-3 font-semibold">1 pc</td>
                  {hasDims && (
                    <td className="p-3">
                      {i.length_value && i.width_value
                        ? `${i.length_value} × ${i.width_value}`
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                  )}
                  {hasDims && (
                    <td className="p-3 font-semibold">
                      {i.area_sqft != null ? Number(i.area_sqft).toFixed(2) : <span className="text-muted-foreground">—</span>}
                    </td>
                  )}
                  <td className="p-3">{inr(i.cost_price)}</td>
                  <td className="p-3">{new Date(i.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={hasDims ? 7 : 5} className="p-8 text-center text-muted-foreground">No units</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}
