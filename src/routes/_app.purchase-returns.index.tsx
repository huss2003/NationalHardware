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
  Plus, RotateCcw, ClipboardList, TrendingDown, Calendar, Building2,
} from "lucide-react";

export const Route = createFileRoute("/_app/purchase-returns/")({ component: PurchaseReturns });

function PurchaseReturns() {
  const user = useAuth((s) => s.user);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const reload = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("purchase_returns")
      .select("*, purchases(bill_no), suppliers(name)")
      .is("deleted_at", null)
      .order("return_date", { ascending: false })
      .limit(200);
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  const kpis = useMemo(() => {
    const total = rows.reduce((s, r) => s + Number(r.grand_total ?? 0), 0);
    const pending = rows.filter((r) => (r.status ?? "").toLowerCase() === "sent").length;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthCount = rows.filter((r) => new Date(r.return_date) >= monthStart).length;
    return { total, pending, count: rows.length, monthCount };
  }, [rows]);

  return (
    <>
      <PageHeader
        title="Purchase Returns"
        subtitle="Track items returned to suppliers and credit notes received."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" /> Record Return
              </Button>
            </DialogTrigger>
            <NewPurchaseReturnDialog
              onClose={() => setOpen(false)}
              onSaved={() => { setOpen(false); reload(); }}
              userId={user?.id}
            />
          </Dialog>
        }
      />
      <div className="px-8 pb-10 max-w-[1400px] mx-auto w-full space-y-5">
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <KpiCard icon={RotateCcw} iconBg="bg-warning/10 text-warning"
            label="Total Returns" value={String(kpis.count)} hint="All-time recorded" />
          <KpiCard icon={Calendar} iconBg="bg-primary/10 text-primary"
            label="This Month" value={String(kpis.monthCount)} hint="Recent activity" />
          <KpiCard icon={ClipboardList} iconBg="bg-warning/10 text-warning"
            label="Awaiting Credit" value={String(kpis.pending)} hint="Pending supplier confirmation" />
          <KpiCard icon={TrendingDown} iconBg="bg-destructive/10 text-destructive"
            label="Return Value" value={inr(kpis.total)}
            hint="Total amount returned" hintColor="text-destructive" />
        </div>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h2 className="text-lg font-semibold tracking-tight">Recent Returns</h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Return ID</TableHead>
                <TableHead>Bill #</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right pr-5">Amount</TableHead>
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
                  <TableCell className="font-medium">{r.purchases?.bill_no ?? "—"}</TableCell>
                  <TableCell>{r.suppliers?.name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(r.return_date).toLocaleDateString("en", {
                      month: "short", day: "numeric", year: "numeric",
                    })}
                  </TableCell>
                  <TableCell className="text-muted-foreground truncate max-w-[220px]">
                    {r.reason ?? "—"}
                  </TableCell>
                  <TableCell>
                    <StatusPill status={(r.status ?? "sent").toLowerCase()} />
                  </TableCell>
                  <TableCell className="text-right pr-5 font-semibold tabular-nums">
                    {inr(r.grand_total)}
                  </TableCell>
                </TableRow>
              ))}
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-14 text-muted-foreground">
                    <RotateCcw className="h-7 w-7 mx-auto mb-2 opacity-50" />
                    No purchase returns yet.
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

function NewPurchaseReturnDialog({
  onClose, onSaved, userId,
}: { onClose: () => void; onSaved: () => void; userId?: string }) {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [purchaseId, setPurchaseId] = useState("");
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [status, setStatus] = useState("sent");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("purchases")
        .select("id, bill_no, grand_total, supplier_id, suppliers(name)")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(100);
      setPurchases(data ?? []);
    })();
  }, []);

  const selectedPurchase = purchases.find((p) => p.id === purchaseId);

  const save = async () => {
    if (!purchaseId) { toast.error("Pick the original purchase"); return; }
    if (amount <= 0) { toast.error("Return amount must be > 0"); return; }
    setBusy(true);
    const { error } = await supabase.from("purchase_returns").insert({
      purchase_id: purchaseId,
      supplier_id: selectedPurchase?.supplier_id ?? null,
      return_no: `PR-${Date.now().toString().slice(-6)}`,
      reason,
      grand_total: amount,
      status,
      created_by: userId,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Purchase return recorded");
    onSaved();
  };

  return (
    <DialogContent className="sm:max-w-[480px]">
      <DialogHeader>
        <DialogTitle>Record Purchase Return</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5" /> Original Purchase
          </label>
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={purchaseId}
            onChange={(e) => {
              setPurchaseId(e.target.value);
              const p = purchases.find((x) => x.id === e.target.value);
              setAmount(Number(p?.grand_total ?? 0));
            }}
          >
            <option value="">Select a bill…</option>
            {purchases.map((p) => (
              <option key={p.id} value={p.id}>
                {p.bill_no ?? p.id.slice(0, 8)} · {p.suppliers?.name ?? "—"} · {inr(p.grand_total)}
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
            placeholder="Defective batch, wrong specs, overshipment…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Return amount
            </label>
            <Input
              className="h-10 tabular-nums"
              type="number"
              value={amount}
              onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Status
            </label>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="sent">Sent</option>
              <option value="credited">Credited</option>
              <option value="rejected">Rejected</option>
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

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    sent: "bg-warning/15 text-warning",
    credited: "bg-success/15 text-success",
    rejected: "bg-destructive/15 text-destructive",
  };
  const cls = map[status] ?? "bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold capitalize ${cls}`}>
      {status}
    </span>
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