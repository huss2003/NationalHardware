import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageHeader } from "@/components/erp/PageHeader";
import { inr, fmtDate } from "@/lib/codes";
import { useAuth } from "@/lib/auth-store";
import { isPrintServerEnabled, printReceipt as printReceiptServer } from "@/lib/printServer";
import { toast } from "sonner";
import { ArrowLeft, Receipt as ReceiptIcon, Wallet, FileText, Check, MessageCircle, Printer as ThermalIcon } from "lucide-react";
import { TableSkeleton } from "@/components/erp/Skeletons";
// jspdf + jspdf-autotable (~250KB) loaded only when the user prints/downloads a receipt.
import { Printer, Download } from "lucide-react";

export const Route = createFileRoute("/_app/sales/receipts")({ component: ReceiptsPage });

type Customer = { id: string; name: string; phone?: string | null };
type Receipt = {
  id: string; receipt_no: string; customer_id: string;
  receipt_type: string; amount: number; mode: string;
  created_at: string; notes?: string | null;
  customers?: { name: string } | null;
};

async function generateReceiptArtifacts(r: Receipt, customer: Customer, shop: any) {
  try {
    const { buildReceiptPdf, receiptFileName, shareInvoiceOnWhatsApp } = await import("@/lib/invoice-pdf");
    const pdf = buildReceiptPdf({ shop, receipt: r as any, customer: customer as any });
    pdf.save(receiptFileName(r.receipt_no));
    if (customer.phone) {
      try {
        await shareInvoiceOnWhatsApp({
          pdf,
          invoiceNo: `Receipt-${r.receipt_no}`,
          phone: customer.phone,
          shopName: shop?.shop_name ?? undefined,
          total: Number(r.amount),
        });
      } catch {
        toast.message("PDF downloaded. Use the WhatsApp button to share.");
      }
    }
  } catch (e: any) {
    toast.error(`PDF generation failed: ${e.message ?? e}`);
  }
}

function ReceiptsPage() {
  const user = useAuth((s) => s.user);
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"credit" | "general">("credit");
  const [openFor, setOpenFor] = useState<Customer | null>(null);
  const { data, isLoading: loading } = useQuery({
    queryKey: ["receipts-page"],
    queryFn: async () => {
      const [c, s, r, sh] = await Promise.all([
        supabase.from("customers").select("id, name, phone").order("name"),
        supabase.from("sales").select("id, customer_id, grand_total, paid_amount, payment_mode, invoice_no, invoice_date").is("deleted_at", null),
        supabase.from("receipts").select("*, customers(name)").order("created_at", { ascending: false }).limit(50),
        supabase.from("app_settings").select("*").eq("id", true).maybeSingle(),
      ]);
      return {
        customers: ((c.data as any) ?? []) as Customer[],
        sales: s.data ?? [],
        receipts: ((r.data as any) ?? []) as Receipt[],
        shop: sh.data,
      };
    },
    staleTime: 30_000,
  });
  const customers = data?.customers ?? [];
  const sales = data?.sales ?? [];
  const receipts = data?.receipts ?? [];
  const shop = data?.shop ?? null;
  const load = () => queryClient.invalidateQueries({ queryKey: ["receipts-page"] });

  const buildPdfFor = async (r: Receipt) => {
    const { buildReceiptPdf } = await import("@/lib/invoice-pdf");
    const cust = customers.find((c) => c.id === r.customer_id) ?? { name: r.customers?.name ?? "—" };
    return buildReceiptPdf({
      shop, receipt: r,
      customer: cust as any,
    });
  };
  const printReceipt = async (r: Receipt) => {
    const pdf = await buildPdfFor(r);
    pdf.autoPrint();
    const url = pdf.output("bloburl");
    window.open(url, "_blank");
  };
  // Send the receipt to the SEZNIK POS58 thermal printer via the local print server.
  const thermalReceipt = async (r: Receipt) => {
    try {
      const cust = customers.find((c) => c.id === r.customer_id);
      await printReceiptServer({
        header: shop?.shop_name ?? "RECEIPT",
        footer: "Thank you!",
        items: [
          { name: `Receipt ${r.receipt_no}`, price: Number(r.amount) },
          { name: cust?.name ?? r.customers?.name ?? "Customer", price: 0 },
          { name: `Mode: ${r.mode}`, price: 0 },
        ],
        subtotal: Number(r.amount),
        tax: 0,
        total: Number(r.amount),
      });
      toast.success("Receipt sent to POS58 printer");
    } catch (e: any) {
      toast.error(`Print server error: ${e.message ?? e}`);
    }
  };
  const downloadReceipt = async (r: Receipt) => {
    const pdf = await buildPdfFor(r);
    const { receiptFileName } = await import("@/lib/invoice-pdf");
    pdf.save(receiptFileName(r.receipt_no));
  };
  const whatsappReceipt = async (r: Receipt) => {
    const cust = customers.find((c) => c.id === r.customer_id);
    if (!cust?.phone) { toast.error("Customer has no phone number"); return; }
    try {
      const pdf = await buildPdfFor(r);
      const { shareInvoiceOnWhatsApp } = await import("@/lib/invoice-pdf");
      await shareInvoiceOnWhatsApp({
        pdf,
        invoiceNo: `Receipt-${r.receipt_no}`,
        phone: cust.phone,
        shopName: shop?.shop_name ?? undefined,
        total: Number(r.amount),
      });
    } catch (e: any) {
      toast.error(`WhatsApp share failed: ${e.message ?? e}`);
    }
  };

  // Pending per customer = sum(grand_total - paid_amount of credit sales) - sum(credit receipts)
  const pending = useMemo(() => {
    const map = new Map<string, { customer: Customer; due: number }>();
    for (const s of sales) {
      if (!s.customer_id) continue;
      const d = Number(s.grand_total) - Number(s.paid_amount);
      if (d <= 0.01) continue;
      const cust = customers.find((c) => c.id === s.customer_id);
      if (!cust) continue;
      const cur = map.get(cust.id) ?? { customer: cust, due: 0 };
      cur.due += d;
      map.set(cust.id, cur);
    }
    for (const r of receipts) {
      if (r.receipt_type !== "credit") continue;
      const cur = map.get(r.customer_id);
      if (cur) { cur.due -= Number(r.amount); if (cur.due <= 0.01) map.delete(r.customer_id); }
    }
    return Array.from(map.values()).sort((a, b) => b.due - a.due);
  }, [sales, receipts, customers]);

  return (
    <>
      <PageHeader
        title="Receipts"
        subtitle="Record customer payments against pending credits or as general entries."
        actions={
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link to="/sales"><ArrowLeft className="h-4 w-4" /> Back to Sales</Link>
          </Button>
        }
      />
      <div className="px-4 sm:px-6 lg:px-8 pb-10 max-w-[1400px] mx-auto w-full space-y-5">
        <div className="inline-flex rounded-lg border border-input bg-card p-1">
          {[
            { v: "credit" as const, label: "Pending Credits", icon: Wallet },
            { v: "general" as const, label: "General Entry", icon: FileText },
          ].map((t) => {
            const Icon = t.icon;
            const active = tab === t.v;
            return (
              <button
                key={t.v}
                onClick={() => setTab(t.v)}
                className={`flex items-center gap-2 h-9 px-4 rounded-md text-sm font-medium transition-colors ${
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" /> {t.label}
              </button>
            );
          })}
        </div>

        {tab === "credit" ? (
          <Card className="overflow-hidden">
            <div className="px-5 pt-5 pb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Customers with Pending Credit</h2>
              <span className="text-sm text-muted-foreground">
                {pending.length} customer{pending.length === 1 ? "" : "s"}
              </span>
            </div>
            {loading ? <TableSkeleton rows={4} columns={3} /> : (
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr><th className="text-left p-3 pl-5">Customer</th><th className="text-right p-3">Pending Amount</th><th className="text-right p-3 pr-5">Action</th></tr>
                </thead>
                <tbody>
                  {pending.map((p) => (
                    <tr key={p.customer.id} className="border-t hover:bg-muted/30">
                      <td className="p-3 pl-5 font-medium">{p.customer.name}</td>
                      <td className="p-3 text-right font-bold tabular-nums text-destructive">{inr(p.due)}</td>
                      <td className="p-3 pr-5 text-right">
                        <Button size="sm" className="gap-2" onClick={() => setOpenFor(p.customer)}>
                          <ReceiptIcon className="h-4 w-4" /> Create Receipt
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {pending.length === 0 && (
                    <tr><td colSpan={3} className="text-center py-12 text-muted-foreground">No pending credits. 🎉</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </Card>
        ) : (
          <GeneralEntryCard customers={customers} onSaved={load} userId={user?.id ?? ""} shop={shop} />
        )}

        {/* Recent receipts */}
        <Card className="overflow-hidden">
          <div className="px-5 pt-5 pb-3"><h2 className="text-lg font-semibold">Recent Receipts</h2></div>
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left p-3 pl-5">Receipt #</th>
                <th className="text-left p-3">Customer</th>
                <th className="text-left p-3">Type</th>
                <th className="text-left p-3">Mode</th>
                <th className="text-left p-3">Date</th>
                <th className="text-right p-3 pr-5">Amount</th>
                <th className="text-right p-3 pr-5 w-40">Actions</th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3 pl-5 font-mono font-bold">{r.receipt_no}</td>
                  <td className="p-3">{r.customers?.name ?? "—"}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${r.receipt_type === "credit" ? "bg-primary/10 text-primary" : "bg-muted text-foreground"}`}>
                      {r.receipt_type === "credit" ? "Credit" : "General"}
                    </span>
                  </td>
                  <td className="p-3 capitalize">{r.mode}</td>
                  <td className="p-3 text-muted-foreground">{fmtDate(r.created_at)}</td>
                  <td className="p-3 pr-5 text-right font-semibold tabular-nums">{inr(r.amount)}</td>
                  <td className="p-3 pr-5 text-right">
                    <div className="inline-flex gap-1">
                      <Button size="sm" variant="outline" className="gap-1 h-8" onClick={() => printReceipt(r)}>
                        <Printer className="h-3.5 w-3.5" /> Print
                      </Button>
                      {isPrintServerEnabled() && (
                        <Button size="sm" variant="outline" className="gap-1 h-8" onClick={() => thermalReceipt(r)}>
                          <ThermalIcon className="h-3.5 w-3.5" /> Thermal
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="gap-1 h-8" onClick={() => downloadReceipt(r)}>
                        <Download className="h-3.5 w-3.5" /> PDF
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1 h-8" onClick={() => whatsappReceipt(r)}>
                        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {receipts.length === 0 && (
                <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">No receipts yet.</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>

      {openFor && (
        <CreditReceiptDialog
          customer={openFor}
          maxAmount={pending.find((p) => p.customer.id === openFor.id)?.due ?? 0}
          onClose={() => setOpenFor(null)}
          onSaved={() => { setOpenFor(null); load(); }}
          shop={shop}
          userId={user?.id ?? ""}
        />
      )}
    </>
  );
}

function CreditReceiptDialog({
  customer, maxAmount, onClose, onSaved, userId, shop,
}: { customer: Customer; maxAmount: number; onClose: () => void; onSaved: () => void; userId: string; shop: any }) {
  const [amount, setAmount] = useState<number>(maxAmount);
  const [mode, setMode] = useState("cash");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    if (amount <= 0) { toast.error("Amount must be > 0"); return; }
    setBusy(true);
    const { data: noData, error: noErr } = await supabase.rpc("next_receipt_no", { _customer_id: customer.id });
    if (noErr) { setBusy(false); toast.error(noErr.message); return; }
    const { data: inserted, error } = await supabase.from("receipts").insert({
      receipt_no: noData as string,
      customer_id: customer.id,
      receipt_type: "credit",
      amount, mode, notes,
      created_by: userId || null,
    }).select("*").single();
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Receipt ${noData} generated`);
    await generateReceiptArtifacts(inserted as any, customer, shop);
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Credit Receipt — {customer.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="rounded-lg bg-muted p-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Pending</span>
            <span className="font-bold tabular-nums">{inr(maxAmount)}</span>
          </div>
          <div>
            <Label>Amount Received</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="h-11 text-lg font-semibold tabular-nums" />
          </div>
          <div>
            <Label>Payment Mode</Label>
            <div className="grid grid-cols-4 gap-2 mt-1">
              {["cash", "upi", "card", "bank"].map((m) => (
                <button key={m} onClick={() => setMode(m)}
                  className={`h-10 rounded-md text-sm font-medium border capitalize ${mode === m ? "border-primary bg-primary/5" : "border-input text-muted-foreground"}`}>{m}</button>
              ))}
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={generate} disabled={busy} className="gap-2">
            <Check className="h-4 w-4" /> {busy ? "Generating…" : "Generate Receipt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GeneralEntryCard({ customers, onSaved, userId, shop }: { customers: Customer[]; onSaved: () => void; userId: string; shop: any }) {
  const [customerId, setCustomerId] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [mode, setMode] = useState("cash");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    if (!customerId) { toast.error("Select a customer"); return; }
    if (amount <= 0) { toast.error("Amount must be > 0"); return; }
    setBusy(true);
    const { data: noData, error: noErr } = await supabase.rpc("next_receipt_no", { _customer_id: customerId });
    if (noErr) { setBusy(false); toast.error(noErr.message); return; }
    const { data: inserted, error } = await supabase.from("receipts").insert({
      receipt_no: noData as string,
      customer_id: customerId,
      receipt_type: "general",
      amount, mode, notes,
      created_by: userId || null,
    }).select("*").single();
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Receipt ${noData} generated`);
    const cust = customers.find((c) => c.id === customerId);
    if (cust) await generateReceiptArtifacts(inserted as any, cust, shop);
    setCustomerId(""); setAmount(0); setNotes("");
    onSaved();
  };

  return (
    <Card className="p-6 max-w-2xl">
      <h2 className="text-lg font-semibold mb-1">General Receipt</h2>
      <p className="text-sm text-muted-foreground mb-5">No items — just customer and total amount.</p>
      <div className="space-y-4">
        <div>
          <Label>Customer</Label>
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="">Select customer</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <Label>Amount</Label>
          <Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="h-11 text-lg font-semibold tabular-nums" />
        </div>
        <div>
          <Label>Payment Mode</Label>
          <div className="grid grid-cols-4 gap-2 mt-1">
            {["cash", "upi", "card", "bank"].map((m) => (
              <button key={m} onClick={() => setMode(m)}
                className={`h-10 rounded-md text-sm font-medium border capitalize ${mode === m ? "border-primary bg-primary/5" : "border-input text-muted-foreground"}`}>{m}</button>
            ))}
          </div>
        </div>
        <div>
          <Label>Notes</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>
        <Button onClick={generate} disabled={busy} className="gap-2" size="lg">
          <Check className="h-4 w-4" /> {busy ? "Generating…" : "Generate Receipt"}
        </Button>
      </div>
    </Card>
  );
}