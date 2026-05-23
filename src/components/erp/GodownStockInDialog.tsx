import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-store";
import { moveToGodown, mintFreshIntoGodown } from "@/lib/godown-stock";
import { ReprintLabelDialog } from "@/components/erp/ReprintLabelDialog";
import type { LabelItem } from "@/components/erp/LabelSheet";
import { Search } from "lucide-react";

type Row = { id: string; product_id: string; godown_id: string | null; cost_price: number; products: { name: string; sku: string | null } | null };
type Product = { id: string; name: string; sku: string | null; default_cost: number };

export function GodownStockInDialog({
  open, onOpenChange, godownId, godownName, onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  godownId: string;
  godownName: string;
  onDone: () => void;
}) {
  const user = useAuth((s) => s.user);
  const [tab, setTab] = useState<"move" | "new">("move");
  const [rows, setRows] = useState<Row[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState(1);
  const [cost, setCost] = useState(0);
  const [busy, setBusy] = useState(false);
  const [print, setPrint] = useState<LabelItem[]>([]);

  useEffect(() => {
    if (!open) return;
    setPicked(new Set()); setQ(""); setProductId(""); setQty(1); setCost(0);
    (async () => {
      const [ii, pp] = await Promise.all([
        supabase.from("item_instances")
          .select("id, product_id, godown_id, cost_price, products(name, sku)")
          .eq("status", "available").neq("godown_id", godownId).limit(500),
        supabase.from("products").select("id, name, sku, default_cost").eq("active", true).order("name"),
      ]);
      // Also include unassigned (godown_id is null) — neq excludes nulls in PostgREST, fetch separately
      const { data: nulls } = await supabase.from("item_instances")
        .select("id, product_id, godown_id, cost_price, products(name, sku)")
        .eq("status", "available").is("godown_id", null).limit(500);
      const merged = [...(ii.data ?? []), ...(nulls ?? [])];
      setRows(merged as any);
      setProducts((pp.data ?? []) as any);
    })();
  }, [open, godownId]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      r.id.toLowerCase().includes(s) ||
      (r.products?.name ?? "").toLowerCase().includes(s) ||
      (r.products?.sku ?? "").toLowerCase().includes(s),
    );
  }, [rows, q]);

  const toggle = (id: string) => {
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const doMove = async () => {
    if (picked.size === 0) { toast.error("Pick at least one unit"); return; }
    setBusy(true);
    try {
      await moveToGodown([...picked], godownId, user?.id);
      toast.success(`Moved ${picked.size} unit(s) into ${godownName}`);
      onDone();
      onOpenChange(false);
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
    finally { setBusy(false); }
  };

  const doMint = async () => {
    if (!productId || qty < 1) { toast.error("Pick a product and qty"); return; }
    setBusy(true);
    try {
      const stickers = await mintFreshIntoGodown(productId, qty, godownId, cost, user?.id);
      toast.success(`Received ${stickers.length} sticker(s)`);
      setPrint(stickers);
      onDone();
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[720px] max-h-[88vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Stock In · {godownName}</DialogTitle></DialogHeader>
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="move">Move existing stock</TabsTrigger>
              <TabsTrigger value="new">Receive new (mint)</TabsTrigger>
            </TabsList>

            <TabsContent value="move" className="space-y-3 pt-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Search by name, SKU, or ID" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <div className="rounded-md border max-h-[360px] overflow-y-auto">
                {filtered.length === 0
                  ? <div className="text-xs text-muted-foreground text-center py-8">No transferable stock found.</div>
                  : filtered.map((r) => (
                    <label key={r.id} className="flex items-center gap-3 px-3 py-2 border-b last:border-0 cursor-pointer hover:bg-muted/40">
                      <Checkbox checked={picked.has(r.id)} onCheckedChange={() => toggle(r.id)} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{r.products?.name ?? "—"}</div>
                        <div className="text-[11px] font-mono text-muted-foreground">{r.id} · {r.godown_id ? "in another godown" : "unassigned"}</div>
                      </div>
                    </label>
                  ))}
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button onClick={doMove} disabled={busy || picked.size === 0}>
                  {busy ? "Moving…" : `Move ${picked.size} unit(s)`}
                </Button>
              </DialogFooter>
            </TabsContent>

            <TabsContent value="new" className="space-y-3 pt-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Product</label>
                <select className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                  value={productId}
                  onChange={(e) => {
                    setProductId(e.target.value);
                    const p = products.find((x) => x.id === e.target.value);
                    if (p) setCost(Number(p.default_cost ?? 0));
                  }}>
                  <option value="">— pick a product —</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}{p.sku ? ` · ${p.sku}` : ""}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Quantity</label>
                  <Input type="number" min={1} className="h-10" value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Cost / unit</label>
                  <Input type="number" min={0} className="h-10" value={cost} onChange={(e) => setCost(Number(e.target.value) || 0)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button onClick={doMint} disabled={busy || !productId}>
                  {busy ? "Receiving…" : `Receive ${qty} unit(s)`}
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <ReprintLabelDialog
        open={print.length > 0}
        onOpenChange={(v) => { if (!v) { setPrint([]); onOpenChange(false); } }}
        items={print}
        title="Print received stickers"
      />
    </>
  );
}