import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/erp/PageHeader";
import { inr, fmtDate } from "@/lib/codes";
import {
  Plus, TrendingUp, Receipt, ShoppingBag, AlertCircle, MoreVertical, ArrowRight, Minus, Wallet,
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableSkeleton } from "@/components/erp/Skeletons";
import { useAuth } from "@/lib/auth-store";

const SalesTrendChart = lazy(() =>
  import("@/components/erp/SalesTrendChart").then((m) => ({ default: m.SalesTrendChart })),
);

export const Route = createLazyFileRoute("/_app/sales/")({ component: Sales });

type Range = "7D" | "30D" | "1Y";

function Sales() {
  const isAdmin = useAuth((s) => s.user)?.role === "admin";
  const [range, setRange] = useState<Range>("30D");
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [customerCategory, setCustomerCategory] = useState("all");
  const [dateRange, setDateRange] = useState("");

  const { data: rows = [], isLoading: loading } = useQuery<any[]>({
    queryKey: ["sales", "overview"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sales")
        .select("id, invoice_no, invoice_date, grand_total, paid_amount, customers(name)")
        .is("deleted_at", null)
        .order("invoice_date", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  // KPIs
  const kpis = useMemo(() => {
    const total = rows.reduce((s, r) => s + Number(r.grand_total ?? 0), 0);
    const count = rows.length;
    const avg = count ? total / count : 0;
    const pending = rows
      .reduce((s, r) => s + Math.max(0, Number(r.grand_total ?? 0) - Number(r.paid_amount ?? 0)), 0);
    const overdueCount = rows.filter(
      (r) => Number(r.paid_amount ?? 0) < Number(r.grand_total ?? 0),
    ).length;
    return { total, count, avg, pending, overdueCount };
  }, [rows]);

  // Trend buckets
  const chartData = useMemo(() => {
    const days = range === "7D" ? 7 : range === "30D" ? 14 : 12;
    const isMonth = range === "1Y";
    const buckets: { label: string; value: number }[] = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      if (isMonth) d.setMonth(d.getMonth() - i);
      else d.setDate(d.getDate() - i * (range === "30D" ? 2 : 1));
      buckets.push({
        label: isMonth
          ? d.toLocaleString("en", { month: "short" })
          : `${d.getDate()}`,
        value: 0,
      });
    }
    rows.forEach((r) => {
      const d = new Date(r.invoice_date);
      const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
      let idx = -1;
      if (isMonth) {
        const diffMonths = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
        idx = days - 1 - diffMonths;
      } else {
        const step = range === "30D" ? 2 : 1;
        idx = days - 1 - Math.floor(diffDays / step);
      }
      if (idx >= 0 && idx < days) buckets[idx].value += Number(r.grand_total ?? 0);
    });
    return buckets;
  }, [rows, range]);

  const recent = rows.slice(0, 5);

  const reset = () => {
    setPaymentStatus("all");
    setCustomerCategory("all");
    setDateRange("");
  };

  return (
    <>
      <PageHeader
        title="Sales Overview"
        subtitle="Manage orders, track revenue, and monitor transactions."
        actions={
          <>
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link to="/sales/receipts"><Wallet className="h-4 w-4" /> Receipts</Link>
            </Button>
            <Button asChild>
              <Link to="/sales/new">
                <Plus className="h-4 w-4" />
                New Sale
              </Link>
            </Button>
          </>
        }
      />
      <div className="px-8 pb-10 max-w-[1400px] mx-auto w-full space-y-5">
        {/* KPI cards */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {isAdmin && (
            <KpiCard
              label="Total Revenue"
              value={inr(kpis.total)}
              icon={<TrendingUp className="h-4 w-4 text-success" />}
              iconBg="bg-success/10"
              trend={
                <span className="text-success inline-flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" /> +12.5% from last month
                </span>
              }
            />
          )}
          {isAdmin && (
            <KpiCard
              label="Avg. Order Value"
              value={inr(kpis.avg)}
              icon={<Receipt className="h-4 w-4 text-primary" />}
              iconBg="bg-primary/10"
              trend={
                <span className="text-muted-foreground inline-flex items-center gap-1">
                  <Minus className="h-3 w-3" /> Stable
                </span>
              }
            />
          )}
          <KpiCard
            label="Total Sales Count"
            value={String(kpis.count)}
            icon={<ShoppingBag className="h-4 w-4 text-primary" />}
            iconBg="bg-primary/10"
            trend={
              <span className="text-success inline-flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> +8.2% from last month
              </span>
            }
          />
          {isAdmin && (
            <KpiCard
              label="Pending Payments"
              value={inr(kpis.pending)}
              icon={<AlertCircle className="h-4 w-4 text-warning" />}
              iconBg="bg-warning/10"
              trend={
                <span className="text-destructive inline-flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {kpis.overdueCount} invoices overdue
                </span>
              }
            />
          )}
        </div>

        {/* Trends + Filters */}
        <div className="grid gap-5 grid-cols-1 lg:grid-cols-3">
          {isAdmin && (
          <Card className="lg:col-span-2 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Sales Trends</h2>
              <div className="inline-flex rounded-lg bg-muted p-1">
                {(["7D", "30D", "1Y"] as Range[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRange(r)}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                      range === r
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-[300px]">
              <Suspense fallback={<div className="h-full rounded-md bg-muted animate-pulse" />}>
                <SalesTrendChart data={chartData} />
              </Suspense>
            </div>
          </Card>
          )}

          <Card className={isAdmin ? "p-5" : "lg:col-span-3 p-5"}>
            <h2 className="text-lg font-semibold mb-4">Filter Transactions</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Date Range
                </label>
                <Input
                  type="date"
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Payment Status
                </label>
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="all">All Statuses</option>
                  <option value="paid">Paid</option>
                  <option value="pending">Pending</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Customer Category
                </label>
                <select
                  value={customerCategory}
                  onChange={(e) => setCustomerCategory(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="all">All Categories</option>
                  <option value="retail">Retail</option>
                  <option value="wholesale">Wholesale</option>
                  <option value="b2b">B2B</option>
                </select>
              </div>
              <div className="pt-3 border-t border-border/60 flex gap-2">
                <Button variant="outline" className="flex-1" onClick={reset}>
                  Reset
                </Button>
                <Button className="flex-1 bg-foreground text-background hover:bg-foreground/90">
                  Apply Filters
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Recent transactions */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h2 className="text-lg font-semibold">Recent Transactions</h2>
            <Link
              to="/sales/all"
              className="text-sm font-medium text-primary inline-flex items-center gap-1 hover:underline"
            >
              View All <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Order ID</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Customer Name</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right pr-5">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={6} className="p-0">
                    <TableSkeleton rows={5} columns={6} showHeader={false} />
                  </TableCell>
                </TableRow>
              )}
              {!loading && recent.map((r) => {
                const status = Number(r.paid_amount ?? 0) >= Number(r.grand_total ?? 0) ? "paid" : "pending";
                return (
                  <TableRow key={r.id}>
                    <TableCell className="pl-5 font-medium text-foreground">
                      <Link to="/sales/$id" params={{ id: r.id }} className="hover:text-primary">
                        {r.invoice_no}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {fmtDate(r.invoice_date)}
                    </TableCell>
                    <TableCell>{r.customers?.name ?? "Walk-in"}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {inr(r.grand_total)}
                    </TableCell>
                    <TableCell>
                      <StatusPill status={status} />
                    </TableCell>
                    <TableCell className="text-right pr-5">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!loading && recent.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    No sales yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </>
  );
}

function KpiCard({
  label, value, icon, iconBg, trend,
}: {
  label: string; value: string; icon: React.ReactNode; iconBg: string; trend: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="text-sm font-medium text-muted-foreground">{label}</div>
        <div className={`h-8 w-8 rounded-lg grid place-items-center ${iconBg}`}>{icon}</div>
      </div>
      <div className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">{value}</div>
      <div className="text-xs mt-2">{trend}</div>
    </Card>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: "bg-success/15 text-success",
    pending: "bg-warning/15 text-warning",
    overdue: "bg-destructive/15 text-destructive",
  };
  const cls = map[status] ?? "bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold capitalize ${cls}`}>
      {status}
    </span>
  );
}
