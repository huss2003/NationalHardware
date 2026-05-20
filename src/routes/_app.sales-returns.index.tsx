import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/erp/PageHeader";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { TableSkeleton } from "@/components/erp/Skeletons";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { inr } from "@/lib/codes";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-store";
import {
  Plus, Undo2, Receipt, Wallet, TrendingDown, Calendar,
} from "lucide-react";

export const Route = createFileRoute("/_app/sales-returns/")({ component: SalesReturns });

function SalesReturns() {
  const user = useAuth((s) => s.user);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const reload = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("sales_returns")
      .select("*, sales(invoice_no), customers(name)")
      .is("deleted_at", null)
      .order("return_date", { ascending: false })
      .limit(200);
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  const kpis = useMemo(() => {
    const total = rows.reduce((s, r) => s + Number(r.grand_total ?? 0), 0);
    const refunded = rows.reduce((s, r) => s + Number(r.refund_amount ?? 0), 0);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthCount = rows.filter((r) => new Date(r.return_date) >= monthStart).length;
    return { total, refunded, count: rows.length, monthCount };
  }, [rows]);

  return (
    <>
      <PageHeader
        title="Sales Returns"
        subtitle="Track items returned by customers and refunds issued."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" /> Record Return
              </Button>
            </DialogTrigger>
            <NewSalesReturnDialog
              onClose={() => setOpen(false)}
              onSaved={() => { setOpen(false); reload(); }}
              userId={user?.id}
            />
          </Dialog>
        }
      />
      <div className="px-8 pb-10 max-w-[1400px] mx-auto w-full space-y-5">
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <KpiCard icon={Undo2} iconBg="bg-warning/10 text-warning"
            label="Total Returns" value={String(kpis.count)}
            hint="All-time recorded" />
          <KpiCard icon={Calendar} iconBg="bg-primary/10 text-primary"
            label="This Month" value={String(kpis.monthCount)}
            hint="Returns in current month" />
          <KpiCard icon={Receipt} iconBg="bg-destructive/10 text-destructive"
            label="Return Value" value={inr(kpis.total)}
            hint={<><TrendingDown className="h-3 w-3" /> Across all returns</>}
            hintColor="text-destructive" />
          <KpiCard icon={Wallet} iconBg="bg-success/10 text-success"
            label="Refunded" value={inr(kpis.refunded)}
            hint="Settled to customers" />
        </div>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h2 className="text-lg font-semibold tracking-tight">Recent Returns</h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Return ID</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">Refund</TableHead>
                <TableHead className="text-right pr-5">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={7} className="p-0">
                  <TableSkeleton rows={5} columns={7} showHeader={false} />
                </TableCell></TableRow>
              )}
              {!loading && rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="pl-5 font-mono text-xs text-muted-foreground">
                    {r.return_no ?? r.id.slice(0, 8)}
                  </TableCell>
                  <TableCell className="font-medium">{r.sales?.invoice_no ?? "—"}</TableCell>
                  <TableCell>{r.customers?.name ?? "Walk-in"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(r.return_date).toLocaleDateString("en", {
                      month: "short", day: "numeric", year: "numeric",
                    })}
                  </TableCell>
                  <TableCell className="text-muted-foreground truncate max-w-[220px]">
                    {r.reason ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {inr(r.refund_amount)}
                  </TableCell>
                  <TableCell className="text-right pr-5 font-semibold tabular-nums">
                    {inr(r.grand_total)}
                  </TableCell>
                </TableRow>
              ))}
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-14 text-muted-foreground">
                    <Undo2 className="h-7 w-7 mx-auto mb-2 opacity-50" />
                    No sales returns yet.
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

function NewSalesReturnDialog({
  onClose, onSaved, userId,
}: { onClose: () => void; onSaved: () => void; userId?: string }) {
  const [sales, setSales] = useState<any[]>([]);
  const [saleId, setSaleId] = useState("");
  const [reason, setReason] = useState("");
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [refundMode, setRefundMode] = useState("cash");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("sales")
        .select("id, invoice_no, grand_total, customer_id, customers(name)")
        .is("deleted_at", null)
        .order("invoice_date", { ascending: false })
        .limit(100);
      setSales(data ?? []);
    })();
  }, []);

  const selectedSale = sales.find((s) => s.id === saleId);

  const save = async () => {
    if (!saleId) { toast.error("Pick the original sale"); return; }
    if (refundAmount < 0) { toast.error("Refund must be ≥ 0"); return; }
    setBusy(true);
    const { error } = await supabase.from("sales_returns").insert({
      sale_id: saleId,
      customer_id: selectedSale?.customer_id ?? null,
      return_no: `SR-${Date.now().toString().slice(-6)}`,
      reason,
      grand_total: Number(selectedSale?.grand_total ?? refundAmount),
      refund_amount: refundAmount,
      refund_mode: refundMode,
      status: "completed",
      created_by: userId,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Sales return recorded");
    onSaved();
  };

  return (
    <DialogContent className="sm:max-w-[480px]">
      <DialogHeader>
        <DialogTitle>Record Sales Return</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
            <Receipt className="h-3.5 w-3.5" /> Original Sale
          </label>
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={saleId}
            onChange={(e) => {
              setSaleId(e.target.value);
              const s = sales.find((x) => x.id === e.target.value);
              setRefundAmount(Number(s?.grand_total ?? 0));
            }}
          >
            <option value="">Select an invoice…</option>
            {sales.map((s) => (
              <option key={s.id} value={s.id}>
                {s.invoice_no} · {s.customers?.name ?? "Walk-in"} · {inr(s.grand_total)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Reason
          </label>
          <textarea
            className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Damaged on delivery, wrong item, etc."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Refund amount
            </label>
            <Input
              className="h-10 tabular-nums"
              type="number"
              value={refundAmount}
              onChange={(e) => setRefundAmount(Math.max(0, Number(e.target.value)))}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Refund via
            </label>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={refundMode}
              onChange={(e) => setRefundMode(e.target.value)}
            >
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="card">Card</option>
              <option value="credit_note">Credit note</option>
            </select>
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Record Return"}
        </Button>
      </DialogFooter>
    </DialogContent>
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