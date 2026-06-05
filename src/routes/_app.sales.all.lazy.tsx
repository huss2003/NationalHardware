import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/erp/PageHeader";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { TableSkeleton } from "@/components/erp/Skeletons";
import { inr } from "@/lib/codes";
import { ArrowLeft, Search } from "lucide-react";

export const Route = createLazyFileRoute("/_app/sales/all")({ component: AllSales });

function AllSales() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 25;

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("sales")
        .select("id, invoice_no, invoice_date, grand_total, payment_mode, payment_status, customers(name)")
        .is("deleted_at", null)
        .order("invoice_date", { ascending: false })
        .limit(5000);
      setRows(data ?? []);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      (r.invoice_no ?? "").toLowerCase().includes(s) ||
      (r.customers?.name ?? "").toLowerCase().includes(s),
    );
  }, [rows, q]);

  const pageRows = filtered.slice(page * pageSize, page * pageSize + pageSize);
  const total = filtered.reduce((sum, r) => sum + Number(r.grand_total ?? 0), 0);

  return (
    <>
      <PageHeader
        title="All Sales Bills"
        subtitle={`${filtered.length} invoices • ${inr(total)} total`}
        actions={
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link to="/sales"><ArrowLeft className="h-4 w-4" /> Back to Overview</Link>
          </Button>
        }
      />
      <div className="px-8 pb-10 max-w-[1400px] mx-auto w-full space-y-4">
        <Card className="p-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(0); }}
              placeholder="Search invoice no or customer…"
              className="pl-8"
            />
          </div>
        </Card>
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Invoice</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="text-right pr-5">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={5} className="p-0">
                    <TableSkeleton rows={8} columns={5} showHeader={false} />
                  </TableCell>
                </TableRow>
              )}
              {!loading && pageRows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="pl-5 font-medium">
                    <Link to="/sales/$id" params={{ id: r.id }} className="text-primary hover:underline">
                      {r.invoice_no ?? r.id.slice(0, 8)}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {r.invoice_date ? new Date(r.invoice_date).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell>{r.customers?.name ?? "Walk-in"}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">{r.payment_mode ?? "—"}</TableCell>
                  <TableCell className="text-right pr-5 font-semibold tabular-nums">{inr(r.grand_total)}</TableCell>
                </TableRow>
              ))}
              {!loading && pageRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    No sales bills found.
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
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={(page + 1) * pageSize >= filtered.length} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}