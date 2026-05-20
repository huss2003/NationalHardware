import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo, memo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/erp/PageHeader";
import { DetailSkeleton, TableSkeleton } from "@/components/erp/Skeletons";
import { StatusPill } from "@/components/erp/StatusPill";
import { inr } from "@/lib/codes";

export const Route = createFileRoute("/_app/inventory/$productId")({ component: ProductDetail });

function ProductDetail() {
  const { productId } = Route.useParams();
  const [product, setProduct] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [compact, setCompact] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("inv-compact") === "1";
  });
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("inv-compact", compact ? "1" : "0");
    }
  }, [compact]);
  const PAGE_SIZE = 50;

  useEffect(() => {
    (async () => {
      const { data: p } = await supabase.from("products").select("*").eq("id", productId).single();
      setProduct(p);
      const { data: i } = await supabase.from("item_instances").select("*").eq("product_id", productId).order("created_at", { ascending: false });
      setItems(i ?? []);
    })();
  }, [productId]);

  const filtered = useMemo(
    () => (filter === "all" ? items : items.filter((i) => i.status === filter)),
    [items, filter]
  );
  useEffect(() => { setPage(0); }, [filter, productId]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageItems = useMemo(
    () => filtered.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE),
    [filtered, currentPage]
  );
  const totalSqft = useMemo(
    () => filtered.reduce((sum, i) => sum + (Number(i.area_sqft) || 0), 0),
    [filtered]
  );

  if (!product) return (<div className="p-8 max-w-[1400px] mx-auto space-y-4"><DetailSkeleton rows={3} /><TableSkeleton rows={5} columns={5} /></div>);
  const prefix = (product.prefix ?? "").toUpperCase();
  const isPly = prefix === "PLY" || product.category === "plywood";
  const isDoor = prefix === "DOR" || product.category === "door";
  const hasDims = isPly || isDoor;
  const dimUnit = isPly ? "ft" : "in";
  const showDims = hasDims && !compact;
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
          {hasDims && (
            <button
              onClick={() => setCompact(c => !c)}
              className={`px-4 py-2 rounded-full text-sm font-semibold border ml-auto ${compact ? "bg-primary text-primary-foreground" : "bg-card"}`}
              title="Hide low-importance columns (L×W, area) for faster rendering on small screens"
            >
              {compact ? "Compact: on" : "Compact: off"}
            </button>
          )}
        </div>

        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr className="text-left">
                <th className="p-3">Item ID</th>
                <th className="p-3">Status</th>
                <th className="p-3">Default (pcs)</th>
                {showDims && <th className="p-3">L × W ({dimUnit})</th>}
                {showDims && <th className="p-3">Alt (sqft)</th>}
                <th className="p-3">Cost</th>
                <th className="p-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((i) => (
                <ItemRow key={i.id} item={i} hasDims={showDims} />
              ))}
              {filtered.length === 0 && <tr><td colSpan={showDims ? 7 : 5} className="p-8 text-center text-muted-foreground">No units</td></tr>}
            </tbody>
          </table>
        </Card>
        {pageCount > 1 && (
          <div className="flex items-center justify-between text-sm">
            <div className="text-muted-foreground">
              Showing {currentPage * PAGE_SIZE + 1}–{Math.min((currentPage + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                className="px-3 py-1.5 rounded-md border bg-card disabled:opacity-40"
              >Prev</button>
              <span className="px-3 py-1.5">Page {currentPage + 1} / {pageCount}</span>
              <button
                onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
                disabled={currentPage >= pageCount - 1}
                className="px-3 py-1.5 rounded-md border bg-card disabled:opacity-40"
              >Next</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

const ItemRow = memo(function ItemRow({ item: i, hasDims }: { item: any; hasDims: boolean }) {
  return (
    <tr className="border-t hover:bg-muted/40">
      <td className="p-3 font-mono font-bold">
        <Link to="/units/$itemId" params={{ itemId: i.id }} preload="intent" className="text-primary">{i.id}</Link>
      </td>
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
  );
});
