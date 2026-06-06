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
  const [group, setGroup] = useState<{ name: string; products: any[] } | null>(null);
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

  // Group a list of products into multi-finish "groups" + finish-less "items".
  const buildItemPool = (list: any[]): any[] => {
    const groups = new Map<string, any[]>();
    const plain: any[] = [];
    for (const p of list) {
      if (p.finish && p.item_group) {
        const arr = groups.get(p.item_group) ?? [];
        arr.push(p);
        groups.set(p.item_group, arr);
      } else {
        plain.push({ ...p, __kind: "item" as const });
      }
    }
    const groupObjs = Array.from(groups.entries()).map(([name, prods]) => ({
      __kind: "group" as const,
      id: `grp_${name}`,
      name,
      category: prods[0].category,
      products: prods,
    }));
    return [...groupObjs, ...plain].sort((a, b) => a.name.localeCompare(b.name));
  };

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (group) {
      let pool = group.products;
      if (q) pool = pool.filter((p) => (p.finish ?? "").toLowerCase().includes(q));
      return pool.map((p) => ({ ...p, __kind: "finish" as const })).slice(0, 30);
    }
    if (!sub) {
      const subPool = subs.map((s) => ({ ...s, __kind: "sub" as const }));
      const itemPool = buildItemPool(standalone);
      const pool = [...subPool, ...itemPool];
      const filtered = q
        ? pool.filter((s) => s.name.toLowerCase().includes(q))
        : pool;
      return filtered.slice(0, 14);
    }
    const pool = buildItemPool(items);
    if (!q) return pool.slice(0, 12);
    return pool.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 12);
  }, [sub, group, subs, standalone, items, query]);

  useEffect(() => { setActive(0); }, [query, sub, group]);

  const reset = () => { setSub(null); setGroup(null); setQuery(""); setActive(0); };

  const openGroup = (g: any) => {
    setGroup({ name: g.name, products: g.products });
    setQuery(""); setActive(0);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const commit = (idx = active) => {
    const pick = suggestions[idx];
    if (!pick) return;
    if (group) {
      onPickItem(pick);
      reset();
      setTimeout(() => inputRef.current?.focus(), 0);
      return;
    }
    if (!sub) {
      if (pick.__kind === "group") { openGroup(pick); return; }
      if (pick.__kind === "item") {
        onPickItem(pick);
        reset();
        setTimeout(() => inputRef.current?.focus(), 0);
        return;
      }
      setSub(pick);
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      if (pick.__kind === "group") { openGroup(pick); return; }
      onPickItem(pick);
      reset();
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

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
        {group ? (
          <button
            type="button"
            onClick={() => { setGroup(null); setQuery(""); setActive(0); setTimeout(() => inputRef.current?.focus(), 0); }}
            className="flex items-center gap-1 text-xs font-semibold bg-amber-100 text-amber-700 px-2 py-1 rounded shrink-0 hover:bg-amber-200"
            title="Back to items"
          >
            <ChevronLeft className="h-3 w-3" /> {group.name}
          </button>
        ) : sub ? (
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
        placeholder={group ? `Pick finish in ${group.name}…` : sub ? `Pick item in ${sub.name}…` : "Type item or sub-category…"}
          value={query}
          onFocus={() => setFocus(true)}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((n) => Math.min(n + 1, suggestions.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActive((n) => Math.max(0, n - 1)); }
            else if (e.key === "Enter") { e.preventDefault(); commit(); }
            else if (e.key === "Escape") { if (group) setGroup(null); else reset(); }
            else if (e.key === "Backspace" && !query && (group || sub)) { e.preventDefault(); if (group) setGroup(null); else reset(); }
          }}
        />
        {sub && !group && (
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
          {group ? (
            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/40 border-b flex items-center justify-between">
              <span>Finishes in {group.name}</span>
              <button type="button" onClick={() => { setGroup(null); setQuery(""); setActive(0); }} className="text-primary hover:underline normal-case font-semibold">← back</button>
            </div>
          ) : !sub ? (
            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/40 border-b">
              Items & Sub-categories
            </div>
          ) : (
            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/40 border-b flex items-center justify-between">
              <span>Items in {sub.name}</span>
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
              <span className="font-medium truncate">{s.__kind === "finish" ? s.finish : s.name}</span>
              {s.__kind === "group" ? (
                <span className="text-[10px] uppercase shrink-0 flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-bold">finish</span>
                  <span className="text-muted-foreground normal-case">{s.products.length} →</span>
                </span>
              ) : s.__kind === "finish" ? (
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
          {sub && !group && query.trim() && !exactItemMatch && (
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
      {focus && group && suggestions.length === 0 && (
        <div className="absolute z-30 mt-1 w-full bg-popover border border-border/60 rounded-lg shadow-lg">
          <div className="p-3 text-xs text-muted-foreground">
            No finishes in <span className="font-medium text-foreground">{group.name}</span>{query.trim() ? " match." : "."}
          </div>
        </div>
      )}
      {focus && sub && !group && suggestions.length === 0 && (
        <div className="absolute z-30 mt-1 w-full bg-popover border border-border/60 rounded-lg shadow-lg">
          <div className="p-3 text-xs text-muted-foreground">
            No items in <span className="font-medium text-foreground">{sub.name}</span>{query.trim() ? " match." : " yet."}
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