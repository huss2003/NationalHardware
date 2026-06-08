import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, Package } from "lucide-react";

/**
 * Two-stage typeahead matching the Sales bill flow:
 *   Stage A: pick an ITEM (products collapsed by name / item_group) — no
 *            sub-category names shown.
 *   Stage B: if the item has multiple parameters (finishes), pick one;
 *            otherwise the single variant is added directly in one step.
 * Calls onPickItem with the selected product row.
 */
export function ItemThenParameterPicker({
  onPickItem,
  placeholder = "Type item name…",
  className,
  autoFocus = false,
}: {
  onPickItem: (product: any) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  const [products, setProducts] = useState<any[]>([]);
  const [group, setGroup] = useState<any | null>(null);
  const [query, setQuery] = useState("");
  const [focus, setFocus] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase
      .from("products")
      .select("id,name,prefix,hsn,default_price,default_cost,gst_rate,unit,alt_unit,alt_conversion,category,subcategory_id,item_group,finish")
      .eq("active", true)
      .order("name")
      .then(({ data }) => setProducts(data ?? []));
  }, []);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setFocus(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const variantLabel = (p: any) => (p.finish && String(p.finish).trim() ? p.finish : p.name);

  // Collapse products by name (within sub-category) into selectable items.
  const itemGroups = useMemo<any[]>(() => {
    const map = new Map<string, any>();
    for (const p of products) {
      const itemName = (p.item_group || p.name) as string;
      const key = `${p.subcategory_id ?? "none"}||${itemName}`;
      let g = map.get(key);
      if (!g) {
        g = { id: key, name: itemName, prefix: p.prefix, products: [] as any[] };
        map.set(key, g);
      }
      g.products.push(p);
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);

  const suggestions = useMemo<any[]>(() => {
    const q = query.trim().toLowerCase();
    if (!group) {
      const pool = itemGroups.map((g) => ({ ...g, __kind: "group" as const }));
      if (!q) return pool;
      return pool.filter((g: any) =>
        g.name.toLowerCase().includes(q) ||
        (g.prefix ? String(g.prefix).toLowerCase().includes(q) : false),
      );
    }
    const pool = (group.products as any[])
      .slice()
      .sort((a, b) => String(variantLabel(a)).localeCompare(String(variantLabel(b))))
      .map((p) => ({ ...p, __kind: "variant" as const }));
    if (!q) return pool.slice(0, 60);
    return pool.filter((p: any) =>
      String(variantLabel(p)).toLowerCase().includes(q) ||
      (p.finish ?? "").toLowerCase().includes(q),
    ).slice(0, 60);
  }, [itemGroups, group, query]);

  useEffect(() => { setActive(0); }, [query, group]);

  const reset = () => { setGroup(null); setQuery(""); setActive(0); };

  const pickGroup = (g: any) => {
    const variants = (g.products ?? []) as any[];
    if (variants.length === 1) {
      onPickItem(variants[0]);
      reset();
      setFocus(false);
      setTimeout(() => inputRef.current?.blur(), 0);
      return;
    }
    setGroup(g); setQuery(""); setActive(0);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const commit = (idx = active) => {
    const pick = suggestions[idx];
    if (!pick) return;
    if (!group) {
      pickGroup(pick);
    } else {
      onPickItem(pick);
      reset();
      setFocus(false);
      setTimeout(() => inputRef.current?.blur(), 0);
    }
  };

  return (
    <div className={`relative ${className ?? ""}`} ref={boxRef}>
      <div className="flex items-center gap-1.5 rounded-md border border-input bg-background h-10 px-2">
        {group ? (
          <button
            type="button"
            onClick={reset}
            className="flex items-center gap-1 text-xs font-semibold bg-primary/10 text-primary px-2 py-1 rounded shrink-0 hover:bg-primary/20"
            title="Back to items"
          >
            <ChevronLeft className="h-3 w-3" /> {group.name}
          </button>
        ) : (
          <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
        <input
          ref={inputRef}
          autoFocus={autoFocus}
          className="flex-1 h-full bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground min-w-0"
          placeholder={group ? `Pick parameter in ${group.name}…` : placeholder}
          value={query}
          onFocus={() => setFocus(true)}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((n) => Math.min(n + 1, suggestions.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActive((n) => Math.max(0, n - 1)); }
            else if (e.key === "Enter") { e.preventDefault(); commit(); }
            else if (e.key === "Escape") { reset(); }
            else if (e.key === "Backspace" && !query && group) { e.preventDefault(); reset(); }
          }}
        />
      </div>
      {focus && suggestions.length > 0 && (
        <div className="absolute z-30 mt-1 w-full bg-popover border border-border/60 rounded-lg shadow-lg max-h-72 overflow-auto">
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/40 border-b flex items-center justify-between">
            <span>{group ? `Parameters in ${group.name}` : "Items"}</span>
            {group && (
              <button type="button" onClick={reset} className="text-primary hover:underline normal-case font-semibold">← back</button>
            )}
          </div>
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
              <span className="min-w-0 flex flex-col">
                <span className="font-medium truncate">
                  {s.__kind === "variant" ? variantLabel(s) : s.name}
                </span>
                {s.__kind === "variant" && s.finish && s.item_group && (
                  <span className="text-[10px] text-muted-foreground truncate">{s.item_group}</span>
                )}
              </span>
              {s.__kind === "variant" ? (
                <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                  ₹{Number(s.default_cost ?? s.default_price ?? 0).toFixed(2)}
                </span>
              ) : (
                <span className="text-[10px] uppercase shrink-0 text-muted-foreground">
                  {(s.products?.length ?? 0) > 1 ? `${s.products.length} params` : s.category}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      {focus && group && suggestions.length === 0 && (
        <div className="absolute z-30 mt-1 w-full bg-popover border border-border/60 rounded-lg shadow-lg">
          <div className="p-3 text-xs text-muted-foreground">
            No parameters in <span className="font-medium text-foreground">{group.name}</span>{query.trim() ? " match." : "."}
          </div>
        </div>
      )}
    </div>
  );
}