import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/erp/PageHeader";
import { ReturnTimelineDialog } from "@/components/erp/ReturnTimelineDialog";
import { inr, fmtDate } from "@/lib/codes";
import { Search, Users, Truck, FileText, ShoppingCart, Receipt as ReceiptIcon, RotateCcw, Wallet, Banknote, ArrowDownCircle, ArrowUpCircle } from "lucide-react";

export const Route = createFileRoute("/_app/ledger")({ component: LedgerPage });

type Kind = "customer" | "supplier" | "cash" | "bank";
type Party = { id: string; name: string; phone?: string | null };

const CUTOFF = "2026-04-01"; // FY25-26 comes from imported ledger; live data appends from here

type LedgerTxnType =
  | "opening" | "receipt" | "sale" | "payment" | "credit_note"
  | "purchase" | "journal" | "debit_note" | "sales_return"
  | "purchase_return" | "refund";

type CashTxn = {
  id: string;
  txn_date: string;
  txn_type: LedgerTxnType;
  vch_no: string | null;
  account_name: string;
  debit: number;
  credit: number;
  narration?: string | null;
};

const TYPE_LABEL: Record<LedgerTxnType, string> = {
  opening: "Opening",
  receipt: "Receipt",
  sale: "Sale",
  payment: "Payment",
  credit_note: "Credit Note",
  purchase: "Purchase",
  journal: "Journal",
  debit_note: "Debit Note",
  sales_return: "Sales Return",
  purchase_return: "Purchase Return",
  refund: "Refund",
};

const TYPE_STYLE: Record<LedgerTxnType, string> = {
  opening: "bg-muted text-muted-foreground",
  receipt: "bg-emerald-500/10 text-emerald-600",
  sale: "bg-blue-500/10 text-blue-600",
  payment: "bg-amber-500/10 text-amber-600",
  credit_note: "bg-rose-500/10 text-rose-600",
  purchase: "bg-amber-500/10 text-amber-600",
  journal: "bg-violet-500/10 text-violet-600",
  debit_note: "bg-orange-500/10 text-orange-600",
  sales_return: "bg-rose-500/10 text-rose-600",
  purchase_return: "bg-orange-500/10 text-orange-600",
  refund: "bg-muted text-muted-foreground",
};

const drcr = (n: number) => `${inr(Math.abs(n))} ${n >= 0 ? "Dr" : "Cr"}`;

type LedgerRow = {
  txn_date: string;
  txn_type: string;
  vch_no: string | null;
  account_name: string | null;
  debit: number;
  credit: number;
  seq: number;
};

type Entry = {
  date: string;
  type: LedgerTxnType;
  ref: string;
  saleId?: string;
  purchaseId?: string;
  returnId?: string;
  returnTable?: "sales_returns" | "purchase_returns";
  debit: number;
  credit: number;
  seq: number;
  notes?: string;
};

function ledgerRef(r: LedgerRow): string {
  const v = r.vch_no ? ` ${r.vch_no}` : "";
  const acct = r.account_name ? ` (${r.account_name})` : "";
  switch (r.txn_type) {
    case "opening": return "Opening Balance";
    case "sale": return `Sale${v}`;
    case "receipt": return `Receipt${v}${acct}`;
    case "sales_return": return `Sales Return${v}`;
    case "purchase": return `Purchase${v}`;
    case "payment": return `Payment${v}${acct}`;
    case "journal": return `Journal${v}`;
    case "credit_note": return `Credit Note${v}`;
    case "debit_note": return `Debit Note${v}`;
    default: return `${r.txn_type}${v}`;
  }
}

function LedgerPage() {
  const [kind, setKind] = useState<Kind>("customer");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Party | null>(null);
  const [returnView, setReturnView] = useState<{ id: string; no: string; refTable: "sales_returns" | "purchase_returns" } | null>(null);

  const { data: parties = [] } = useQuery({
    queryKey: ["ledger", "parties", kind],
    enabled: kind !== "cash",
    queryFn: async () => {
      const table = kind === "customer" ? "customers" : "suppliers";
      const { data } = await supabase.from(table).select("id, name, phone").order("name");
      return (data as Party[]) ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: cashTxns = [], isFetching: cashLoading } = useQuery({
    enabled: kind === "cash",
    queryKey: ["ledger", "cash"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from("cash_transactions")
        .select("id, txn_date, txn_type, vch_no, account_name, debit, credit")
        .order("txn_date", { ascending: true })
        .order("created_at", { ascending: true })
        .limit(2000);
      return (data as CashTxn[]) ?? [];
    },
  });

  const accountKind = kind === "cash";

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return parties;
    return parties.filter((p) =>
      p.name.toLowerCase().includes(q) || (p.phone ?? "").toLowerCase().includes(q),
    );
  }, [parties, search]);

  const { data: entries = [], isFetching: loading } = useQuery({
    enabled: !!selected,
    queryKey: ["ledger", "entries", kind, selected?.id, selected?.name],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const p = selected!;
      const list: Entry[] = [];
      if (kind === "customer") {
      const [s, r, sr] = await Promise.all([
        supabase.from("sales")
          .select("id, invoice_no, invoice_date, grand_total, paid_amount, payment_mode, notes")
          .eq("customer_id", p.id).is("deleted_at", null)
          .order("invoice_date", { ascending: true }),
        supabase.from("receipts")
          .select("id, receipt_no, amount, mode, created_at, receipt_type, notes")
          .eq("customer_id", p.id)
          .order("created_at", { ascending: true }),
        supabase.from("sales_returns")
          .select("id, return_no, return_date, grand_total, reason, refund_amount, refund_mode")
          .eq("customer_id", p.id).is("deleted_at", null)
          .order("return_date", { ascending: true }),
      ]);
      for (const x of s.data ?? []) {
        const total = Number(x.grand_total);
        const paid = Number(x.paid_amount);
        list.push({
          date: x.invoice_date as string,
          kind: "sale",
          ref: `Invoice ${x.invoice_no ?? ""}`.trim(),
          refId: x.id,
          debit: total,
          credit: paid,
          notes: x.notes ?? undefined,
        });
      }
      for (const x of r.data ?? []) {
        list.push({
          date: x.created_at as string,
          kind: "receipt",
          ref: `Receipt ${x.receipt_no} (${x.mode})`,
          debit: 0,
          credit: Number(x.amount),
          notes: x.notes ?? undefined,
        });
      }
      for (const x of sr.data ?? []) {
        const total = Number(x.grand_total);
        const refund = Number((x as any).refund_amount ?? 0);
        const mode = (x as any).refund_mode as string | null;
        list.push({
          date: x.return_date as string,
          kind: "sales-return",
          ref: `Sales Return ${x.return_no ?? ""}`.trim(),
          refId: x.id,
          refTable: "sales_returns",
          debit: 0,
          credit: total,
          notes: x.reason ?? undefined,
        });
        if (refund > 0 && mode && mode !== "credit_note") {
          list.push({
            date: x.return_date as string,
            kind: "refund-paid",
            ref: `Refund ${mode.toUpperCase()} for ${x.return_no ?? ""}`.trim(),
            refId: x.id,
            refTable: "sales_returns",
            debit: refund,
            credit: 0,
          });
        }
      }
      } else {
      const [p_, pr, sp] = await Promise.all([
        supabase.from("purchases")
          .select("id, bill_no, bill_date, grand_total")
          .eq("supplier_id", p.id).is("deleted_at", null)
          .order("bill_date", { ascending: true }),
        supabase.from("purchase_returns")
          .select("id, return_no, return_date, grand_total, reason")
          .eq("supplier_id", p.id).is("deleted_at", null)
          .order("return_date", { ascending: true }),
        supabase.from("supplier_payments")
          .select("id, payment_no, payment_date, amount, mode, notes")
          .eq("supplier_id", p.id)
          .order("payment_date", { ascending: true }),
      ]);
      for (const x of p_.data ?? []) {
        list.push({
          date: x.bill_date as string,
          kind: "purchase",
          ref: `Bill ${x.bill_no ?? ""}`.trim(),
          refId: x.id,
          debit: Number(x.grand_total),
          credit: 0,
        });
      }
      for (const x of pr.data ?? []) {
        list.push({
          date: x.return_date as string,
          kind: "purchase-return",
          ref: `Purchase Return ${x.return_no ?? ""}`.trim(),
          refId: x.id,
          refTable: "purchase_returns",
          debit: 0,
          credit: Number(x.grand_total),
          notes: x.reason ?? undefined,
        });
      }
      for (const x of sp.data ?? []) {
        list.push({
          date: x.payment_date as string,
          kind: "payment",
          ref: `Payment ${x.payment_no ?? ""} (${x.mode})`.trim(),
          debit: 0,
          credit: Number(x.amount),
        });
      }
      }
      list.sort((a, b) => a.date.localeCompare(b.date));
      return list;
    },
  });

  let running = 0;
  const rows = entries.map((e) => {
    running += e.debit - e.credit;
    return { ...e, balance: running };
  });
  const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = entries.reduce((s, e) => s + e.credit, 0);
  const outstanding = totalDebit - totalCredit;

  // Cash in hand running balance (Dr positive)
  const opening = cashTxns.find((t) => t.txn_type === "opening");
  const cashMovements = cashTxns.filter((t) => t.txn_type !== "opening");
  let cashRunning = opening ? Number(opening.debit) - Number(opening.credit) : 0;
  const cashRows = cashMovements.map((t) => {
    cashRunning += Number(t.debit) - Number(t.credit);
    return { ...t, balance: cashRunning };
  });
  const cashDebit = cashMovements.reduce((s, t) => s + Number(t.debit), 0);
  const cashCredit = cashMovements.reduce((s, t) => s + Number(t.credit), 0);
  const cashOpening = opening ? Number(opening.debit) - Number(opening.credit) : 0;
  const cashClosing = cashOpening + cashDebit - cashCredit;

  return (
    <>
      <PageHeader
        title="Ledger"
        subtitle="Search a customer or supplier to view their full transaction history and outstanding balance."
      />
      <div className="px-8 pb-10 max-w-[1400px] mx-auto w-full grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5">
        {/* Party picker */}
        <Card className="p-4 h-fit lg:sticky lg:top-4">
          <div className="flex flex-wrap rounded-lg border border-input bg-card p-1 w-full mb-3 gap-1">
            {([
              { v: "customer" as const, label: "Customers", icon: Users },
              { v: "supplier" as const, label: "Suppliers", icon: Truck },
              { v: "cash" as const, label: "Cash", icon: Banknote },
            ]).map((t) => {
              const active = kind === t.v;
              const Icon = t.icon;
              return (
                <button
                  key={t.v}
                  onClick={() => { setKind(t.v); setSelected(null); }}
                  className={`flex-1 min-w-[88px] flex items-center justify-center gap-1.5 h-9 px-2 rounded-md text-sm font-medium transition-colors ${
                    active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" /> {t.label}
                </button>
              );
            })}
          </div>
          {accountKind ? (
            <div className="rounded-md bg-muted/40 p-3 text-sm">
              <div className="flex items-center gap-2 font-semibold mb-1">
                <Wallet className="h-4 w-4 text-primary" /> Cash in Hand
              </div>
              <p className="text-xs text-muted-foreground">
                All cash account movements (receipts, cash sales, payments) with a running balance.
              </p>
            </div>
          ) : (
          <>
          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${kind}s…`}
              className="pl-8"
            />
          </div>
          <div className="px-1 pb-2 text-[11px] text-muted-foreground">
            Showing {filtered.length} of {parties.length} {kind}s
          </div>
          <div className="max-h-[60vh] overflow-y-auto -mx-1">
            {filtered.length === 0 && (
              <div className="text-sm text-muted-foreground p-3 text-center">No matches.</div>
            )}
            {filtered.map((p) => {
              const active = selected?.id === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelected(p)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    active ? "bg-primary/10 text-primary font-semibold" : "hover:bg-muted"
                  }`}
                >
                  <div className="truncate">{p.name}</div>
                  {p.phone && <div className="text-[11px] text-muted-foreground">{p.phone}</div>}
                </button>
              );
            })}
          </div>
          </>
          )}
        </Card>

        {/* Ledger view */}
        <div className="space-y-4 min-w-0">
          {kind === "cash" ? (
            <CashLedger
              rows={cashRows}
              loading={cashLoading}
              opening={cashOpening}
              debit={cashDebit}
              credit={cashCredit}
              closing={cashClosing}
            />
          ) : !selected ? (
            <Card className="p-12 text-center text-muted-foreground">
              Select a {kind} from the left to view their ledger.
            </Card>
          ) : (
            <>
              <Card className="p-5 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-xs uppercase text-muted-foreground tracking-wider">{kind}</div>
                  <div className="text-2xl font-bold">{selected.name}</div>
                  {selected.phone && <div className="text-sm text-muted-foreground">{selected.phone}</div>}
                </div>
                <div className="flex gap-4 items-center">
                  <div className="text-right">
                    <div className="text-[11px] uppercase text-muted-foreground">Debit</div>
                    <div className="font-semibold tabular-nums">{inr(totalDebit)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] uppercase text-muted-foreground">Credit</div>
                    <div className="font-semibold tabular-nums">{inr(totalCredit)}</div>
                  </div>
                  <div className="text-right border-l pl-4 ml-2">
                    <div className="text-[11px] uppercase text-muted-foreground">Outstanding</div>
                    <div className={`text-xl font-bold tabular-nums ${outstanding > 0.01 ? "text-destructive" : outstanding < -0.01 ? "text-emerald-600" : ""}`}>
                      {inr(Math.abs(outstanding))}
                      {outstanding > 0.01 && <span className="text-xs ml-1 font-normal">due</span>}
                      {outstanding < -0.01 && <span className="text-xs ml-1 font-normal">advance</span>}
                    </div>
                  </div>
                  {kind === "customer" && (
                    <Button asChild size="sm" className="gap-2">
                      <Link to="/sales/receipts"><ReceiptIcon className="h-4 w-4" /> Receipts</Link>
                    </Button>
                  )}
                </div>
              </Card>

              <Card className="overflow-hidden">
                <div className="px-5 pt-5 pb-3">
                  <h2 className="text-lg font-semibold">Transactions</h2>
                </div>
                {loading ? (
                  <div className="p-8 text-center text-muted-foreground">Loading…</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="text-left p-3 pl-5">Date</th>
                        <th className="text-left p-3">Type</th>
                        <th className="text-left p-3">Reference</th>
                        <th className="text-right p-3">Debit</th>
                        <th className="text-right p-3">Credit</th>
                        <th className="text-right p-3 pr-5">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((e, i) => {
                        const Icon =
                          e.kind === "sale" ? FileText :
                          e.kind === "purchase" ? ShoppingCart :
                          e.kind === "sales-return" || e.kind === "purchase-return" ? RotateCcw :
                          e.kind === "refund-paid" ? Wallet :
                          e.kind === "payment" ? Banknote :
                          ReceiptIcon;
                        const linkProps =
                          e.refId && e.kind === "sale"
                            ? { to: "/sales/$id", params: { id: e.refId } }
                            : e.refId && e.kind === "purchase"
                              ? { to: "/purchases/$id", params: { id: e.refId } }
                              : null;
                        const openReturn = (e.kind === "sales-return" || e.kind === "purchase-return") && e.refId && e.refTable
                          ? () => setReturnView({ id: e.refId!, no: e.ref, refTable: e.refTable! })
                          : null;
                        return (
                          <tr
                            key={i}
                            className={`border-t hover:bg-muted/30 ${openReturn ? "cursor-pointer" : ""}`}
                            onClick={openReturn ?? undefined}
                          >
                            <td className="p-3 pl-5 text-muted-foreground whitespace-nowrap">
                              {fmtDate(e.date)}
                            </td>
                            <td className="p-3">
                              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold capitalize ${
                                e.kind === "sale" ? "bg-blue-500/10 text-blue-600" :
                                e.kind === "purchase" ? "bg-amber-500/10 text-amber-600" :
                                e.kind === "sales-return" ? "bg-rose-500/10 text-rose-600" :
                                e.kind === "purchase-return" ? "bg-orange-500/10 text-orange-600" :
                                e.kind === "refund-paid" ? "bg-muted text-muted-foreground" :
                                e.kind === "payment" ? "bg-amber-500/10 text-amber-600" :
                                "bg-emerald-500/10 text-emerald-600"
                              }`}>
                                <Icon className="h-3 w-3" /> {e.kind}
                              </span>
                            </td>
                            <td className="p-3 font-medium">
                              {linkProps ? (
                                <Link {...(linkProps as any)} className="text-primary hover:underline" onClick={(ev) => ev.stopPropagation()}>
                                  {e.ref}
                                </Link>
                              ) : (
                                e.ref
                              )}
                              {e.notes && <div className="text-[11px] text-muted-foreground">{e.notes}</div>}
                            </td>
                            <td className="p-3 text-right tabular-nums">{e.debit > 0 ? inr(e.debit) : "—"}</td>
                            <td className="p-3 text-right tabular-nums text-emerald-600">{e.credit > 0 ? inr(e.credit) : "—"}</td>
                            <td className={`p-3 pr-5 text-right tabular-nums font-semibold ${e.balance > 0.01 ? "text-destructive" : ""}`}>
                              {inr(e.balance)}
                            </td>
                          </tr>
                        );
                      })}
                      {rows.length === 0 && (
                        <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">No transactions yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                )}
              </Card>
            </>
          )}
        </div>
      </div>
      <ReturnTimelineDialog
        open={!!returnView}
        onOpenChange={(v) => !v && setReturnView(null)}
        returnId={returnView?.id ?? null}
        returnNo={returnView?.no}
        refTable={returnView?.refTable ?? "sales_returns"}
      />
    </>
  );
}

function CashLedger({
  rows,
  loading,
  opening,
  debit,
  credit,
  closing,
}: {
  rows: (CashTxn & { balance: number })[];
  loading: boolean;
  opening: number;
  debit: number;
  credit: number;
  closing: number;
}) {
  return (
    <>
      <Card className="p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase text-muted-foreground tracking-wider">Cash in Hand</div>
          <div className="text-2xl font-bold">Cash Account</div>
          <div className="text-sm text-muted-foreground">
            Opening balance {drcr(opening)}
          </div>
        </div>
        <div className="flex gap-4 items-center">
          <div className="text-right">
            <div className="text-[11px] uppercase text-muted-foreground">Cash In</div>
            <div className="font-semibold tabular-nums text-emerald-600">{inr(debit)}</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase text-muted-foreground">Cash Out</div>
            <div className="font-semibold tabular-nums text-destructive">{inr(credit)}</div>
          </div>
          <div className="text-right border-l pl-4 ml-2">
            <div className="text-[11px] uppercase text-muted-foreground">Closing Balance</div>
            <div className="text-xl font-bold tabular-nums">{drcr(closing)}</div>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="px-5 pt-5 pb-3">
          <h2 className="text-lg font-semibold">Cash Transactions</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left p-3 pl-5">Date</th>
                <th className="text-left p-3">Type</th>
                <th className="text-left p-3">Vch No</th>
                <th className="text-left p-3">Account</th>
                <th className="text-right p-3">Cash In</th>
                <th className="text-right p-3">Cash Out</th>
                <th className="text-right p-3 pr-5">Balance</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t bg-muted/20">
                <td className="p-3 pl-5 text-muted-foreground whitespace-nowrap" colSpan={4}>
                  Opening Balance
                </td>
                <td className="p-3 text-right tabular-nums">—</td>
                <td className="p-3 text-right tabular-nums">—</td>
                <td className="p-3 pr-5 text-right tabular-nums font-semibold">{drcr(opening)}</td>
              </tr>
              {rows.map((e) => {
                const isIn = Number(e.debit) > 0;
                const Icon = isIn ? ArrowDownCircle : ArrowUpCircle;
                return (
                  <tr key={e.id} className="border-t hover:bg-muted/30">
                    <td className="p-3 pl-5 text-muted-foreground whitespace-nowrap">
                      {fmtDate(e.txn_date)}
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold ${TYPE_STYLE[e.txn_type]}`}>
                        <Icon className="h-3 w-3" /> {e.txn_type === "sale" ? "Cash Sale" : TYPE_LABEL[e.txn_type]}
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground">{e.vch_no ?? "—"}</td>
                    <td className="p-3 font-medium">{e.account_name}</td>
                    <td className="p-3 text-right tabular-nums text-emerald-600">{Number(e.debit) > 0 ? inr(Number(e.debit)) : "—"}</td>
                    <td className="p-3 text-right tabular-nums text-destructive">{Number(e.credit) > 0 ? inr(Number(e.credit)) : "—"}</td>
                    <td className="p-3 pr-5 text-right tabular-nums font-semibold">{drcr(e.balance)}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">No cash transactions yet.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}