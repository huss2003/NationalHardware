import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/erp/PageHeader";
import { inr } from "@/lib/codes";
import {
  Boxes, Factory, IndianRupee, ShoppingCart, AlertTriangle, Receipt,
  TrendingUp, ArrowRight, Calendar, Download, Bell,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { useUiConfig } from "@/lib/ui-config";

export const Route = createFileRoute("/_app/dashboard")({ component: Dashboard });

function compactInr(n: number) {
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(1)}Cr`;
  if (n >= 1_00_000) return `₹${Math.round(n / 1000)}K`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${Math.round(n)}`;
}

function StatCard({
  icon: Icon, label, value, hint, accent, hintColor,
}: {
  icon: any; label: string; value: string; hint: React.ReactNode;
  accent: string; hintColor?: string;
}) {
  return (
    <Card className="p-5 min-w-0">
      <div className="flex items-start justify-between mb-3">
        <div className="text-[11px] font-semibold tracking-[0.08em] uppercase text-muted-foreground leading-tight">
          {label}
        </div>
        <div className={`h-8 w-8 rounded-lg grid place-items-center shrink-0 ${accent}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="text-[28px] leading-none font-semibold tracking-tight tabular-nums">
        {value}
      </div>
      <div className={`text-xs mt-3 inline-flex items-center gap-1 ${hintColor ?? "text-muted-foreground"}`}>
        {hint}
      </div>
    </Card>
  );
}

function Dashboard() {
  const cfg = useUiConfig();
  const t = cfg.dashboard.tiles;
  const [stats, setStats] = useState({
    salesToday: 0, purchaseToday: 0, stockValue: 0, lowStock: 0, productionToday: 0, pendingCredit: 0,
  });
  const [chart, setChart] = useState<{ day: string; total: number }[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const today = new Date(); today.setHours(0,0,0,0);
      const since = today.toISOString();
      const [sales, purchases, items, prods, alertsRes] = await Promise.all([
        supabase.from("sales").select("grand_total, paid_amount, invoice_date").gte("invoice_date", since).is("deleted_at", null),
        supabase.from("purchases").select("grand_total, created_at").gte("created_at", since).is("deleted_at", null),
        supabase.from("item_instances").select("cost_price, status, product_id"),
        supabase.from("production_orders").select("id, created_at").gte("created_at", since),
        supabase.from("alerts").select("*").is("read_at", null).order("created_at", { ascending: false }).limit(5),
      ]);
      const salesToday = (sales.data ?? []).reduce((a: number, r: any) => a + Number(r.grand_total), 0);
      const purchaseToday = (purchases.data ?? []).reduce((a: number, r: any) => a + Number(r.grand_total), 0);
      const available = (items.data ?? []).filter((i: any) => i.status === "available");
      const stockValue = available.reduce((a: number, i: any) => a + Number(i.cost_price), 0);

      // Low stock: products under reorder_level
      const { data: prodList } = await supabase.from("products").select("id, name, reorder_level");
      const counts: Record<string, number> = {};
      available.forEach((i: any) => { counts[i.product_id] = (counts[i.product_id] ?? 0) + 1; });
      const lowStock = (prodList ?? []).filter((p: any) => (counts[p.id] ?? 0) <= p.reorder_level).length;

      // Pending credit
      const { data: credit } = await supabase
        .from("sales")
        .select("grand_total, paid_amount")
        .eq("payment_mode", "credit")
        .is("deleted_at", null);
      const pendingCredit = (credit ?? []).reduce((a: number, r: any) => a + (Number(r.grand_total) - Number(r.paid_amount)), 0);

      setStats({
        salesToday, purchaseToday, stockValue, lowStock,
        productionToday: (prods.data ?? []).length, pendingCredit,
      });
      setAlerts(alertsRes.data ?? []);

      // 14-day sales chart
      const since14 = new Date(); since14.setDate(since14.getDate() - 13); since14.setHours(0,0,0,0);
      const { data: chartData } = await supabase.from("sales")
        .select("grand_total, invoice_date")
        .gte("invoice_date", since14.toISOString())
        .is("deleted_at", null);
      const buckets: Record<string, number> = {};
      for (let i = 0; i < 14; i++) {
        const d = new Date(since14); d.setDate(d.getDate() + i);
        const k = d.toISOString().slice(0,10);
        buckets[k] = 0;
      }
      (chartData ?? []).forEach((s: any) => {
        const k = String(s.invoice_date).slice(0, 10);
        if (k in buckets) buckets[k] += Number(s.grand_total);
      });
      setChart(Object.entries(buckets).map(([k, v]) => ({ day: k.slice(5), total: v })));
    })();
  }, []);

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Live shop snapshot" />
      <div className="px-8 pb-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {t.salesToday      && <StatCard icon={IndianRupee}    label="Today Sales"          value={inr(stats.salesToday)}    color="bg-emerald-600" />}
          {t.purchaseToday   && <StatCard icon={ShoppingCart}   label="Today Purchase"       value={inr(stats.purchaseToday)} color="bg-blue-600" />}
          {t.stockValue      && <StatCard icon={Boxes}          label="Stock Value"          value={inr(stats.stockValue)}    color="bg-indigo-600" />}
          {t.lowStock        && <StatCard icon={AlertTriangle}  label="Low Stock Products"   value={stats.lowStock}           color="bg-amber-500" />}
          {t.productionToday && <StatCard icon={Factory}        label="Production Today"     value={stats.productionToday}    color="bg-fuchsia-600" />}
          {t.pendingCredit   && <StatCard icon={Receipt}        label="Pending Credit"       value={inr(stats.pendingCredit)} color="bg-rose-600" />}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Card className="p-6 lg:col-span-2">
            <div className="font-bold text-lg mb-4">Sales — last 14 days</div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart}>
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip formatter={(v) => inr(Number(v))} />
                  <Bar dataKey="total" fill="oklch(0.58 0.18 255)" radius={[8,8,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card className="p-6">
            <div className="font-bold text-lg mb-4">Open Alerts</div>
            {alerts.length === 0 && <div className="text-muted-foreground">No alerts 🎉</div>}
            <ul className="space-y-3">
              {alerts.map((a) => (
                <li key={a.id} className={`p-3 rounded-xl border-l-4 ${a.severity === "critical" ? "border-destructive bg-destructive/10" : a.severity === "warning" ? "border-amber-500 bg-amber-50" : "border-primary bg-primary/5"}`}>
                  <div className="font-semibold">{a.type}</div>
                  <div className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
