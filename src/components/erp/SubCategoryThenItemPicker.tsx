import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, Layers } from "lucide-react";

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
  const [items, setItems] = useState<any[]>([]);
  const [sub, setSub] = useState<any | null>(null);
  const [query, setQuery] = useState("");
  const [focus, setFocus] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase
      .from("product_subcategories")
      .select("id,name,category")
      .eq("active", true)
      .order("name")
      .then(({ data }) => setSubs(data ?? []));
  }, []);

  useEffect(() => {
    if (!sub) { setItems([]); return; }
    supabase
      .from("products")
      .select("id,name,prefix,hsn,default_price,default_cost,gst_rate,unit,alt_unit,alt_conversion,category,subcategory_id")
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

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!sub) {
      const pool = subs;
      if (!q) return pool.slice(0, 10);
      return pool.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 10);
    }
    if (!q) return items.slice(0, 12);
    return items.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 12);
  }, [sub, subs, items, query]);

  useEffect(() => { setActive(0); }, [query, sub]);

  const reset = () => { setSub(null); setQuery(""); setActive(0); };

  const commit = (idx = active) => {
    const pick = suggestions[idx];
    if (!pick) return;
    if (!sub) {
      setSub(pick);
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      onPickItem(pick);
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
          placeholder={sub ? `Pick item in ${sub.name}…` : placeholder}
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
      </div>
      {focus && suggestions.length > 0 && (
        <div className="absolute z-30 mt-1 w-full bg-popover border border-border/60 rounded-lg shadow-lg max-h-72 overflow-auto">
          {!sub && (
            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/40 border-b">
              Sub-categories
            </div>
          )}
          {sub && (
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
              <span className="font-medium truncate">{s.name}</span>
              {!sub ? (
                <span className="text-[10px] uppercase text-muted-foreground shrink-0">{s.category}</span>
              ) : (
                <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                  ₹{Number(s.default_price ?? s.default_cost ?? 0).toFixed(2)}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      {focus && sub && suggestions.length === 0 && (
        <div className="absolute z-30 mt-1 w-full bg-popover border border-border/60 rounded-lg shadow-lg p-3 text-xs text-muted-foreground">
          No items in this sub-category. Add one from Inventory → New product.
        </div>
      )}
    </div>
  );
}