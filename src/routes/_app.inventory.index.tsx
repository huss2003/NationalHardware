import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/erp/PageHeader";
import { Plus, Package, Search, SlidersHorizontal } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { inr } from "@/lib/codes";

export const Route = createFileRoute("/_app/inventory/")({ component: Inventory });

function Inventory() {
  const [products, setProducts] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [stockStatus, setStockStatus] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const nav = useNavigate();

  const load = async () => {
    const { data: prods } = await supabase.from("products").select("*").eq("active", true).order("name");
    const { data: items } = await supabase.from("item_instances").select("product_id").eq("status", "available");
    const c: Record<string, number> = {};
    (items ?? []).forEach((i: any) => { c[i.product_id] = (c[i.product_id] ?? 0) + 1; });
    setProducts(prods ?? []);
    setCounts(c);
  };
  useEffect(() => { load(); }, []);

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

  const allChecked = filtered.length > 0 && filtered.every((p) => selected.has(p.id));
  const toggleAll = () => {
    const s = new Set(selected);
    if (allChecked) filtered.forEach((p) => s.delete(p.id));
    else filtered.forEach((p) => s.add(p.id));
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
                <TableHead>Item details</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="w-[260px]">Stock level</TableHead>
                <TableHead className="text-right">Unit price</TableHead>
                <TableHead className="text-right pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => {
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
                      <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="rounded-md"
                      >
                        <Link to="/inventory/$productId" params={{ productId: p.id }}>
                          View
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
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
    </>
  );
}

function NewProductDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", category: "plywood", prefix: "PLY", hsn: "", gst_rate: 18, default_cost: 0, default_price: 0, reorder_level: 5, unit: "pcs" });
  const submit = async () => {
    if (!form.name || !form.prefix) { toast.error("Name and prefix required"); return; }
    const { error } = await supabase.from("products").insert({ ...form, prefix: form.prefix.toUpperCase() } as any);
    if (error) toast.error(error.message); else { toast.success("Product created"); setOpen(false); onCreated(); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="h-12"><Plus className="mr-1 h-5 w-5" />New product</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New product</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <select className="h-10 rounded-md border bg-background px-3" value={form.category} onChange={(e) => {
              const cat = e.target.value as any;
              const pref = cat === "plywood" ? "PLY" : cat === "hardware" ? "HDR" : cat === "door" ? "DOR" : "OTH";
              setForm({ ...form, category: cat, prefix: pref });
            }}>
              <option value="plywood">Plywood</option>
              <option value="hardware">Hardware</option>
              <option value="door">Door</option>
              <option value="other">Other</option>
            </select>
            <Input placeholder="Prefix" value={form.prefix} onChange={(e) => setForm({ ...form, prefix: e.target.value.toUpperCase() })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="HSN" value={form.hsn} onChange={(e) => setForm({ ...form, hsn: e.target.value })} />
            <Input type="number" placeholder="GST %" value={form.gst_rate} onChange={(e) => setForm({ ...form, gst_rate: Number(e.target.value) })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input type="number" placeholder="Default cost" value={form.default_cost} onChange={(e) => setForm({ ...form, default_cost: Number(e.target.value) })} />
            <Input type="number" placeholder="Default price" value={form.default_price} onChange={(e) => setForm({ ...form, default_price: Number(e.target.value) })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input type="number" placeholder="Reorder level" value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: Number(e.target.value) })} />
            <Input placeholder="Unit (pcs, sheet, kg)" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
          </div>
          <Button className="w-full h-12" onClick={submit}>Create</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
