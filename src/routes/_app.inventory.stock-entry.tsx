import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/erp/PageHeader";
import { SubCategoryThenItemPicker } from "@/components/erp/SubCategoryThenItemPicker";
import { ReprintLabelDialog } from "@/components/erp/ReprintLabelDialog";
import type { LabelItem } from "@/components/erp/LabelSheet";
import { useAuth } from "@/lib/auth-store";
import { isAdmin } from "@/lib/roles";
import { toast } from "sonner";
import { Boxes, Printer, Warehouse, X, Check } from "lucide-react";

export const Route = createFileRoute("/_app/inventory/stock-entry")({
  component: StockEntryPage,
});

type Picked = {
  id: string;
  name: string;
  finish?: string | null;
  item_group?: string | null;
  unit?: string | null;
  default_cost?: number | null;
  default_price?: number | null;
};

function StockEntryPage() {
  const nav = useNavigate();
  const user = useAuth((s) => s.user);
  const ready = useAuth((s) => s.ready);

  const [godowns, setGodowns] = useState<{ id: string; name: string }[]>([]);
  const [godownId, setGodownId] = useState<string>("");
  const [picked, setPicked] = useState<Picked | null>(null);
  const [qty, setQty] = useState<number>(1);
  const [cost, setCost] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const [labelOpen, setLabelOpen] = useState(false);
  const [labelItems, setLabelItems] = useState<LabelItem[]>([]);
  const [format, setFormat] = useState<"thermal" | "a4">("thermal");

  // Admin-only guard.
  useEffect(() => {
    if (ready && !isAdmin(user?.role)) {
      toast.error("Admins only");
      nav({ to: "/inventory" });
    }
  }, [ready, user?.role, nav]);

  useEffect(() => {
    supabase
      .from("godowns")
      .select("id, name")
      .eq("active", true)
      .order("name")
      .then(({ data }) => setGodowns((data ?? []) as any));
  }, []);

  if (!ready || !isAdmin(user?.role)) {
    return (
      <div className="p-10 text-center text-muted-foreground">Checking access…</div>
    );
  }

  const onPick = (p: any) => {
    setPicked({
      id: p.id,
      name: p.name,
      finish: p.finish ?? null,
      item_group: p.item_group ?? null,
      unit: p.unit ?? "pcs",
      default_cost: p.default_cost ?? null,
      default_price: p.default_price ?? null,
    });
    setCost(Number(p.default_cost ?? p.default_price ?? 0));
  };

  const display = picked
    ? picked.finish
      ? `${picked.item_group || picked.name} — ${picked.finish}`
      : picked.name
    : "";

  const submit = async () => {
    if (!picked) {
      toast.error("Pick a sub-category and parameter first");
      return;
    }
    if (qty < 1) {
      toast.error("Quantity must be at least 1");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("mint_stock_entry", {
        _product_id: picked.id,
        _qty: Math.floor(qty),
        _cost: Number(cost) || 0,
        _actor_user_id: user?.id ?? "",
        _godown_id: godownId || null,
      });
      if (error) throw error;
      const rows = (data ?? []) as any[];
      toast.success(`Added ${qty} unit(s) to stock for ${display}`);
      const items: LabelItem[] = rows.map((r) => ({
        id: r.id,
        name: display,
        qr_payload: r.qr_payload ?? { id: r.id, name: display },
      }));
      setLabelItems(items);
      if (items.length > 0) setLabelOpen(true);
      // Reset for the next entry.
      setQty(1);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to add stock");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Direct Stock Entry"
        subtitle="Admin only — add stock for a sub-category & parameter without a bill, then print labels."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/inventory">Back to Inventory</Link>
          </Button>
        }
      />
      <div className="px-4 sm:px-6 lg:px-8 pb-10 max-w-[760px] mx-auto w-full">
        <Card className="p-6 space-y-5">
          <div>
            <Label className="text-xs mb-1.5 block">Sub-category → Parameter</Label>
            <SubCategoryThenItemPicker
              onPickItem={onPick}
              placeholder="Type sub-category, then pick parameter…"
            />
            {picked && (
              <div className="mt-3 flex items-center justify-between rounded-md border border-border/60 bg-muted/40 px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Boxes className="h-4 w-4 text-primary shrink-0" />
                  <span className="font-semibold text-sm truncate">{display}</span>
                </div>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => setPicked(null)}
                  aria-label="Clear selection"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs mb-1.5 block">Quantity</Label>
              <Input
                type="number"
                min={1}
                step={1}
                value={qty || ""}
                onChange={(e) => setQty(Math.max(1, Math.floor(Number(e.target.value) || 0)))}
              />
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">Cost price (per unit)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={cost || ""}
                onChange={(e) => setCost(Number(e.target.value) || 0)}
              />
            </div>
          </div>

          <div>
            <Label className="text-xs mb-1.5 block">Stock into</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setGodownId("")}
                className={`h-10 rounded-md text-sm font-semibold border transition-colors ${
                  godownId === ""
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-foreground border-input hover:bg-muted"
                }`}
              >
                <Warehouse className="h-4 w-4 inline mr-1.5" /> Shop floor
              </button>
              <select
                className={`h-10 rounded-md border px-3 text-sm font-medium ${
                  godownId
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-input"
                }`}
                value={godownId}
                onChange={(e) => setGodownId(e.target.value)}
              >
                <option value="">— Pick a godown —</option>
                {godowns.map((g) => (
                  <option key={g.id} value={g.id} className="bg-background text-foreground">
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <Label className="text-xs mb-1.5 block">Label format</Label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-lg">
              {([
                { v: "thermal", label: "Thermal (50×25mm)" },
                { v: "a4", label: "A4 sheet" },
              ] as const).map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setFormat(o.v)}
                  className={`h-9 rounded-md text-sm font-semibold transition-colors ${
                    format === o.v
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Button onClick={submit} disabled={busy || !picked} className="gap-2">
              <Check className="h-4 w-4" /> {busy ? "Adding…" : "Add stock & print labels"}
            </Button>
            {labelItems.length > 0 && (
              <Button variant="outline" className="gap-2" onClick={() => setLabelOpen(true)}>
                <Printer className="h-4 w-4" /> Reprint last batch
              </Button>
            )}
          </div>
        </Card>
      </div>

      <ReprintLabelDialog
        open={labelOpen}
        onOpenChange={setLabelOpen}
        items={labelItems}
        format={format}
        title="Print stock labels"
      />
    </>
  );
}
