import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/erp/PageHeader";
import {
  Plus, Package, Search, SlidersHorizontal,
  ArrowDownToLine, ArrowUpFromLine, History,
  ArrowUp, ArrowDown, ChevronsUpDown,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { inr, makeQrDataUrl } from "@/lib/codes";
import { Label } from "@/components/ui/label";
import { TableSkeleton } from "@/components/erp/Skeletons";
import { SubCategoryPicker, type SubCategory } from "@/components/erp/SubCategoryPicker";
import { Layers } from "lucide-react";

export const Route = createFileRoute("/_app/inventory/")({ component: Inventory });

function Inventory() {
  const [products, setProducts] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
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

  const load = async () => {
    setLoading(true);
    const [prodsRes, stockRes] = await Promise.all([
      supabase.from("products").select("*").eq("active", true).order("name"),
      supabase.rpc("stock_by_product"),
    ]);
    const c: Record<string, number> = {};
    (stockRes.data ?? []).forEach((r: any) => {
      c[r.product_id] = Number(r.available_qty) || 0;
    });
    setProducts(prodsRes.data ?? []);
    setCounts(c);
    setLoading(false);
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
              {!loading && sorted.map((p) => {
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
              })}
              {!loading && sorted.length === 0 && (
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

type NewCat = "plywood" | "hardware" | "door" | "mica" | "other";
const prefixForCat = (c: NewCat) =>
  c === "plywood" ? "PLY" : c === "hardware" ? "HDR" : c === "door" ? "DOR" : c === "mica" ? "MIC" : "OTH";
const hasDimensions = (c: NewCat) => c === "plywood" || c === "door";

function NewProductDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<NewCat>("plywood");
  const [length, setLength] = useState<number>(0);
  const [width, setWidth] = useState<number>(0);
  const [areaInput, setAreaInput] = useState<number>(0);
  const [size, setSize] = useState("");
  const [pricePerSqft, setPricePerSqft] = useState<number>(0);
  const [pricePerPc, setPricePerPc] = useState<number>(0);
  const [qty, setQty] = useState<number>(1);
  const [qrUrl, setQrUrl] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const dimUnit: "ft" | "in" = category === "door" ? "in" : "ft";
  const toSqft = (l: number, w: number) =>
    category === "door" ? (l * w) / 144 : l * w;

  const computedArea = hasDimensions(category) && length && width ? toSqft(length, width) : 0;
  const areaSqft = hasDimensions(category)
    ? (computedArea > 0 ? computedArea : Number(areaInput || 0))
    : 0;
  const sizeLabel = hasDimensions(category)
    ? (length && width ? `${length}x${width} ${dimUnit}` : (areaSqft ? `${areaSqft.toFixed(2)} sqft` : ""))
    : size;
  const unitPrice = hasDimensions(category)
    ? Number(pricePerSqft || 0) * areaSqft
    : Number(pricePerPc || 0);

  const qrPayload = useMemo(
    () => ({ name, category, size: sizeLabel }),
    [name, category, sizeLabel],
  );

  useEffect(() => {
    let cancelled = false;
    if (!name) { setQrUrl(""); return; }
    makeQrDataUrl(qrPayload).then((u) => { if (!cancelled) setQrUrl(u); });
    return () => { cancelled = true; };
  }, [qrPayload, name]);

  const reset = () => {
    setName(""); setCategory("plywood"); setLength(0); setWidth(0);
    setAreaInput(0); setSize(""); setPricePerSqft(0); setPricePerPc(0); setQty(1); setQrUrl("");
  };

  // When length/width change, sync the area input field to the computed value.
  useEffect(() => {
    if (hasDimensions(category) && length && width) {
      setAreaInput(Number(toSqft(length, width).toFixed(4)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [length, width, category]);

  // When user edits Area directly, recompute Breadth from Length (reverse formula).
  const onAreaChange = (val: number) => {
    setAreaInput(val);
    if (length > 0 && val > 0) {
      const newW = category === "door" ? (val * 144) / length : val / length;
      setWidth(Number(newW.toFixed(4)));
    }
  };

  const submit = async () => {
    if (!name.trim()) return toast.error("Name is required");
    if (hasDimensions(category)) {
      if (!areaSqft) return toast.error("Enter length & breadth or area (sqft)");
      if (!pricePerSqft) return toast.error("Price per sqft is required");
    } else {
      if (!size.trim()) return toast.error("Size is required");
      if (!pricePerPc) return toast.error("Price is required");
    }
    if (qty < 1) return toast.error("Quantity must be at least 1");

    setBusy(true);
    try {
      const prefix = prefixForCat(category);
      // 'mica' isn't in the product_category enum on older deployments — fall back to 'other'.
      const dbCategory: any = category;
      const { data: prod, error: pErr } = await supabase
        .from("products")
        .insert({
          name: name.trim(),
          category: dbCategory,
          prefix,
          unit: hasDimensions(category) ? "sheet" : "pcs",
          default_cost: unitPrice,
          default_price: unitPrice,
          gst_rate: 18,
          reorder_level: 5,
        } as any)
        .select()
        .single();
      if (pErr) throw pErr;

      const { data: userRes } = await supabase.auth.getUser();
      const actorId = userRes?.user?.id ?? null;
      const isLot = category === "hardware";

      if (isLot) {
        const { data: nid, error: nErr } = await supabase.rpc("next_item_id", { _prefix: prefix });
        if (nErr) throw nErr;
        const newId = nid as unknown as string;
        const qr: any = { id: newId, name: name.trim(), category, size: sizeLabel, status: "available", lot: true };
        const { error: iErr } = await supabase.from("item_instances").insert({
          id: newId,
          product_id: prod.id,
          status: "available",
          cost_price: unitPrice,
          barcode_payload: newId,
          qr_payload: qr,
          is_lot: true,
          qty_on_hand: qty,
        } as any);
        if (iErr) throw iErr;
        await supabase.from("item_history").insert({
          item_id: newId, event: "purchased" as any, actor_user_id: actorId,
          notes: `Initial stock +${qty}`,
        } as any);
      } else {
        for (let i = 0; i < qty; i++) {
          const { data: nid, error: nErr } = await supabase.rpc("next_item_id", { _prefix: prefix });
          if (nErr) throw nErr;
          const newId = nid as unknown as string;
          const qr: any = { id: newId, name: name.trim(), category, size: sizeLabel, status: "available" };
          if (hasDimensions(category)) {
            if (category === "door") {
              qr.length_in = Number(length) || null;
              qr.width_in = Number(width) || null;
            } else {
              qr.length_ft = Number(length) || null;
              qr.width_ft = Number(width) || null;
            }
            qr.area_sqft = Number(areaSqft.toFixed(2));
          }
          const { error: iErr } = await supabase.from("item_instances").insert({
            id: newId,
            product_id: prod.id,
            status: "available",
            cost_price: unitPrice,
            barcode_payload: newId,
            qr_payload: qr,
            is_lot: false,
            qty_on_hand: 1,
            length_value: hasDimensions(category) ? (Number(length) || null) : null,
            width_value: hasDimensions(category) ? (Number(width) || null) : null,
            area_sqft: hasDimensions(category) ? Number(areaSqft.toFixed(2)) : null,
            dimension_unit: hasDimensions(category) ? dimUnit : null,
          } as any);
          if (iErr) throw iErr;
          await supabase.from("item_history").insert({
            item_id: newId, event: "purchased" as any, actor_user_id: actorId,
            notes: "Initial stock",
          } as any);
        }
      }

      toast.success(`Created ${name} with ${qty} unit${qty > 1 ? "s" : ""}`);
      setOpen(false); reset(); onCreated();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to create product");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button className="h-12"><Plus className="mr-1 h-5 w-5" />New product</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>New product</DialogTitle></DialogHeader>
        <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
          <div>
            <Label className="text-xs">Name</Label>
            <Input placeholder="e.g. Century Sainik MR" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Category</Label>
            <select
              className="h-10 rounded-md border bg-background px-3 w-full text-sm"
              value={category}
              onChange={(e) => setCategory(e.target.value as NewCat)}
            >
              <option value="plywood">Plywood</option>
              <option value="hardware">Hardware</option>
              <option value="door">Door</option>
              <option value="mica">Mica</option>
              <option value="other">Others</option>
            </select>
          </div>

          {hasDimensions(category) ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Length ({dimUnit})</Label>
                  <Input
                    type="number" min={0} step="0.01"
                    value={length || ""}
                    onChange={(e) => setLength(Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label className="text-xs">Breadth ({dimUnit})</Label>
                  <Input
                    type="number" min={0} step="0.01"
                    value={width || ""}
                    onChange={(e) => setWidth(Number(e.target.value))}
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">
                  Area (sqft) — alternate unit
                  <span className="ml-1 text-muted-foreground font-normal">
                    {category === "door" ? "(L × B ÷ 144)" : "(L × B)"}
                  </span>
                </Label>
                <Input
                  type="number" min={0} step="0.01"
                  value={areaInput || ""}
                  onChange={(e) => onAreaChange(Number(e.target.value))}
                />
              </div>
            </>
          ) : (
            <div>
              <Label className="text-xs">Size</Label>
              <Input
                placeholder="e.g. 4 inch, M8x50, 1mm"
                value={size}
                onChange={(e) => setSize(e.target.value)}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {hasDimensions(category) ? (
              <div>
                <Label className="text-xs">Price per sqft (₹)</Label>
                <Input
                  type="number" min={0} step="0.01"
                  value={pricePerSqft || ""}
                  onChange={(e) => setPricePerSqft(Number(e.target.value))}
                />
              </div>
            ) : (
              <div>
                <Label className="text-xs">Price per pc (₹)</Label>
                <Input
                  type="number" min={0} step="0.01"
                  value={pricePerPc || ""}
                  onChange={(e) => setPricePerPc(Number(e.target.value))}
                />
              </div>
            )}
            <div>
              <Label className="text-xs">Quantity (PCS)</Label>
              <Input
                type="number" min={1} step={1}
                value={qty}
                onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
          </div>

          {hasDimensions(category) && areaSqft > 0 && (
            <div className="text-xs text-muted-foreground">
              Area per unit: <span className="font-semibold text-foreground">{areaSqft.toFixed(2)} sqft</span>
              {" • "}Unit price: <span className="font-semibold text-foreground">{inr(unitPrice)}</span>
            </div>
          )}

          <div className="rounded-md border border-border/60 p-3 flex items-center gap-3 bg-muted/30">
            <div className="h-24 w-24 shrink-0 grid place-items-center bg-background rounded border border-border/60">
              {qrUrl ? (
                <img src={qrUrl} alt="QR preview" className="h-24 w-24" />
              ) : (
                <span className="text-[10px] text-muted-foreground text-center px-1">QR preview</span>
              )}
            </div>
            <div className="text-xs space-y-0.5 min-w-0 flex-1">
              <div className="text-muted-foreground uppercase tracking-wider text-[10px] font-semibold">QR value</div>
              <div className="font-mono break-all">{JSON.stringify(qrPayload)}</div>
            </div>
          </div>

          <Button className="w-full h-12" onClick={submit} disabled={busy}>
            {busy ? "Creating…" : "Create"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
