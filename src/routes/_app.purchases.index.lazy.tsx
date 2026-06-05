import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/erp/PageHeader";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { TableSkeleton } from "@/components/erp/Skeletons";
import { inr } from "@/lib/codes";
import {
  Plus, ClipboardList, Truck, Wallet, AlertTriangle,
  TrendingUp, SlidersHorizontal, Download, BarChart3, ChevronDown,
} from "lucide-react";

export const Route = createLazyFileRoute("/_app/purchases/")({ component: Purchases });

type Row = any;

function compactInr(n: number) {
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(1)}Cr`;
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${Math.round(n)}`;
}

function Purchases() {
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(0);
  const pageSize = 5;

  const { data: rows = [], isLoading: loading } = useQuery<Row[]>({
    queryKey: ["purchases", "overview"],
    queryFn: async () => {
      const { data } = await supabase
        .from("purchases")
        .select("id, bill_no, bill_date, grand_total, suppliers(name)")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    if (status === "all") return rows;
    return rows.filter((r) => (r.status ?? "received").toLowerCase() === status);
  }, [rows, status]);

  const pageRows = filtered.slice(page * pageSize, page * pageSize + pageSize);

  // KPIs
  const kpis = useMemo(() => {
    const active = rows.length;
    const pending = rows.filter((r) => ["sent", "pending"].includes((r.status ?? "").toLowerCase())).length;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const spend = rows
      .filter((r) => r.bill_date && r.bill_date >= monthStart.slice(0, 10))
      .reduce((s, r) => s + Number(r.grand_total ?? 0), 0);
    const late = rows.filter((r) => (r.status ?? "").toLowerCase() === "late").length;
    return { active, pending, spend, late };
  }, [rows]);

  // Top suppliers (YTD)
  const topSuppliers = useMemo(() => {
    const map = new Map<string, { name: string; total: number; count: number }>();
    rows.forEach((r) => {
      const name = r.suppliers?.name ?? "Unknown";
      const prev = map.get(name) ?? { name, total: 0, count: 0 };
      prev.total += Number(r.grand_total ?? 0);
      prev.count += 1;
      map.set(name, prev);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 4);
  }, [rows]);

  const initials = (name: string) =>
    name.split(/\s+/).slice(0, 2).map((s) => s[0]).join("").toUpperCase();

  return (
    <>
      <PageHeader
        title="Purchases"
        subtitle="Manage supplier orders, deliveries, and spending."
        actions={
          <>
            <Button asChild variant="outline" className="gap-2">
              <Link to="/purchases/all">
                <ClipboardList className="h-4 w-4" /> View All Bills
              </Link>
            </Button>
            <Button asChild>
              <Link to="/purchases/new">
                <Plus className="h-4 w-4" /> Create Purchase Order
              </Link>
            </Button>
          </>
        }
      />
      <div className="px-8 pb-10 max-w-[1400px] mx-auto w-full space-y-5">
        {/* KPI strip */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <KpiCard
            icon={ClipboardList} iconBg="bg-primary/10 text-primary"
            label="Total Bills" value={String(kpis.active)}
            hint={<><TrendingUp className="h-3 w-3" /> recorded purchase bills</>}
            hintColor="text-success"
          />
          <KpiCard
            icon={Truck} iconBg="bg-warning/10 text-warning"
            label="Pending Deliveries" value={String(kpis.pending)}
            hint={<>12 arriving today</>}
          />
          <KpiCard
            icon={Wallet} iconBg="bg-primary/10 text-primary"
            label="Total Spend (MTD)" value={compactInr(kpis.spend)}
            hint={<><TrendingUp className="h-3 w-3" /> +4.5% vs budget</>}
            hintColor="text-destructive"
          />
          <KpiCard
            icon={AlertTriangle} iconBg="bg-destructive/10 text-destructive"
            label="Late Shipments" value={String(kpis.late)}
            hint={<>Requires attention</>}
            hintColor="text-destructive"
          />
        </div>

        {/* Table + Top suppliers */}
        <div className="grid gap-5 grid-cols-1 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            {/* Filter row */}
            <Card className="p-3 flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" className="gap-2">
                <SlidersHorizontal className="h-3.5 w-3.5" /> Filter
              </Button>
              <div className="relative">
                <select
                  value={status}
                  onChange={(e) => { setStatus(e.target.value); setPage(0); }}
                  className="appearance-none h-9 pl-3 pr-8 rounded-md border border-input bg-background text-sm font-medium"
                >
                  <option value="all">Status: All</option>
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="received">Received</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              </div>
              <div className="ml-auto">
                <Button variant="ghost" size="sm" className="gap-2 text-primary">
                  <Download className="h-3.5 w-3.5" /> Export
                </Button>
              </div>
            </Card>

            <Card className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5">PO ID</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="pr-5">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && (
                    <TableRow>
                      <TableCell colSpan={5} className="p-0">
                        <TableSkeleton rows={5} columns={5} showHeader={false} />
                      </TableCell>
                    </TableRow>
                  )}
                  {!loading && pageRows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="pl-5">
                        <Link
                          to="/purchases/$id" params={{ id: r.id }}
                          className="font-medium text-primary hover:underline"
                        >
                          {r.bill_no ?? `PO-${String(r.id).slice(0, 8)}`}
                        </Link>
                      </TableCell>
                      <TableCell className="text-foreground">
                        {r.suppliers?.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.bill_date
                          ? new Date(r.bill_date).toLocaleDateString("en", {
                              month: "short", day: "numeric", year: "numeric",
                            })
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {inr(r.grand_total)}
                      </TableCell>
                      <TableCell className="pr-5">
                        <StatusPill status={(r.status ?? "received").toLowerCase()} />
                      </TableCell>
                    </TableRow>
                  ))}
                  {!loading && pageRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                        No purchase orders.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between px-5 py-3 border-t border-border/60 text-sm">
                <span className="text-muted-foreground">
                  Showing {filtered.length === 0 ? 0 : page * pageSize + 1}–
                  {Math.min((page + 1) * pageSize, filtered.length)} of {filtered.length}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline" size="sm"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    disabled={(page + 1) * pageSize >= filtered.length}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          {/* Top suppliers */}
          <Card className="p-5 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold tracking-tight">Top Suppliers</h2>
              <button className="text-xs font-medium text-primary hover:underline">
                View All
              </button>
            </div>
            <ul className="space-y-4 flex-1">
              {topSuppliers.length === 0 && (
                <li className="text-sm text-muted-foreground text-center py-8">
                  No supplier activity yet.
                </li>
              )}
              {topSuppliers.map((s) => (
                <li key={s.name} className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-muted text-foreground/80 grid place-items-center text-xs font-semibold tracking-wide">
                    {initials(s.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-foreground truncate">{s.name}</div>
                    <div className="text-xs text-muted-foreground">{s.count} Active POs</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold tabular-nums">{compactInr(s.total)}</div>
                    <div className="text-[11px] text-muted-foreground">YTD</div>
                  </div>
                </li>
              ))}
            </ul>
            <Button variant="outline" className="mt-5 gap-2">
              <BarChart3 className="h-4 w-4" /> Generate Supplier Report
            </Button>
          </Card>
        </div>
      </div>
    </>
  );
}

function KpiCard({
  icon: Icon, iconBg, label, value, hint, hintColor,
}: {
  icon: any; iconBg: string; label: string; value: string;
  hint: React.ReactNode; hintColor?: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="text-sm font-medium text-muted-foreground">{label}</div>
        <div className={`h-8 w-8 rounded-lg grid place-items-center ${iconBg}`}>
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

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    sent: "bg-primary/10 text-primary",
    draft: "bg-muted text-muted-foreground",
    received: "bg-success/15 text-success",
    cancelled: "bg-destructive/15 text-destructive",
    late: "bg-warning/15 text-warning",
    pending: "bg-warning/15 text-warning",
  };
  const cls = map[status] ?? "bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold capitalize ${cls}`}>
      {status}
    </span>
  );
}
