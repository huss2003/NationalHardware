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
import { ReprintLabelDialog } from "@/components/erp/ReprintLabelDialog";
import { Checkbox } from "@/components/ui/checkbox";
import { mintReprintForSale, type MintedSticker } from "@/lib/relabel";
import { inr } from "@/lib/codes";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-store";
import {
  Plus, Undo2, Receipt, Wallet, TrendingDown, Calendar, Warehouse, History, Printer,
} from "lucide-react";

export const Route = createFileRoute("/_app/sales-returns/")({ component: SalesReturns });

function SalesReturns() {
  const user = useAuth((s) => s.user);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [timeline, setTimeline] = useState<{ id: string; no: string } | null>(null);

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
        subtitle="Scan items, restock to a godown, and issue refunds."
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
            label="Total Returns" value={String(kpis.count)} hint="All-time recorded" />
          <KpiCard icon={Calendar} iconBg="bg-primary/10 text-primary"
            label="This Month" value={String(kpis.monthCount)} hint="Returns in current month" />
          <KpiCard icon={Receipt} iconBg="bg-destructive/10 text-destructive"
            label="Return Value" value={inr(kpis.total)}
            hint={<><TrendingDown className="h-3 w-3" /> Across all returns</>}
            hintColor="text-destructive" />
          <KpiCard icon={Wallet} iconBg="bg-success/10 text-success"
            label="Refunded" value={inr(kpis.refunded)} hint="Settled to customers" />
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
                  <TableCell className="text-right tabular-nums">{inr(r.refund_amount)}</TableCell>
                  <TableCell className="text-right pr-5 font-semibold tabular-nums">{inr(r.grand_total)}</TableCell>
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

      <ReturnTimelineDialog
        open={!!timeline}
        onOpenChange={(v) => !v && setTimeline(null)}
        returnId={timeline?.id ?? null}
        returnNo={timeline?.no}
        refTable="sales_returns"
      />
    </>
  );
}

function NewSalesReturnDialog({
  onClose, onSaved, userId,
}: { onClose: () => void; onSaved: () => void; userId?: string }) {
  const [sales, setSales] = useState<any[]>([]);
  const [saleId, setSaleId] = useState("");
  const [saleLines, setSaleLines] = useState<any[]>([]);
  const [godowns, setGodowns] = useState<any[]>([]);
  const [godownId, setGodownId] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reprintBusy, setReprintBusy] = useState<string | null>(null);
  const [reprintItems, setReprintItems] = useState<MintedSticker[]>([]);
  const [reprintOpen, setReprintOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [refundMode, setRefundMode] = useState("cash");
  const [scanError, setScanError] = useState<{ kind: ScanWarningKind; msg: string; code?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: s }, { data: g }] = await Promise.all([
        supabase.from("sales")
          .select("id, invoice_no, grand_total, customer_id, customers(name)")
          .is("deleted_at", null)
          .order("invoice_date", { ascending: false })
          .limit(100),
        supabase.from("godowns").select("id, name").eq("active", true).order("name"),
      ]);
      setSales(s ?? []);
      setGodowns(g ?? []);
    })();
  }, []);

  useEffect(() => {
    setSelected(new Set()); setScanError(null);
    if (!saleId) { setSaleLines([]); return; }
    (async () => {
      const { data } = await supabase
        .from("sales_items")
        .select("item_instance_id, product_id, qty, rate, gst_rate, products(name), item_instances(status)")
        .eq("sale_id", saleId);
      setSaleLines((data ?? []).filter((d: any) => d.item_instance_id));
    })();
  }, [saleId]);

  const selectedSale = sales.find((s) => s.id === saleId);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const onScan = async (code: string) => {
    setScanError(null);
    if (!saleId) { setScanError({ kind: "generic", msg: "Pick an invoice first." }); return; }
    const line = saleLines.find((l) => l.item_instance_id === code);
    if (!line) {
      setScanError({ kind: "unknown", code, msg: "This item was not sold on the selected invoice." });
      return;
    }
    const status = line.item_instances?.status;
    if (status !== "sold") {
      setScanError({ kind: "generic", code, msg: `Status is ${String(status).toUpperCase()} — only SOLD items can be returned.` });
      return;
    }
    toggle(code);
  };

  const cart = useMemo(() => saleLines
    .filter((l: any) => selected.has(l.item_instance_id))
    .map((l: any) => ({
      item_instance_id: l.item_instance_id as string,
      product_id: l.product_id as string,
      product_name: l.products?.name ?? "Item",
      rate: Number(l.rate ?? 0),
      gst_rate: Number(l.gst_rate ?? 0),
      qty: Number(l.qty ?? 1),
    })), [saleLines, selected]);

  const subtotal = cart.reduce((s, c) => s + c.rate * c.qty, 0);
  const tax = cart.reduce((s, c) => s + (c.rate * c.qty * c.gst_rate) / 100, 0);
  const grand = subtotal + tax;

  const reprintOne = async (originalId: string) => {
    setReprintBusy(originalId);
    try {
      const minted = await mintReprintForSale(originalId, userId, `Reprint via sales return for ${originalId}`);
      setReprintItems([minted]);
      setReprintOpen(true);
      toast.success(`New sticker ${minted.id} minted`);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to mint sticker");
    } finally {
      setReprintBusy(null);
    }
  };

  const reprintAllSelected = async () => {
    if (cart.length === 0) return;
    setBusy(true);
    try {
      const minted: MintedSticker[] = [];
      for (const c of cart) {
        minted.push(await mintReprintForSale(c.item_instance_id, userId, `Bulk reprint via sales return`));
      }
      setReprintItems(minted);
      setReprintOpen(true);
      toast.success(`${minted.length} new sticker(s) minted`);
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!saleId) { toast.error("Pick the original sale"); return; }
    if (cart.length === 0) { toast.error("Select at least one item to return"); return; }
    setBusy(true);

    const returnNo = `SR-${Date.now().toString().slice(-6)}`;
    const { data: ret, error } = await supabase.from("sales_returns").insert({
      sale_id: saleId,
      customer_id: selectedSale?.customer_id ?? null,
      return_no: returnNo,
      reason,
      subtotal, tax_total: tax, grand_total: grand,
      refund_amount: grand,
      refund_mode: refundMode,
      status: "completed",
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
    await supabase.from("sales_return_items").insert(lines);

    // Update inventory & write history
    for (const c of cart) {
      const update: any = { status: "returned" };
      if (godownId) update.godown_id = godownId;
      await supabase.from("item_instances").update(update).eq("id", c.item_instance_id);
      await supabase.from("item_history").insert({
        item_id: c.item_instance_id,
        event: "returned",
        ref_table: "sales_returns",
        ref_id: ret.id,
        actor_user_id: userId ?? null,
        notes: reason || `Returned via ${returnNo}`,
      });
      if (godownId) {
        const gname = godowns.find((g) => g.id === godownId)?.name ?? "godown";
        await supabase.from("item_history").insert({
          item_id: c.item_instance_id,
          event: "moved",
          ref_table: "godowns",
          ref_id: godownId,
          actor_user_id: userId ?? null,
          notes: `Restocked → ${gname}`,
        });
      }
    }

    setBusy(false);
    toast.success(`Return ${returnNo} recorded with ${cart.length} item(s)`);
    onSaved();
  };

  const eligibleCount = saleLines.filter((l: any) => l.item_instances?.status === "sold").length;
  const allEligibleSelected = eligibleCount > 0 && saleLines
    .filter((l: any) => l.item_instances?.status === "sold")
    .every((l: any) => selected.has(l.item_instance_id));

  return (
    <DialogContent className="sm:max-w-[860px] max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Record Sales Return</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label icon={Receipt}>Original Sale</Label>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={saleId}
              onChange={(e) => setSaleId(e.target.value)}
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
            <Label icon={Warehouse}>Restock to godown (optional)</Label>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={godownId}
              onChange={(e) => setGodownId(e.target.value)}
            >
              <option value="">— No restock —</option>
              {godowns.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
        </div>

        {saleId && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Items on this invoice — tick what's coming back</Label>
              <div className="text-xs text-muted-foreground">
                {selected.size} of {eligibleCount} eligible selected
              </div>
            </div>
            <InvoiceItemsPicker
              lines={saleLines}
              selected={selected}
              onToggle={toggle}
              allEligibleSelected={allEligibleSelected}
              onToggleAll={() => {
                setSelected((prev) => {
                  if (allEligibleSelected) return new Set();
                  const next = new Set(prev);
                  saleLines.forEach((l: any) => {
                    if (l.item_instances?.status === "sold") next.add(l.item_instance_id);
                  });
                  return next;
                });
              }}
              onReprint={reprintOne}
              reprintBusy={reprintBusy}
            />
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <ScanInput onScan={onScan} placeholder="Optional: scan to toggle an item" invalid={!!scanError} />
              {cart.length > 0 && (
                <Button type="button" variant="outline" size="sm" className="gap-2" onClick={reprintAllSelected} disabled={busy}>
                  <Printer className="h-4 w-4" /> Reprint all selected
                </Button>
              )}
            </div>
            {scanError && <ScanWarning kind={scanError.kind} message={scanError.msg} code={scanError.code} />}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Reason</Label>
            <textarea
              className="w-full min-h-[72px] rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Damaged on delivery, wrong item, etc."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <div>
              <Label>Refund via</Label>
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
      <ReprintLabelDialog
        open={reprintOpen}
        onOpenChange={setReprintOpen}
        items={reprintItems}
        title="Reprint stickers"
      />
    </DialogContent>
  );
}

function InvoiceItemsPicker({
  lines, selected, onToggle, allEligibleSelected, onToggleAll, onReprint, reprintBusy,
}: {
  lines: any[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  allEligibleSelected: boolean;
  onToggleAll: () => void;
  onReprint: (id: string) => void;
  reprintBusy: string | null;
}) {
  if (lines.length === 0) {
    return (
      <div className="border border-dashed rounded-lg p-6 text-center text-xs text-muted-foreground">
        No scannable items on this invoice.
      </div>
    );
  }
  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8 pl-3">
              <Checkbox checked={allEligibleSelected} onCheckedChange={() => onToggleAll()} />
            </TableHead>
            <TableHead className="text-[11px] uppercase tracking-wider">Item ID</TableHead>
            <TableHead className="text-[11px] uppercase tracking-wider">Product</TableHead>
            <TableHead className="text-[11px] uppercase tracking-wider">Status</TableHead>
            <TableHead className="text-[11px] uppercase tracking-wider text-right">Rate</TableHead>
            <TableHead className="text-[11px] uppercase tracking-wider text-right pr-3">Reprint</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((l: any) => {
            const id = l.item_instance_id as string;
            const status = l.item_instances?.status ?? "—";
            const eligible = status === "sold";
            const isChecked = selected.has(id);
            return (
              <TableRow key={id} className={!eligible ? "opacity-50" : ""}>
                <TableCell className="pl-3">
                  <Checkbox
                    checked={isChecked}
                    disabled={!eligible}
                    onCheckedChange={() => eligible && onToggle(id)}
                  />
                </TableCell>
                <TableCell className="font-mono text-xs">{id}</TableCell>
                <TableCell>{l.products?.name ?? "Item"}</TableCell>
                <TableCell><span className="text-[11px] uppercase tracking-wider text-muted-foreground">{status}</span></TableCell>
                <TableCell className="text-right tabular-nums">{inr(l.rate)}</TableCell>
                <TableCell className="text-right pr-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5"
                    disabled={!isChecked || reprintBusy === id}
                    onClick={() => onReprint(id)}
                    title={isChecked ? "Mint a new sequential sticker" : "Tick the row first"}
                  >
                    <Printer className="h-3.5 w-3.5" />
                    {reprintBusy === id ? "…" : "Reprint"}
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
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
      <Row k={<span className="font-semibold">Refund</span>} v={<span className="font-semibold">{inr(grand)}</span>} />
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