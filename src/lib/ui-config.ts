import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type FieldCfg = { visible: boolean; required: boolean };

export type UiConfig = {
  nav: Record<string, boolean>;
  dashboard: { tiles: Record<string, boolean> };
  lists: {
    purchases: { columns: Record<string, boolean> };
    sales: { columns: Record<string, boolean> };
    production: { columns: Record<string, boolean> };
  };
  forms: {
    new_purchase: { fields: Record<string, FieldCfg> };
    new_sale: { fields: Record<string, FieldCfg> };
    new_production: { fields: Record<string, FieldCfg> };
  };
};

export const DEFAULT_UI_CONFIG: UiConfig = {
  nav: {
    dashboard: true, inventory: true, scan: true, purchases: true, sales: true,
    production: true, bom: true, reports: true, employees: true, alerts: true,
    settings: true, dev: true,
    purchase_returns: true, sales_returns: true, godowns: true, door: true,
  },
  dashboard: {
    tiles: {
      salesToday: true, purchaseToday: true, stockValue: true,
      lowStock: true, productionToday: true, pendingCredit: true,
    },
  },
  lists: {
    purchases: { columns: { date: true, bill_no: true, supplier: true, total: true } },
    sales: { columns: { invoice: true, date: true, customer: true, mode: true, total: true } },
    production: { columns: { date: true, product: true, qty: true, status: true } },
  },
  forms: {
    new_purchase: {
      fields: {
        supplier: { visible: true, required: false },
        bill_no: { visible: true, required: false },
        bill_date: { visible: true, required: true },
        bill_image: { visible: true, required: false },
        notes: { visible: true, required: false },
        gst_rate: { visible: true, required: false },
      },
    },
    new_sale: {
      fields: {
        customer: { visible: true, required: false },
        payment_mode: { visible: true, required: true },
        discount: { visible: true, required: false },
        gst_rate: { visible: true, required: false },
      },
    },
    new_production: {
      fields: {
        bom: { visible: true, required: true },
        qty: { visible: true, required: true },
        assigned: { visible: true, required: false },
      },
    },
  },
};

/** Deep-merge user overrides over defaults so missing keys keep working. */
export function mergeUiConfig(partial: any): UiConfig {
  const out: any = JSON.parse(JSON.stringify(DEFAULT_UI_CONFIG));
  if (!partial || typeof partial !== "object") return out;
  const merge = (dst: any, src: any) => {
    for (const k of Object.keys(src ?? {})) {
      const v = src[k];
      if (v && typeof v === "object" && !Array.isArray(v) && dst[k] && typeof dst[k] === "object") {
        merge(dst[k], v);
      } else {
        dst[k] = v;
      }
    }
  };
  merge(out, partial);
  return out;
}

type Listener = (cfg: UiConfig) => void;
let cached: UiConfig | null = null;
let inflight: Promise<UiConfig> | null = null;
const listeners = new Set<Listener>();

export async function loadUiConfig(force = false): Promise<UiConfig> {
  if (cached && !force) return cached;
  if (inflight && !force) return inflight;
  inflight = (async () => {
    const { data } = await supabase
      .from("app_settings")
      .select("ui_config")
      .eq("id", true)
      .maybeSingle();
    const cfg = mergeUiConfig((data as any)?.ui_config);
    cached = cfg;
    listeners.forEach((l) => l(cfg));
    return cfg;
  })();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

export async function saveUiConfig(cfg: UiConfig): Promise<void> {
  const { error } = await supabase
    .from("app_settings")
    .update({ ui_config: cfg as any })
    .eq("id", true);
  if (error) throw error;
  cached = cfg;
  listeners.forEach((l) => l(cfg));
}

/** React hook — returns current config (defaults until loaded). */
export function useUiConfig(): UiConfig {
  const [cfg, setCfg] = useState<UiConfig>(cached ?? DEFAULT_UI_CONFIG);
  useEffect(() => {
    let alive = true;
    if (!cached) {
      loadUiConfig().then((c) => { if (alive) setCfg(c); });
    }
    const listener: Listener = (c) => setCfg(c);
    listeners.add(listener);
    return () => { alive = false; listeners.delete(listener); };
  }, []);
  return cfg;
}