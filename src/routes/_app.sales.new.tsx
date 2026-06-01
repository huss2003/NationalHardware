import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, Plus } from "lucide-react";
import { SaleBillForm, type ProductRow } from "@/components/erp/SaleBillForm";

export const Route = createFileRoute("/_app/sales/new")({ component: NewSale });

const MAX_TABS = 5;
const TABS_KEY = "sale_tabs";

type Customer = { id: string; name: string; state?: string | null; phone?: string | null };
type SubCat = { id: string; name: string; category: string };
type Godown = { id: string; name: string };
type Tab = { id: string };

function newId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  } catch {}
  return `t_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function NewSale() {
  // Shared reference data — fetched once for all tabs.
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [subcats, setSubcats] = useState<SubCat[]>([]);
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [knownPrefixes, setKnownPrefixes] = useState<string[]>([]);

  // Tabs — restored from sessionStorage so open bills survive refresh.
  const [tabs, setTabs] = useState<Tab[]>(() => {
    try {
      const raw = sessionStorage.getItem(TABS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { tabs?: Tab[] };
        if (Array.isArray(parsed.tabs) && parsed.tabs.length) {
          return parsed.tabs.slice(0, MAX_TABS);
        }
      }
    } catch {}
    return [{ id: newId() }];
  });
  const [activeId, setActiveId] = useState<string>(() => {
    try {
      const raw = sessionStorage.getItem(TABS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { tabs?: Tab[]; activeId?: string };
        if (parsed.activeId && parsed.tabs?.some((t) => t.id === parsed.activeId)) {
          return parsed.activeId;
        }
        if (parsed.tabs?.[0]?.id) return parsed.tabs[0].id;
      }
    } catch {}
    return "";
  });

  // Ensure activeId is always valid.
  useEffect(() => {
    if (!tabs.some((t) => t.id === activeId)) {
      setActiveId(tabs[0]?.id ?? "");
    }
  }, [tabs, activeId]);

  useEffect(() => {
    try {
      sessionStorage.setItem(TABS_KEY, JSON.stringify({ tabs, activeId }));
    } catch {}
  }, [tabs, activeId]);

  useEffect(() => {
    supabase.from("customers").select("*").order("name").then(({ data }) => setCustomers((data ?? []) as any));
    supabase.from("godowns").select("id, name").eq("active", true).order("name")
      .then(({ data }) => setGodowns((data ?? []) as any));
    supabase.from("products")
      .select("id,name,prefix,hsn,default_price,gst_rate,unit,alt_unit,alt_conversion,subcategory_id")
      .eq("active", true)
      .order("name")
      .then(({ data }) => {
        const rows = (data ?? []) as ProductRow[];
        setProducts(rows);
        setKnownPrefixes(Array.from(new Set(rows.map((p) => p.prefix).filter(Boolean))));
      });
    supabase.from("product_subcategories")
      .select("id,name,category")
      .eq("active", true)
      .order("name")
      .then(({ data }) => setSubcats((data ?? []) as any));
  }, []);

  const onCustomerCreated = (c: Customer) => {
    setCustomers((prev) => [...prev, c].sort((a, b) => a.name.localeCompare(b.name)));
  };

  const addTab = () => {
    setTabs((prev) => {
      if (prev.length >= MAX_TABS) return prev;
      const t = { id: newId() };
      setActiveId(t.id);
      return [...prev, t];
    });
  };

  const closeTab = (id: string) => {
    try { sessionStorage.removeItem(`sale_tab_${id}`); } catch {}
    setTabs((prev) => {
      if (prev.length <= 1) {
        // Always keep at least one bill — replace with a fresh blank one.
        const t = { id: newId() };
        setActiveId(t.id);
        return [t];
      }
      const next = prev.filter((t) => t.id !== id);
      if (id === activeId) setActiveId(next[next.length - 1].id);
      return next;
    });
  };

  // Saving one bill closes only that tab (and keeps a blank one if it was the last).
  const onSaved = (id: string) => {
    closeTab(id);
  };

  return (
    <div className="w-full">
      {/* Tab bar */}
      <div className="sticky top-0 z-30 flex items-stretch gap-1 bg-white border-b border-[#e8ecf1] px-2 overflow-x-auto">
        {tabs.map((t, i) => {
          const isActive = t.id === activeId;
          return (
            <div
              key={t.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveId(t.id)}
              className={`group flex items-center gap-2 px-4 py-2.5 cursor-pointer select-none border-b-2 whitespace-nowrap transition-colors ${
                isActive
                  ? "border-[#3b82f6] text-[#3b82f6] bg-[#3b82f6]/5 font-semibold"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span className="text-sm">Sale #{i + 1}</span>
              <button
                type="button"
                aria-label={`Close Sale #${i + 1}`}
                onClick={(e) => { e.stopPropagation(); closeTab(t.id); }}
                className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-red-500"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
        <button
          type="button"
          aria-label="Add new sale bill"
          onClick={addTab}
          disabled={tabs.length >= MAX_TABS}
          title={tabs.length >= MAX_TABS ? "Maximum 5 bills" : "Add a new sale bill"}
          className="flex items-center justify-center my-1 ml-1 h-8 w-8 rounded-full bg-[#3b82f6] text-white shrink-0 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* All bills rendered; only the active one is visible so each keeps its own state. */}
      {tabs.map((t) => (
        <div key={t.id} className={t.id === activeId ? "block" : "hidden"}>
          <SaleBillForm
            tabId={t.id}
            active={t.id === activeId}
            customers={customers}
            products={products}
            subcats={subcats}
            godowns={godowns}
            knownPrefixes={knownPrefixes}
            onCustomerCreated={onCustomerCreated}
            onSaved={onSaved}
          />
        </div>
      ))}
    </div>
  );
}
