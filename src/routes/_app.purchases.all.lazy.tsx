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

export const Route = createLazyFileRoute("/_app/purchases/all")({ component: AllPurchases });

function AllPurchases() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 25;
  const search = q.trim();

  const { data, isLoading: loading } = useQuery<{ rows: any[]; count: number; total: number }>({
    queryKey: ["purchases", "all", page, search],
    queryFn: async () => {
      let query = supabase
        .from("purchases")
        .select("id, bill_no, bill_date, grand_total, suppliers(name)", { count: "exact" })
        .is("deleted_at", null)
        .order("bill_date", { ascending: false })
        .range(page * pageSize, page * pageSize + pageSize - 1);
      if (search) query = query.or(`bill_no.ilike.%${search}%,suppliers.name.ilike.%${search}%`);
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
        title="All Purchase Bills"
        subtitle={`${count} bills • ${inr(total)} on this page`}
        actions={
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link to="/purchases"><ArrowLeft className="h-4 w-4" /> Back to Overview</Link>
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
              placeholder="Search bill no or supplier…"
              className="pl-8"
            />
          </div>
        </Card>
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Bill No</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-right pr-5">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={4} className="p-0">
                    <TableSkeleton rows={8} columns={4} showHeader={false} />
                  </TableCell>
                </TableRow>
              )}
              {!loading && pageRows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="pl-5 font-medium">
                    <Link to="/purchases/$id" params={{ id: r.id }} className="text-primary hover:underline">
                      {r.bill_no ?? r.id.slice(0, 8)}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {r.bill_date ? new Date(r.bill_date).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell>{r.suppliers?.name ?? "—"}</TableCell>
                  <TableCell className="text-right pr-5 font-semibold tabular-nums">{inr(r.grand_total)}</TableCell>
                </TableRow>
              ))}
              {!loading && pageRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                    No purchase bills found.
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