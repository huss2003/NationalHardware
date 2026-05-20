import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/erp/PageHeader";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { TableSkeleton } from "@/components/erp/Skeletons";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { ScanInput } from "@/components/erp/ScanInput";
import { ScanWarning, type ScanWarningKind } from "@/components/erp/ScanWarning";
import { ReturnTimelineDialog } from "@/components/erp/ReturnTimelineDialog";
import { inr } from "@/lib/codes";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-store";
import {
  Plus, RotateCcw, ClipboardList, TrendingDown, Calendar, Building2, Trash2, History,
} from "lucide-react";

export const Route = createFileRoute("/_app/purchase-returns/")({ component: PurchaseReturns });

function PurchaseReturns() {
  const user = useAuth((s) => s.user);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [timeline, setTimeline] = useState<{ id: string; no: string } | null>(null);

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
        subtitle="Scan items, raise a debit note, and notify the supplier."
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
            <span className="text-xs text-muted-foreground">Click any row to view item timeline</span>
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
                <TableRow
                  key={r.id}
                  className="cursor-pointer hover:bg-muted/40"
                  onClick={() => setTimeline({ id: r.id, no: r.return_no ?? r.id.slice(0, 8) })}
                >
                  <TableCell className="pl-5 font-mono text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <History className="h-3 w-3 opacity-60" />
                      {r.return_no ?? r.id.slice(0, 8)}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium">{r.purchases?.bill_no ?? "—"}</TableCell>
                  <TableCell>{r.suppliers?.name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(r.return_date).toLocaleDateString("en", {
                      month: "short", day: "numeric", year: "numeric",
                    })}
                  </TableCell>
                  <TableCell className="text-muted-foreground truncate max-w-[220px]">{r.reason ?? "—"}</TableCell>
                  <TableCell><StatusPill status={(r.status ?? "sent").toLowerCase()} /></TableCell>
                  <TableCell className="text-right pr-5 font-semibold tabular-nums">{inr(r.grand_total)}</TableCell>
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

      <ReturnTimelineDialog
        open={!!timeline}
        onOpenChange={(v) => !v && setTimeline(null)}
        returnId={timeline?.id ?? null}
        returnNo={timeline?.no}
        refTable="purchase_returns"
      />
    </>
  );
}

type ScannedRow = {
  item_instance_id: string;
  product_id: string;
  product_name: string;
  rate: number;
  gst_rate: number;
  qty: number;
};

function NewPurchaseReturnDialog({
  onClose, onSaved, userId,
}: { onClose: () => void; onSaved: () => void; userId?: string }) {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [purchaseId, setPurchaseId] = useState("");
  const [instances, setInstances] = useState<any[]>([]);
  const [cart, setCart] = useState<ScannedRow[]>([]);
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState("sent");
  const [scanError, setScanError] = useState<string | null>(null);
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

  useEffect(() => {
    setCart([]); setScanError(null);
    if (!purchaseId) { setInstances([]); return; }
    (async () => {
      const { data: pi } = await supabase
        .from("purchase_items")
        .select("id, product_id, rate, gst_rate, products(name)")
        .eq("purchase_id", purchaseId);
      const piIds = (pi ?? []).map((p: any) => p.id);
      if (piIds.length === 0) { setInstances([]); return; }
      const { data: inst } = await supabase
        .from("item_instances")
        .select("id, product_id, status, source_purchase_item_id, cost_price, godown_id")
        .in("source_purchase_item_id", piIds);
      const piMap = new Map((pi ?? []).map((p: any) => [p.id, p]));
      setInstances((inst ?? []).map((i: any) => ({
        ...i,
        rate: Number(piMap.get(i.source_purchase_item_id)?.rate ?? i.cost_price ?? 0),
        gst_rate: Number(piMap.get(i.source_purchase_item_id)?.gst_rate ?? 0),
        product_name: piMap.get(i.source_purchase_item_id)?.products?.name ?? "Item",
      })));
    })();
  }, [purchaseId]);

  const selectedPurchase = purchases.find((p) => p.id === purchaseId);

  const onScan = async (code: string) => {
    setScanError(null);
    if (!purchaseId) { setScanError({ kind: "generic", msg: "Pick a purchase bill first." }); return; }
    const prefix = code.split("-")[0]?.toUpperCase();
    const known = Array.from(new Set(instances.map((i: any) => i.product_prefix).filter(Boolean)));
    if (cart.some((c) => c.item_instance_id === code)) {
      setScanError({ kind: "duplicate", code, msg: "This item is already in the return cart." }); return;
    }
    const inst = instances.find((i) => i.id === code);
    if (!inst) {
      if (known.length && prefix && !known.includes(prefix)) {
        setScanError({ kind: "wrong_prefix", code,
          msg: `Prefix "${prefix}" doesn't match this bill. Expected: ${known.join(", ")}.` });
      } else {
        setScanError({ kind: "unknown", code, msg: "This item was not on the selected purchase bill." });
      }
      return;
    }
    if (inst.status !== "available") {
      const kind: ScanWarningKind =
        inst.status === "sold" ? "sold"
        : inst.status === "damaged" ? "damaged"
        : inst.status === "used_in_production" ? "used"
        : "generic";
      setScanError({ kind, code, msg: `Status is ${String(inst.status).toUpperCase()} — cannot return to supplier.` });
      return;
    }
    setCart((c) => [...c, {
      item_instance_id: code,
      product_id: inst.product_id,
      product_name: inst.product_name,
      rate: inst.rate,
      gst_rate: inst.gst_rate,
      qty: 1,
    }]);
  };

  const subtotal = cart.reduce((s, c) => s + c.rate * c.qty, 0);
  const tax = cart.reduce((s, c) => s + (c.rate * c.qty * c.gst_rate) / 100, 0);
  const grand = subtotal + tax;

  const save = async () => {
    if (!purchaseId) { toast.error("Pick the original purchase"); return; }
    if (cart.length === 0) { toast.error("Scan at least one item"); return; }
    setBusy(true);

    const returnNo = `PR-${Date.now().toString().slice(-6)}`;
    const { data: ret, error } = await supabase.from("purchase_returns").insert({
      purchase_id: purchaseId,
      supplier_id: selectedPurchase?.supplier_id ?? null,
      return_no: returnNo,
      reason,
      subtotal, tax_total: tax, grand_total: grand,
      status,
      created_by: userId,
    }).select("id").single();

    if (error || !ret) { setBusy(false); toast.error(error?.message ?? "Failed"); return; }

    const lines = cart.map((c) => ({
      return_id: ret.id,
      product_id: c.product_id,
      item_instance_id: c.item_instance_id,
      qty: c.qty,
      rate: c.rate,
      gst_rate: c.gst_rate,
      line_total: c.rate * c.qty,
    }));
    await supabase.from("purchase_return_items").insert(lines);

    for (const c of cart) {
      const inst = instances.find((i) => i.id === c.item_instance_id);
      await supabase.from("item_instances")
        .update({ status: "returned", godown_id: null })
        .eq("id", c.item_instance_id);
      await supabase.from("item_history").insert({
        item_id: c.item_instance_id,
        event: "returned",
        ref_table: "purchase_returns",
        ref_id: ret.id,
        actor_user_id: userId ?? null,
        notes: reason || `Returned to supplier via ${returnNo}`,
      });
      if (inst?.godown_id) {
        await supabase.from("item_history").insert({
          item_id: c.item_instance_id,
          event: "moved",
          ref_table: "godowns",
          ref_id: inst.godown_id,
          actor_user_id: userId ?? null,
          notes: `Removed from godown on return`,
        });
      }
    }

    setBusy(false);
    toast.success(`Return ${returnNo} sent with ${cart.length} item(s)`);
    onSaved();
  };

  return (
    <DialogContent className="sm:max-w-[760px] max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Record Purchase Return</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div>
          <Label icon={Building2}>Original Purchase</Label>
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={purchaseId}
            onChange={(e) => setPurchaseId(e.target.value)}
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
          <Label>Scan items being returned to supplier</Label>
      <ScanInput onScan={onScan} placeholder="Scan / type item ID and press Enter" invalid={!!scanError} />
      {scanError && <ScanWarning kind={scanError.kind} message={scanError.msg} code={scanError.code} />}
          {purchaseId && instances.length > 0 && (
            <div className="mt-2 text-xs text-muted-foreground">
              {instances.filter((i) => i.status === "available").length} of {instances.length} units still available to return
            </div>
          )}
        </div>

        <ScannedTable cart={cart} onRemove={(id) => setCart((c) => c.filter((x) => x.item_instance_id !== id))} />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Reason</Label>
            <textarea
              className="w-full min-h-[72px] rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Defective batch, wrong specs, overshipment…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <div>
              <Label>Status</Label>
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
            <Totals subtotal={subtotal} tax={tax} grand={grand} />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={busy}>
          {busy ? "Saving…" : `Record Return · ${inr(grand)}`}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function ScannedTable({
  cart, onRemove,
}: { cart: ScannedRow[]; onRemove: (id: string) => void }) {
  if (cart.length === 0) {
    return (
      <div className="border border-dashed rounded-lg p-6 text-center text-xs text-muted-foreground">
        Scanned items will appear here.
      </div>
    );
  }
  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-[11px] uppercase tracking-wider">Item ID</TableHead>
            <TableHead className="text-[11px] uppercase tracking-wider">Product</TableHead>
            <TableHead className="text-[11px] uppercase tracking-wider text-right">Rate</TableHead>
            <TableHead className="text-[11px] uppercase tracking-wider text-right">Total</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cart.map((c) => (
            <TableRow key={c.item_instance_id}>
              <TableCell className="font-mono text-xs">{c.item_instance_id}</TableCell>
              <TableCell>{c.product_name}</TableCell>
              <TableCell className="text-right tabular-nums">{inr(c.rate)}</TableCell>
              <TableCell className="text-right tabular-nums">{inr(c.rate * c.qty)}</TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="icon" onClick={() => onRemove(c.item_instance_id)}>
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function Totals({ subtotal, tax, grand }: { subtotal: number; tax: number; grand: number }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
      <Row k="Subtotal" v={inr(subtotal)} />
      <Row k="Tax" v={inr(tax)} />
      <div className="border-t my-1" />
      <Row k={<span className="font-semibold">Total</span>} v={<span className="font-semibold">{inr(grand)}</span>} />
    </div>
  );
}

function Row({ k, v }: { k: React.ReactNode; v: React.ReactNode }) {
  return <div className="flex justify-between tabular-nums"><span className="text-muted-foreground">{k}</span><span>{v}</span></div>;
}

function Label({ children, icon: Icon }: { children: React.ReactNode; icon?: any }) {
  return (
    <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
      {Icon && <Icon className="h-3.5 w-3.5" />} {children}
    </label>
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
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold capitalize ${cls}`}>{status}</span>
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
      <div className="text-[28px] leading-none font-semibold tracking-tight tabular-nums">{value}</div>
      <div className={`text-xs mt-3 inline-flex items-center gap-1 ${hintColor ?? "text-muted-foreground"}`}>{hint}</div>
    </Card>
  );
}