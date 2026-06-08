import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tags, Search, ChevronLeft } from "lucide-react";
import { toast } from "sonner";

type ItemGroup = {
  key: string;
  name: string;
  subcategory_id: string | null;
  sample: any;
  finishes: string[];
};

/**
 * Lets an admin pick an existing ITEM (collapsed by item_group within a
 * sub-category) and add a new PARAMETER (finish) to it. A new product row is
 * created that copies the item's standard fields, only changing `finish`.
 */
export function AddParameterDialog({
  onCreated,
  trigger,
}: {
  onCreated?: () => void;
  trigger?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<ItemGroup | null>(null);
  const [param, setParam] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQuery(""); setPicked(null); setParam("");
    supabase
      .from("products")
      .select("id,name,prefix,hsn,default_price,default_cost,gst_rate,unit,alt_unit,alt_conversion,category,subcategory_id,item_group,finish,reorder_level")
      .eq("active", true)
      .order("name")
      .then(({ data }) => setProducts(data ?? []));
  }, [open]);

  const itemGroups = useMemo<ItemGroup[]>(() => {
    const map = new Map<string, ItemGroup>();
    for (const p of products) {
      const itemName = (p.item_group || p.name) as string;
      const key = `${p.subcategory_id ?? "none"}||${itemName}`;
      let g = map.get(key);
      if (!g) {
        g = { key, name: itemName, subcategory_id: p.subcategory_id ?? null, sample: p, finishes: [] };
        map.set(key, g);
      }
      if (p.finish && String(p.finish).trim()) g.finishes.push(String(p.finish).trim());
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return itemGroups.slice(0, 60);
    return itemGroups
      .filter((g) => g.name.toLowerCase().includes(q) || String(g.sample.prefix ?? "").toLowerCase().includes(q))
      .slice(0, 60);
  }, [itemGroups, query]);

  const submit = async () => {
    if (!picked) return toast.error("Pick an item first");
    const finish = param.trim();
    if (!finish) return toast.error("Enter a parameter name");
    const exists = picked.finishes.some((f) => f.toLowerCase() === finish.toLowerCase());
    if (exists) return toast.error(`"${finish}" already exists for ${picked.name}`);
    setBusy(true);
    try {
      const s = picked.sample;
      const { error } = await supabase.from("products").insert({
        name: s.name,
        prefix: s.prefix,
        hsn: s.hsn ?? null,
        default_price: s.default_price ?? 0,
        default_cost: s.default_cost ?? 0,
        gst_rate: s.gst_rate ?? 18,
        unit: s.unit,
        alt_unit: s.alt_unit ?? null,
        alt_conversion: s.alt_conversion ?? null,
        category: s.category,
        subcategory_id: s.subcategory_id ?? null,
        item_group: s.item_group || s.name,
        finish,
        active: true,
        reorder_level: s.reorder_level ?? 5,
      } as any);
      if (error) throw error;
      toast.success(`Added parameter "${finish}" to ${picked.name}`);
      setOpen(false);
      onCreated?.();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to add parameter");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" className="gap-1">
            <Tags className="h-4 w-4" /> Add parameter
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add parameter to an item</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {!picked ? (
            <div>
              <Label className="text-xs mb-1.5 block">1. Select item</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  autoFocus
                  placeholder="Type item name…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="mt-2 max-h-64 overflow-auto rounded-md border border-border/60">
                {suggestions.length === 0 ? (
                  <div className="p-3 text-xs text-muted-foreground">No items match.</div>
                ) : (
                  suggestions.map((g) => (
                    <button
                      key={g.key}
                      type="button"
                      onClick={() => { setPicked(g); setParam(""); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center justify-between gap-2"
                    >
                      <span className="font-medium truncate">{g.name}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {g.finishes.length} param{g.finishes.length === 1 ? "" : "s"}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setPicked(null)}
                className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                <ChevronLeft className="h-3 w-3" /> Change item
              </button>
              <div className="rounded-md border border-border/60 bg-muted/40 px-3 py-2">
                <div className="font-semibold text-sm">{picked.name}</div>
                {picked.finishes.length > 0 && (
                  <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                    Existing: {picked.finishes.join(", ")}
                  </div>
                )}
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">2. New parameter name</Label>
                <Input
                  autoFocus
                  placeholder="e.g. Orange"
                  value={param}
                  onChange={(e) => setParam(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
                />
              </div>
              <Button className="w-full" onClick={submit} disabled={busy}>
                {busy ? "Adding…" : "Add parameter"}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}