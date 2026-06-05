import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 25;
  const search = q.trim();

  const { data, isLoading: loading } = useQuery<{ rows: any[]; count: number; total: number }>({
    queryKey: ["sales", "all", page, search],
    queryFn: async () => {
      const safeSearch = search.replace(/[(),]/g, " ");
      let customerIds: string[] = [];
      if (safeSearch) {
        const { data: customers } = await supabase
          .from("customers")
          .select("id")
          .ilike("name", `%${safeSearch}%`)
          .limit(50);
        customerIds = (customers ?? []).map((c) => c.id);
      }
      let query = supabase
        .from("sales")
        .select("id, invoice_no, invoice_date, grand_total, payment_mode, payment_status, customers(name)", { count: "exact" })
        .is("deleted_at", null)
        .order("invoice_date", { ascending: false })
        .range(page * pageSize, page * pageSize + pageSize - 1);
      if (safeSearch) {
        query = customerIds.length
          ? query.or(`invoice_no.ilike.%${safeSearch}%,customer_id.in.(${customerIds.join(",")})`)
          : query.ilike("invoice_no", `%${safeSearch}%`);
      }
      const { data: rows, count } = await query;
      return {
        rows: rows ?? [],
        count: count ?? 0,
        total: (rows ?? []).reduce((sum, r) => sum + Number(r.grand_total ?? 0), 0),
      };
    },
  });
  const pageRows = data?.rows ?? [];
  const count = data?.count ?? 0;
  const total = data?.total ?? 0;

  return (
    <>
      <PageHeader
        title="All Sales Bills"
        subtitle={`${count} invoices • ${inr(total)} on this page`}
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
              Showing {count === 0 ? 0 : page * pageSize + 1}–
              {Math.min((page + 1) * pageSize, count)} of {count}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={(page + 1) * pageSize >= count} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}