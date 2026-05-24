import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-store";
import { moveOutToShop, type SelectedUnit } from "@/lib/godown-stock";
import { Search } from "lucide-react";

type Row = {
  id: string; product_id: string; is_lot: boolean; qty_on_hand: number;
  cost_price: number; products: { name: string; sku: string | null; gst_rate: number; default_price: number } | null;
};

export function GodownStockOutDialog({
  open, onOpenChange, godownId, godownName, onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  godownId: string;
  godownName: string;
  onDone: () => void;
}) {
  const user = useAuth((s) => s.user);
  const [rows, setRows] = useState<Row[]>([]);
  const [picked, setPicked] = useState<Map<string, SelectedUnit>>(new Map());
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPicked(new Map()); setQ("");
    (async () => {
      const ii = await supabase.from("item_instances")
        .select("id, product_id, is_lot, qty_on_hand, cost_price, products(name, sku, gst_rate, default_price)")
        .eq("status", "available").eq("godown_id", godownId).limit(1000);
      setRows((ii.data ?? []) as any);
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

  const toggle = (r: Row) => {
    setPicked((m) => {
      const n = new Map(m);
      if (n.has(r.id)) n.delete(r.id);
      else n.set(r.id, {
        id: r.id, product_id: r.product_id, is_lot: r.is_lot,
        qty_on_hand: r.qty_on_hand, cost_price: Number(r.cost_price ?? 0),
        rate: Number(r.products?.default_price ?? r.cost_price ?? 0),
        gst_rate: Number(r.products?.gst_rate ?? 18),
        takeQty: r.is_lot ? 1 : undefined,
        productName: r.products?.name ?? r.id,
      });
      return n;
    });
  };

  const setTakeQty = (id: string, v: number) => {
    setPicked((m) => {
      const n = new Map(m);
      const u = n.get(id);
      if (u) n.set(id, { ...u, takeQty: Math.max(1, v) });
      return n;
    });
  };

  const submit = async () => {
    if (picked.size === 0) { toast.error("Pick at least one unit"); return; }
    setBusy(true);
    try {
      const units = [...picked.values()];
      await moveOutToShop(units, user?.id);
      toast.success(`Stocked out ${units.length} unit(s)`);
      onDone();
      onOpenChange(false);
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[760px] max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Stock Out · {godownName} → Shop</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1.5">
                Pick units to move from this godown to the shop floor. Existing barcodes stay with the items — no new stickers are printed.
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Search or scan ID" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <div className="rounded-md border max-h-[260px] overflow-y-auto mt-2">
                {filtered.length === 0
                  ? <div className="text-xs text-muted-foreground text-center py-8">No available stock in this godown.</div>
                  : filtered.map((r) => {
                    const sel = picked.get(r.id);
                    return (
                      <div key={r.id} className="border-b last:border-0">
                        <label className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/40">
                          <Checkbox checked={!!sel} onCheckedChange={() => toggle(r)} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{r.products?.name ?? "—"}</div>
                            <div className="text-[11px] font-mono text-muted-foreground">
                              {r.id}{r.is_lot ? ` · lot qty ${r.qty_on_hand}` : ""}
                            </div>
                          </div>
                        </label>
                        {sel && r.is_lot && (
                          <div className="px-10 pb-2 grid grid-cols-2 gap-2">
                            <div>
                              <div className="text-[11px] text-muted-foreground">Qty out</div>
                              <Input type="number" min={1} max={r.qty_on_hand} className="h-8"
                                value={sel.takeQty ?? 1}
                                onChange={(e) => setTakeQty(r.id, Number(e.target.value) || 1)} />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={submit} disabled={busy || picked.size === 0}>
              {busy ? "Working…" : `Move ${picked.size} unit(s) to shop`}
            </Button>
          </DialogFooter>
        </DialogContent>
    </Dialog>
  );
}