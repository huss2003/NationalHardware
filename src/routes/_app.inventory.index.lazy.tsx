import { createLazyFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/erp/PageHeader";
import {
  Package, Search, SlidersHorizontal,
  ArrowDownToLine, ArrowUpFromLine, History,
  ArrowUp, ArrowDown, ChevronsUpDown, ChevronRight, ChevronDown,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { inr } from "@/lib/codes";
import { TableSkeleton } from "@/components/erp/Skeletons";
import { NewProductDialog } from "@/components/erp/NewProductDialog";
import { Layers } from "lucide-react";

export const Route = createLazyFileRoute("/_app/inventory/")({ component: Inventory });

function Inventory() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [stockStatus, setStockStatus] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  type SortKey = "name" | "sku" | "stock" | "price";
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyProduct, setHistoryProduct] = useState<any>(null);
  const [historyRows, setHistoryRows] = useState<any[] | null>(null);
  const nav = useNavigate();

  const { data, isLoading: loading, refetch } = useQuery({
    queryKey: ["inventory", "products"],
    queryFn: async () => {
      const [prodsRes, stockRes, subRes] = await Promise.all([
        supabase.from("products").select("*").eq("active", true).order("name"),
        supabase.rpc("stock_by_product"),
        supabase.from("product_subcategories").select("*").eq("active", true).order("category").order("name"),
      ]);
      const c: Record<string, number> = {};
      (stockRes.data ?? []).forEach((r: any) => {
        c[r.product_id] = Number(r.available_qty) || 0;
      });
      return {
        products: prodsRes.data ?? [],
        subcats: subRes.data ?? [],
        counts: c,
      };
    },
  });
  const products = data?.products ?? [];
  const subcats = data?.subcats ?? [];
  const counts = data?.counts ?? {};
  const load = () => { void refetch(); };

  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.category).filter(Boolean))),
    [products],
  );

  const stockLabel = (count: number, reorder: number) => {
    if (count === 0) return "empty" as const;
    if (count <= reorder) return "low" as const;
    return "ok" as const;
  };

  const filtered = products.filter((p) => {
    const query = q.toLowerCase();
    const matchesQ =
      !q ||
      p.name.toLowerCase().includes(query) ||
      (p.sku ?? "").toLowerCase().includes(query) ||
      (p.prefix ?? "").toLowerCase().includes(query);
    const matchesCat = category === "all" || p.category === category;
    const status = stockLabel(counts[p.id] ?? 0, p.reorder_level);
    const matchesStatus = stockStatus === "all" || stockStatus === status;
    return matchesQ && matchesCat && matchesStatus;
  });

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const get = (p: any): string | number => {
      switch (sortKey) {
        case "sku": return (p.sku ?? p.prefix ?? "").toLowerCase();
        case "stock": return counts[p.id] ?? 0;
        case "price": return Number(p.default_price ?? 0);
        default: return (p.name ?? "").toLowerCase();
      }
    };
    return [...filtered].sort((a, b) => {
      const va = get(a); const vb = get(b);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }, [filtered, sortKey, sortDir, counts]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  // Group sorted products by sub-category. "Uncategorized" bucket for null.
  const grouped = useMemo(() => {
    const subMap = new Map<string, any>(subcats.map((s) => [s.id, s]));
    const buckets = new Map<string, { id: string; name: string; category: string; items: any[] }>();
    for (const p of sorted) {
      const sid = p.subcategory_id ?? "__uncat__";
      if (!buckets.has(sid)) {
        const meta = sid === "__uncat__"
          ? { id: "__uncat__", name: "Uncategorized", category: "—" }
          : { id: sid, name: subMap.get(sid)?.name ?? "Unknown sub-category", category: subMap.get(sid)?.category ?? "—" };
        buckets.set(sid, { ...meta, items: [] });
      }
      buckets.get(sid)!.items.push(p);
    }
    return Array.from(buckets.values()).sort((a, b) =>
      a.id === "__uncat__" ? 1 : b.id === "__uncat__" ? -1 :
      (a.category + a.name).localeCompare(b.category + b.name),
    );
  }, [sorted, subcats]);

  const searching = q.trim().length > 0 || category !== "all" || stockStatus !== "all";
  const toggleGroup = (id: string) => {
    const s = new Set(expanded);
    s.has(id) ? s.delete(id) : s.add(id);
    setExpanded(s);
  };

  const openHistory = async (p: any) => {
    setHistoryProduct(p);
    setHistoryOpen(true);
    setHistoryRows(null);
    const { data: items } = await supabase
      .from("item_instances")
      .select("id")
      .eq("product_id", p.id)
      .limit(200);
    const ids = (items ?? []).map((i: any) => i.id);
    if (ids.length === 0) { setHistoryRows([]); return; }
    const { data: h } = await supabase
      .from("item_history")
      .select("id,event,created_at,notes,item_id")
      .in("item_id", ids)
      .order("created_at", { ascending: false })
      .limit(50);
    setHistoryRows(h ?? []);
  };

  const allChecked = sorted.length > 0 && sorted.every((p) => selected.has(p.id));
  const toggleAll = () => {
    const s = new Set(selected);
    if (allChecked) sorted.forEach((p) => s.delete(p.id));
    else sorted.forEach((p) => s.add(p.id));
    setSelected(s);
  };
  const toggleOne = (id: string) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };

  return (
    <>
      <PageHeader
        title="Inventory"
        subtitle="Manage your warehouse stock, pricing, and locations."
        actions={
          <>
            <Button asChild variant="outline"><Link to="/inventory/scan">Scan unit</Link></Button>
            <Button asChild variant="outline" className="gap-1">
              <Link to="/inventory/subcategories"><Layers className="h-4 w-4" /> Sub-categories</Link>
            </Button>
            <NewProductDialog onCreated={load} />
          </>
        }
      />
      <div className="px-8 pb-10 max-w-[1400px] mx-auto w-full space-y-5">
        {/* Filter bar */}
        <Card className="p-3 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[260px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by SKU, name, or barcode…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-11 pl-9 bg-background border-border/60"
            />
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-11 rounded-md border border-border/60 bg-background px-3 text-sm min-w-[150px] capitalize"
          >
            <option value="all">Category</option>
            {categories.map((c) => (
              <option key={c} value={c} className="capitalize">{c}</option>
            ))}
          </select>
          <select
            value={stockStatus}
            onChange={(e) => setStockStatus(e.target.value)}
            className="h-11 rounded-md border border-border/60 bg-background px-3 text-sm min-w-[150px]"
          >
            <option value="all">Stock Status</option>
            <option value="ok">In stock</option>
            <option value="low">Low</option>
            <option value="empty">Empty</option>
          </select>
          <Button variant="outline" size="icon" className="h-11 w-11 rounded-md" aria-label="More filters">
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
        </Card>

        {/* Inventory table */}
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 pl-4">
                  <Checkbox checked={allChecked} onCheckedChange={toggleAll} aria-label="Select all" />
                </TableHead>
                <SortableHead label="Item details" active={sortKey === "name"} dir={sortDir} onClick={() => toggleSort("name")} />
                <SortableHead label="SKU" active={sortKey === "sku"} dir={sortDir} onClick={() => toggleSort("sku")} />
                <TableHead>Category</TableHead>
                <SortableHead label="Stock level" active={sortKey === "stock"} dir={sortDir} onClick={() => toggleSort("stock")} className="w-[260px]" />
                <SortableHead label="Unit price" active={sortKey === "price"} dir={sortDir} onClick={() => toggleSort("price")} className="text-right" align="right" />
                <TableHead className="text-right pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={7} className="p-0">
                    <TableSkeleton rows={6} columns={7} showHeader={false} />
                  </TableCell>
                </TableRow>
              )}
              {!loading && grouped.flatMap((g) => {
                const isOpen = expanded.has(g.id) || searching;
                const totalStock = g.items.reduce((a, p) => a + (counts[p.id] ?? 0), 0);
                const header = (
                  <TableRow
                    key={`grp-${g.id}`}
                    className="bg-muted/40 hover:bg-muted/60 cursor-pointer"
                    onClick={() => toggleGroup(g.id)}
                  >
                    <TableCell colSpan={7} className="py-2.5 pl-4">
                      <div className="flex items-center gap-2">
                        {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                        {g.category !== "—" && (
                          <Badge variant="outline" className="capitalize text-[10px] font-semibold">{g.category}</Badge>
                        )}
                        <span className="font-semibold text-foreground">{g.name}</span>
                        <span className="text-xs text-muted-foreground ml-1">
                          {g.items.length} item{g.items.length === 1 ? "" : "s"} · {totalStock} in stock
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
                if (!isOpen) return [header];
                const rows = g.items.map((p) => {
                const count = counts[p.id] ?? 0;
                const cap = Math.max(count, p.reorder_level * 4, 50);
                const pct = Math.min(100, Math.round((count / cap) * 100));
                const status = stockLabel(count, p.reorder_level);
                const barColor =
                  status === "empty" ? "bg-destructive"
                  : status === "low" ? "bg-warning"
                  : "bg-success";
                const countColor =
                  status === "empty" ? "text-destructive"
                  : status === "low" ? "text-warning"
                  : "text-foreground";
                return (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer"
                    onClick={() => nav({ to: "/inventory/$productId", params: { productId: p.id } })}
                  >
                    <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selected.has(p.id)}
                        onCheckedChange={() => toggleOne(p.id)}
                        aria-label={`Select ${p.name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-muted grid place-items-center shrink-0 overflow-hidden">
                          {p.image_url ? (
                            <img src={p.image_url} alt="" className="object-cover w-full h-full" />
                          ) : (
                            <Package className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-foreground truncate">{p.name}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {p.location ? `Loc: ${p.location}` : `Prefix: ${p.prefix}`}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {p.sku ?? `${p.prefix}-${String(p.id).slice(0, 6).toUpperCase()}`}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize font-medium rounded-md">
                        {p.category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm">
                            <span className={`font-semibold ${countColor}`}>{count}</span>
                            <span className="text-muted-foreground"> / {cap}</span>
                          </div>
                          {status === "low" && (
                            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-warning/15 text-warning">
                              Low
                            </span>
                          )}
                          {status === "empty" && (
                            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-destructive/15 text-destructive">
                              Empty
                            </span>
                          )}
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full ${barColor} transition-all`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {inr(p.default_price ?? 0)}
                    </TableCell>
                    <TableCell className="text-right pr-6" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex items-center gap-0.5">
                        <Button
                          asChild
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-success hover:bg-success/10 hover:text-success"
                          title="Stock in"
                        >
                          <Link to="/purchases/new"><ArrowDownToLine className="h-4 w-4" /></Link>
                        </Button>
                        <Button
                          asChild
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-primary hover:bg-primary/10 hover:text-primary"
                          title="Stock out"
                        >
                          <Link to="/sales/new"><ArrowUpFromLine className="h-4 w-4" /></Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="View history"
                          onClick={() => openHistory(p)}
                        >
                          <History className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
                });
                return [header, ...rows];
              })}
              {!loading && grouped.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    No products match these filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {filtered.length > 0 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-border/60 text-xs text-muted-foreground">
              <span>
                Showing <span className="font-semibold text-foreground">1</span>–
                <span className="font-semibold text-foreground">{filtered.length}</span> of{" "}
                <span className="font-semibold text-foreground">{products.length}</span> entries
              </span>
            </div>
          )}
        </Card>
      </div>
      {/* History dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              History • {historyProduct?.name ?? ""}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            {historyRows === null && (
              <div className="space-y-2 py-2">
                {[0,1,2,3].map((i) => (
                  <div key={i} className="h-10 rounded-md bg-muted animate-pulse" />
                ))}
              </div>
            )}
            {historyRows && historyRows.length === 0 && (
              <div className="text-sm text-muted-foreground py-6 text-center">
                No history yet for this product.
              </div>
            )}
            {historyRows && historyRows.length > 0 && (
              <ol className="relative border-l-2 border-primary/30 ml-2 space-y-3 pl-5 py-2">
                {historyRows.map((h) => (
                  <li key={h.id} className="relative">
                    <span className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full bg-primary" />
                    <div className="text-xs font-semibold uppercase tracking-wider">
                      {String(h.event).replace(/_/g, " ")}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {new Date(h.created_at).toLocaleString()}
                      {h.notes ? ` • ${h.notes}` : ""}
                    </div>
                    <div className="text-[11px] font-mono text-muted-foreground/80 mt-0.5">
                      {h.item_id}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SortableHead({
  label, active, dir, onClick, className, align = "left",
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
  className?: string;
  align?: "left" | "right";
}) {
  const Arrow = !active ? ChevronsUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider hover:text-foreground transition-colors ${
          active ? "text-foreground" : "text-muted-foreground"
        } ${align === "right" ? "ml-auto" : ""}`}
      >
        {label}
        <Arrow className="h-3 w-3" />
      </button>
    </TableHead>
  );
}

