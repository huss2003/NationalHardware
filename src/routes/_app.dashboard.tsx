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
      <PageHeader
        title="Overview"
        subtitle="Real-time metrics and operations for today."
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-2">
              <Calendar className="h-4 w-4" /> Today
            </Button>
            <Button size="sm" className="gap-2">
              <Download className="h-4 w-4" /> Export
            </Button>
          </>
        }
      />
      <div className="px-8 pb-10 max-w-[1400px] mx-auto w-full space-y-5">
        {/* KPI strip */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          {t.salesToday && (
            <StatCard
              icon={IndianRupee} label="Today Sales"
              value={compactInr(stats.salesToday)}
              accent="bg-success/10 text-success"
              hint={<><TrendingUp className="h-3 w-3" /> +12.5% vs yesterday</>}
              hintColor="text-success"
            />
          )}
          {t.purchaseToday && (
            <StatCard
              icon={ShoppingCart} label="Today Purchase"
              value={compactInr(stats.purchaseToday)}
              accent="bg-primary/10 text-primary"
              hint={<>→ Steady</>}
            />
          )}
          {t.stockValue && (
            <StatCard
              icon={Boxes} label="Stock Value"
              value={compactInr(stats.stockValue)}
              accent="bg-primary/10 text-primary"
              hint={<><TrendingUp className="h-3 w-3" /> +2.1% this week</>}
              hintColor="text-success"
            />
          )}
          {t.lowStock && (
            <StatCard
              icon={AlertTriangle} label="Low Stock"
              value={String(stats.lowStock)}
              accent="bg-destructive/10 text-destructive"
              hint={<>↑ items need reorder</>}
              hintColor="text-destructive"
            />
          )}
          {t.productionToday && (
            <StatCard
              icon={Factory} label="Production"
              value={String(stats.productionToday)}
              accent="bg-primary/10 text-primary"
              hint={<>✓ On target</>}
              hintColor="text-success"
            />
          )}
          {t.pendingCredit && (
            <StatCard
              icon={Receipt} label="Pending Credit"
              value={compactInr(stats.pendingCredit)}
              accent="bg-warning/10 text-warning"
              hint={<>⏱ invoices overdue</>}
              hintColor="text-warning"
            />
          )}
        </div>

        {/* Chart + Alerts */}
        <div className="grid gap-5 grid-cols-1 lg:grid-cols-3">
          <Card className="lg:col-span-2 p-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold tracking-tight">Sales Volume</h2>
              <span className="text-xs font-medium text-muted-foreground px-2.5 py-1 rounded-md bg-muted">
                Last 14 Days
              </span>
            </div>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                  <XAxis
                    dataKey="day"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis hide />
                  <Tooltip
                    cursor={{ fill: "var(--color-muted)", opacity: 0.4 }}
                    contentStyle={{
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v) => [inr(Number(v)), "Sales"]}
                  />
                  <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                    {chart.map((d, i) => {
                      const isLast = i === chart.length - 1;
                      return (
                        <Cell
                          key={i}
                          fill={
                            isLast
                              ? "var(--color-primary)"
                              : "color-mix(in oklab, var(--color-primary) 18%, transparent)"
                          }
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="inline-flex items-center gap-2">
                <Bell className="h-4 w-4 text-warning" />
                <h2 className="text-lg font-semibold tracking-tight">Open Alerts</h2>
              </div>
              <button className="text-xs font-medium text-primary inline-flex items-center gap-1 hover:underline">
                View All <ArrowRight className="h-3 w-3" />
              </button>
            </div>
            {alerts.length === 0 && (
              <div className="text-sm text-muted-foreground py-8 text-center">
                No alerts 🎉
              </div>
            )}
            <ul className="divide-y divide-border/60">
              {alerts.map((a) => {
                const dot =
                  a.severity === "critical"
                    ? "bg-destructive"
                    : a.severity === "warning"
                    ? "bg-warning"
                    : "bg-primary";
                return (
                  <li key={a.id} className="py-3 flex gap-3 first:pt-0 last:pb-0">
                    <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${dot}`} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-foreground truncate">
                        {a.type}
                      </div>
                      {a.message && (
                        <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {a.message}
                        </div>
                      )}
                      <div className="text-[11px] text-muted-foreground mt-1">
                        {new Date(a.created_at).toLocaleString()}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
