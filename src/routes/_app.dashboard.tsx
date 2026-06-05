import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/erp/PageHeader";
import { inr } from "@/lib/codes";
import {
  Boxes, IndianRupee, ShoppingCart, AlertTriangle, Receipt,
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
  const { data } = useQuery({
    queryKey: ["dashboard", "overview"],
    queryFn: async () => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const since = today.toISOString();
      const since14 = new Date(); since14.setDate(since14.getDate() - 13); since14.setHours(0, 0, 0, 0);

      // Fire every read in parallel — one network wave instead of four.
      const [sales, purchases, items, alertsRes, prod, credit, chartRes] = await Promise.all([
        supabase.from("sales").select("grand_total, paid_amount").gte("invoice_date", since).is("deleted_at", null),
        supabase.from("purchases").select("grand_total").gte("created_at", since).is("deleted_at", null),
        supabase.from("item_instances").select("cost_price, status, product_id").eq("status", "available"),
        supabase.from("alerts").select("*").is("read_at", null).order("created_at", { ascending: false }).limit(5),
        supabase.from("products").select("id, reorder_level"),
        supabase.from("sales").select("grand_total, paid_amount").eq("payment_mode", "credit").is("deleted_at", null),
        supabase.from("sales").select("grand_total, invoice_date").gte("invoice_date", since14.toISOString()).is("deleted_at", null),
      ]);

      const salesToday = (sales.data ?? []).reduce((a, r: any) => a + Number(r.grand_total), 0);
      const purchaseToday = (purchases.data ?? []).reduce((a, r: any) => a + Number(r.grand_total), 0);
      const available = items.data ?? [];
      const stockValue = available.reduce((a, i: any) => a + Number(i.cost_price), 0);

      const counts: Record<string, number> = {};
      available.forEach((i: any) => { counts[i.product_id] = (counts[i.product_id] ?? 0) + 1; });
      const lowStock = (prod.data ?? []).filter((p: any) => (counts[p.id] ?? 0) <= p.reorder_level).length;

      const pendingCredit = (credit.data ?? []).reduce((a, r: any) => a + (Number(r.grand_total) - Number(r.paid_amount)), 0);

      const buckets: Record<string, number> = {};
      for (let i = 0; i < 14; i++) {
        const d = new Date(since14); d.setDate(d.getDate() + i);
        buckets[d.toISOString().slice(0, 10)] = 0;
      }
      (chartRes.data ?? []).forEach((s: any) => {
        const k = String(s.invoice_date).slice(0, 10);
        if (k in buckets) buckets[k] += Number(s.grand_total);
      });
      const chart = Object.entries(buckets).map(([k, v]) => ({ day: k.slice(5), total: v }));

      return {
        stats: { salesToday, purchaseToday, stockValue, lowStock, pendingCredit },
        alerts: alertsRes.data ?? [],
        chart,
      };
    },
  });

  const stats = data?.stats ?? { salesToday: 0, purchaseToday: 0, stockValue: 0, lowStock: 0, pendingCredit: 0 };
  const chart = data?.chart ?? [];
  const alerts = data?.alerts ?? [];

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
