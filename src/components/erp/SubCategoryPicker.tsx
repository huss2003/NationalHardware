import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export type SubCategory = {
  id: string;
  name: string;
  category: string;
  default_price_per_sqft?: number | null;
  default_price_per_pc?: number | null;
};

/** Typeahead picker for product sub-categories with inline create. */
export function SubCategoryPicker({
  value,
  onChange,
  category,
  allowCreate = true,
  placeholder = "Type sub-category (e.g. 18MM 8*4 LC)…",
  className,
}: {
  value: SubCategory | null;
  onChange: (sc: SubCategory | null) => void;
  /** When set, restricts suggestions to this category and pre-fills it on create. */
  category?: string;
  allowCreate?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [all, setAll] = useState<SubCategory[]>([]);
  const [query, setQuery] = useState(value?.name ?? "");
  const [focus, setFocus] = useState(false);
  const [creating, setCreating] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase
      .from("product_subcategories")
      .select("id,name,category,default_price_per_sqft,default_price_per_pc")
      .eq("active", true)
      .order("name")
      .then(({ data }) => setAll((data ?? []) as any));
  }, []);

  useEffect(() => {
    setQuery(value?.name ?? "");
  }, [value?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setFocus(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const scoped = category ? all.filter((s) => s.category === category) : all;
    if (!q) return scoped.slice(0, 10);
    return scoped.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 10);
  }, [all, query, category]);

  const exact = useMemo(
    () => matches.find((s) => s.name.toLowerCase() === query.trim().toLowerCase()),
    [matches, query],
  );

  const pick = (s: SubCategory) => {
    onChange(s);
    setQuery(s.name);
    setFocus(false);
  };

  const createNew = async () => {
    const name = query.trim();
    if (!name) return;
    if (!category) {
      toast.error("Pick a category first");
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from("product_subcategories")
        .insert({ name, category: category as any })
        .select("id,name,category,default_price_per_sqft,default_price_per_pc")
        .single();
      if (error) throw error;
      const created = data as any as SubCategory;
      setAll((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      pick(created);
      toast.success(`Created sub-category "${name}"`);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to create");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className={`relative ${className ?? ""}`} ref={boxRef}>
      <Input
        className="h-10"
        placeholder={placeholder}
        value={query}
        onFocus={() => setFocus(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          if (value) onChange(null);
          setFocus(true);
        }}
      />
      {focus && (matches.length > 0 || (allowCreate && query.trim() && !exact)) && (
        <div className="absolute z-30 mt-1 w-full bg-popover border border-border/60 rounded-lg shadow-lg max-h-64 overflow-auto">
          {matches.map((s) => (
            <button
              key={s.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(s)}
              className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex items-center justify-between gap-2"
            >
              <span className="font-medium">{s.name}</span>
              <span className="text-[10px] uppercase text-muted-foreground">{s.category}</span>
            </button>
          ))}
          {allowCreate && query.trim() && !exact && (
            <button
              type="button"
              disabled={creating}
              onMouseDown={(e) => e.preventDefault()}
              onClick={createNew}
              className="w-full text-left px-3 py-2 hover:bg-muted text-sm font-semibold text-primary border-t border-border/60 flex items-center gap-1"
            >
              <Plus className="h-4 w-4" /> Create "{query.trim()}"
              {!category && <span className="ml-auto text-[10px] text-destructive">pick category first</span>}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Picks a product inside a chosen sub-category (used by Purchase/Sales lines). */
export function ItemBySubCategoryPicker({
  subcategoryId,
  onPick,
  placeholder = "Type item / brand…",
  className,
}: {
  subcategoryId: string | null;
  onPick: (product: any) => void;
  placeholder?: string;
  className?: string;
}) {
  const [items, setItems] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [focus, setFocus] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery("");
    if (!subcategoryId) {
      setItems([]);
      return;
    }
    supabase
      .from("products")
      .select("id,name,prefix,default_price,default_cost,gst_rate,unit,alt_unit,alt_conversion,hsn,category")
      .eq("active", true)
      .eq("subcategory_id" as any, subcategoryId)
      .order("name")
      .then(({ data }) => setItems(data ?? []));
  }, [subcategoryId]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setFocus(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 10);
    return items.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 10);
  }, [items, query]);

  return (
    <div className={`relative ${className ?? ""}`} ref={boxRef}>
      <Input
        className="h-10"
        disabled={!subcategoryId}
        placeholder={subcategoryId ? placeholder : "Pick a sub-category first…"}
        value={query}
        onFocus={() => setFocus(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setFocus(true);
        }}
      />
      {focus && subcategoryId && filtered.length > 0 && (
        <div className="absolute z-30 mt-1 w-full bg-popover border border-border/60 rounded-lg shadow-lg max-h-64 overflow-auto">
          {filtered.map((p) => (
            <button
              key={p.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onPick(p);
                setQuery("");
                setFocus(false);
              }}
              className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex items-center justify-between"
            >
              <span className="font-medium">{p.name}</span>
              <span className="text-[11px] text-muted-foreground">₹{Number(p.default_price ?? 0).toFixed(2)}</span>
            </button>
          ))}
        </div>
      )}
      {focus && subcategoryId && filtered.length === 0 && (
        <div className="absolute z-30 mt-1 w-full bg-popover border border-border/60 rounded-lg shadow-lg p-3 text-xs text-muted-foreground">
          No items in this sub-category yet. Add one from Inventory → New product.
        </div>
      )}
    </div>
  );
}