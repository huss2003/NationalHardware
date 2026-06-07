import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, Layers, Plus } from "lucide-react";
import { toast } from "sonner";
import { NewProductDialog } from "@/components/erp/NewProductDialog";

/**
 * Two-stage typeahead: first suggests sub-categories, then suggests items
 * (products) within the chosen sub-category. Calls onPickItem with the
 * selected product row and resets internal state.
 */
export function SubCategoryThenItemPicker({
  onPickItem,
  placeholder = "Type sub-category, then pick item…",
  className,
  autoFocus = false,
}: {
  onPickItem: (product: any) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  const [subs, setSubs] = useState<any[]>([]);
  const [standalone, setStandalone] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [sub, setSub] = useState<any | null>(null);
  const [query, setQuery] = useState("");
  const [focus, setFocus] = useState(false);
  const [active, setActive] = useState(0);
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [subFull, setSubFull] = useState<any | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase
      .from("product_subcategories")
      .select("id,name,category")
      .eq("active", true)
      .order("name")
      .then(({ data }) => setSubs(data ?? []));
    // Standalone products (no sub-category) — show alongside sub-categories
    supabase
      .from("products")
      .select("id,name,prefix,hsn,default_price,default_cost,gst_rate,unit,alt_unit,alt_conversion,category,subcategory_id,item_group,finish")
      .eq("active", true)
      .is("subcategory_id", null)
      .order("name")
      .then(({ data }) => setStandalone(data ?? []));
  }, []);

  // Fetch the full sub-category row (with dimension_label & default prices)
  // whenever a sub is selected, so we can pass it to NewProductDialog.
  useEffect(() => {
    if (!sub) { setSubFull(null); return; }
    supabase
      .from("product_subcategories")
      .select("id,name,category,dimension_label,default_price_per_pc,default_price_per_sqft")
      .eq("id", sub.id)
      .maybeSingle()
      .then(({ data }) => setSubFull(data ?? sub));
  }, [sub]);

  useEffect(() => {
    if (!sub) { setItems([]); return; }
    supabase
      .from("products")
      .select("id,name,prefix,hsn,default_price,default_cost,gst_rate,unit,alt_unit,alt_conversion,category,subcategory_id,item_group,finish")
      .eq("active", true)
      .eq("subcategory_id" as any, sub.id)
      .order("name")
      .then(({ data }) => setItems(data ?? []));
  }, [sub]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setFocus(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // Label for a product variant: the parameter (finish) when present, else its name.
  const variantLabel = (p: any) => (p.finish && String(p.finish).trim() ? p.finish : p.name);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!sub) {
      const subPool = subs.map((s) => ({ ...s, __kind: "sub" as const }));
      const itemPool = standalone.map((p) => ({ ...p, __kind: "item" as const }));
      const pool = [...subPool, ...itemPool];
      const filtered = q
        ? pool.filter((s) => s.name.toLowerCase().includes(q))
        : pool;
      return filtered.slice(0, 16);
    }
    // Sub picked: flat list of every product (parameter) in the sub-category.
    const pool = items.map((p) => ({ ...p, __kind: "variant" as const }));
    if (!q) return pool.slice(0, 30);
    return pool
      .filter((p) =>
        String(variantLabel(p)).toLowerCase().includes(q) ||
        (p.item_group ?? "").toLowerCase().includes(q) ||
        (p.name ?? "").toLowerCase().includes(q),
      )
      .slice(0, 30);
  }, [sub, subs, standalone, items, query]);

  useEffect(() => { setActive(0); }, [query, sub]);

  const reset = () => { setSub(null); setQuery(""); setActive(0); };

  // Enter a sub-category. If it resolves to a single product, the effect below
  // auto-adds it (parameters load asynchronously).
  const pickSub = (s: any) => {
    setSub(s);
    setQuery("");
    setActive(0);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const commit = (idx = active) => {
    const pick = suggestions[idx];
    if (!pick) return;
    if (!sub) {
      if (pick.__kind === "item") {
        onPickItem(pick);
        reset();
        setTimeout(() => inputRef.current?.focus(), 0);
        return;
      }
      pickSub(pick);
    } else {
      onPickItem(pick);
      reset();
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  // Auto-add when a freshly-picked sub-category contains exactly one product.
  useEffect(() => {
    if (sub && items.length === 1 && !query) {
      onPickItem(items[0]);
      reset();
      setTimeout(() => inputRef.current?.focus(), 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sub, items]);

  const exactItemMatch = useMemo(() => {
    if (!sub) return null;
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return items.find((p) => p.name.toLowerCase() === q) ?? null;
  }, [sub, items, query]);

  const quickCreateItem = async () => {
    if (!sub) return;
    setFocus(false);
    setCreateOpen(true);
  };

  const handleCreated = (prod?: any) => {
    setCreateOpen(false);
    if (prod) {
      setItems((prev) => [...prev, prod].sort((a, b) => a.name.localeCompare(b.name)));
      onPickItem(prod);
      reset();
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  return (
    <div className={`relative ${className ?? ""}`} ref={boxRef}>
      <div className="flex items-center gap-1.5 rounded-md border border-input bg-background h-10 px-2">
        {sub ? (
          <button
            type="button"
            onClick={reset}
            className="flex items-center gap-1 text-xs font-semibold bg-primary/10 text-primary px-2 py-1 rounded shrink-0 hover:bg-primary/20"
            title="Back to sub-categories"
          >
            <ChevronLeft className="h-3 w-3" /> {sub.name}
          </button>
        ) : (
          <Layers className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
        <input
          ref={inputRef}
          autoFocus={autoFocus}
          className="flex-1 h-full bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground min-w-0"
        placeholder={sub ? `Pick parameter in ${sub.name}…` : "Type item or sub-category…"}
          value={query}
          onFocus={() => setFocus(true)}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((n) => Math.min(n + 1, suggestions.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActive((n) => Math.max(0, n - 1)); }
            else if (e.key === "Enter") { e.preventDefault(); commit(); }
            else if (e.key === "Escape") { reset(); }
            else if (e.key === "Backspace" && !query && sub) { e.preventDefault(); reset(); }
          }}
        />
        {sub && (
          <button
            type="button"
            onClick={quickCreateItem}
            disabled={creating || !!exactItemMatch}
            className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded bg-primary text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
            title="Add this as a new item in this sub-category"
          >
            <Plus className="h-3 w-3" /> Add item
          </button>
        )}
      </div>
      {sub && (
        <NewProductDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          trigger={null}
          onCreated={handleCreated}
          defaults={{
            category: (subFull?.category ?? sub.category) as any,
            subcategory: (subFull ?? sub) as any,
            size: subFull?.dimension_label ?? sub.name,
            name: query.trim(),
          }}
        />
      )}
      {focus && suggestions.length > 0 && (
        <div className="absolute z-30 mt-1 w-full bg-popover border border-border/60 rounded-lg shadow-lg max-h-72 overflow-auto">
          {!sub ? (
            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/40 border-b">
              Items & Sub-categories
            </div>
          ) : (
            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/40 border-b flex items-center justify-between">
              <span>Parameters in {sub.name}</span>
              <button type="button" onClick={reset} className="text-primary hover:underline normal-case font-semibold">← back</button>
            </div>
          )}
          {suggestions.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => commit(i)}
              className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 ${
                i === active ? "bg-primary/10" : "hover:bg-muted"
              }`}
            >
              {s.__kind === "variant" ? (
                <span className="min-w-0 flex flex-col">
                  <span className="font-medium truncate">{variantLabel(s)}</span>
                  {s.finish && s.item_group && (
                    <span className="text-[10px] text-muted-foreground truncate">{s.item_group}</span>
                  )}
                </span>
              ) : (
                <span className="font-medium truncate">{s.name}</span>
              )}
              {s.__kind === "variant" ? (
                <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                  ₹{Number(s.default_cost ?? s.default_price ?? 0).toFixed(2)}
                </span>
              ) : !sub ? (
                <span className="text-[10px] uppercase shrink-0 flex items-center gap-1.5">
                  {s.__kind === "item" && (
                    <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold">item</span>
                  )}
                  <span className="text-muted-foreground">{s.category}</span>
                </span>
              ) : (
                <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                  ₹{Number(s.default_cost ?? s.default_price ?? 0).toFixed(2)}
                </span>
              )}
            </button>
          ))}
          {sub && query.trim() && !exactItemMatch && (
            <button
              type="button"
              disabled={creating}
              onMouseDown={(e) => e.preventDefault()}
              onClick={quickCreateItem}
              className="w-full text-left px-3 py-2 text-sm font-semibold text-primary border-t border-border/60 flex items-center gap-1 hover:bg-muted"
            >
              <Plus className="h-4 w-4" /> {creating ? "Creating…" : `Create item "${query.trim()}" in ${sub.name}`}
            </button>
          )}
        </div>
      )}
      {focus && sub && suggestions.length === 0 && (
        <div className="absolute z-30 mt-1 w-full bg-popover border border-border/60 rounded-lg shadow-lg">
          <div className="p-3 text-xs text-muted-foreground">
            No parameters in <span className="font-medium text-foreground">{sub.name}</span>{query.trim() ? " match." : " yet."}
          </div>
          {query.trim() && (
            <button
              type="button"
              disabled={creating}
              onMouseDown={(e) => e.preventDefault()}
              onClick={quickCreateItem}
              className="w-full text-left px-3 py-2 text-sm font-semibold text-primary border-t border-border/60 flex items-center gap-1 hover:bg-muted"
            >
              <Plus className="h-4 w-4" /> {creating ? "Creating…" : `Create item "${query.trim()}" in ${sub.name}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}