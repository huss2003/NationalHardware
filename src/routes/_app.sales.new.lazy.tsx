import { createLazyFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { X, Plus } from "lucide-react";
import { SaleBillForm, type ProductRow } from "@/components/erp/SaleBillForm";

export const Route = createLazyFileRoute("/_app/sales/new")({ component: NewSale });

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

async function fetchSalePageData() {
  const [custRes, prodRes, godownRes, subRes] = await Promise.all([
    supabase.from("customers").select("id, name, state, phone").order("name"),
    supabase.from("products")
      .select("id,name,prefix,hsn,default_price,gst_rate,unit,alt_unit,alt_conversion,subcategory_id,item_group,finish")
      .eq("active", true).order("name"),
    supabase.from("godowns").select("id, name").eq("active", true).order("name"),
    supabase.from("product_subcategories").select("id,name,category").eq("active", true).order("name"),
  ]);
  return {
    customers: ((custRes.data ?? []) as Customer[]),
    products: ((prodRes.data ?? []) as ProductRow[]),
    godowns: ((godownRes.data ?? []) as Godown[]),
    subcats: ((subRes.data ?? []) as SubCat[]),
  };
}

function NewSale() {
  const { data, isLoading } = useQuery({
    queryKey: ["sale-page-data"],
    queryFn: fetchSalePageData,
    staleTime: 5 * 60 * 1000,
  });

  const customers = data?.customers ?? [];
  const products = data?.products ?? [];
  const subcats = data?.subcats ?? [];
  const godowns = data?.godowns ?? [];
  const knownPrefixes = products.length
    ? Array.from(new Set(products.map((p) => p.prefix).filter(Boolean)))
    : [];

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

  const [extraCustomers, setExtraCustomers] = useState<Customer[]>([]);

  const onCustomerCreated = (c: Customer) => {
    setExtraCustomers((prev) => [...prev, c]);
  };

  const allCustomers = [...customers, ...extraCustomers].sort((a, b) => a.name.localeCompare(b.name));

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
        const t = { id: newId() };
        setActiveId(t.id);
        return [t];
      }
      const next = prev.filter((t) => t.id !== id);
      if (id === activeId) setActiveId(next[next.length - 1].id);
      return next;
    });
  };

  const onSaved = (id: string) => {
    closeTab(id);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">Loading sale data…</div>;
  }

  return (
    <div className="w-full">
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

      {tabs.map((t) => (
        <div key={t.id} className={t.id === activeId ? "block" : "hidden"}>
          <SaleBillForm
            tabId={t.id}
            active={t.id === activeId}
            customers={allCustomers}
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
