import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/erp/PageHeader";
import { inr } from "@/lib/codes";
import { Search, Users, Truck, FileText, ShoppingCart, Receipt as ReceiptIcon } from "lucide-react";

export const Route = createFileRoute("/_app/ledger")({ component: LedgerPage });

type Kind = "customer" | "supplier";
type Party = { id: string; name: string; phone?: string | null };

type Entry = {
  date: string;
  kind: "sale" | "purchase" | "receipt";
  ref: string;
  refId?: string;
  debit: number;   // increases what party owes us (sale) / what we owe (purchase from supplier view = credit)
  credit: number;  // payment received / payment made
  notes?: string;
};

function LedgerPage() {
  const [kind, setKind] = useState<Kind>("customer");
  const [parties, setParties] = useState<Party[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Party | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);

  // load parties on kind change
  useEffect(() => {
    setSelected(null);
    setEntries([]);
    (async () => {
      const table = kind === "customer" ? "customers" : "suppliers";
      const { data } = await supabase.from(table).select("id, name, phone").order("name");
      setParties((data as Party[]) ?? []);
    })();
  }, [kind]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return parties.slice(0, 50);
    return parties.filter((p) =>
      p.name.toLowerCase().includes(q) || (p.phone ?? "").toLowerCase().includes(q),
    ).slice(0, 50);
  }, [parties, search]);

  const loadLedger = async (p: Party) => {
    setSelected(p);
    setLoading(true);
    const list: Entry[] = [];
    if (kind === "customer") {
      const [s, r] = await Promise.all([
        supabase.from("sales")
          .select("id, invoice_no, invoice_date, grand_total, paid_amount, payment_mode, notes")
          .eq("customer_id", p.id).is("deleted_at", null)
          .order("invoice_date", { ascending: true }),
        supabase.from("receipts")
          .select("id, receipt_no, amount, mode, created_at, receipt_type, notes")
          .eq("customer_id", p.id)
          .order("created_at", { ascending: true }),
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
    } else {
      const p_ = await supabase.from("purchases")
        .select("id, bill_no, bill_date, grand_total")
        .eq("supplier_id", p.id).is("deleted_at", null)
        .order("bill_date", { ascending: true });
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
    }
    list.sort((a, b) => a.date.localeCompare(b.date));
    setEntries(list);
    setLoading(false);
  };

  let running = 0;
  const rows = entries.map((e) => {
    running += e.debit - e.credit;
    return { ...e, balance: running };
  });
  const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = entries.reduce((s, e) => s + e.credit, 0);
  const outstanding = totalDebit - totalCredit;

  return (
    <>
      <PageHeader
        title="Ledger"
        subtitle="Search a customer or supplier to view their full transaction history and outstanding balance."
      />
      <div className="px-8 pb-10 max-w-[1400px] mx-auto w-full grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5">
        {/* Party picker */}
        <Card className="p-4 h-fit lg:sticky lg:top-4">
          <div className="inline-flex rounded-lg border border-input bg-card p-1 w-full mb-3">
            {([
              { v: "customer" as const, label: "Customers", icon: Users },
              { v: "supplier" as const, label: "Suppliers", icon: Truck },
            ]).map((t) => {
              const active = kind === t.v;
              const Icon = t.icon;
              return (
                <button
                  key={t.v}
                  onClick={() => setKind(t.v)}
                  className={`flex-1 flex items-center justify-center gap-2 h-9 px-3 rounded-md text-sm font-medium transition-colors ${
                    active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" /> {t.label}
                </button>
              );
            })}
          </div>
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
          <div className="max-h-[60vh] overflow-y-auto -mx-1">
            {filtered.length === 0 && (
              <div className="text-sm text-muted-foreground p-3 text-center">No matches.</div>
            )}
            {filtered.map((p) => {
              const active = selected?.id === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => loadLedger(p)}
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
        </Card>

        {/* Ledger view */}
        <div className="space-y-4 min-w-0">
          {!selected ? (
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
                        const Icon = e.kind === "sale" ? FileText : e.kind === "purchase" ? ShoppingCart : ReceiptIcon;
                        const linkTo =
                          e.refId && e.kind === "sale" ? `/sales/${e.refId}` :
                          e.refId && e.kind === "purchase" ? `/purchases/${e.refId}` :
                          null;
                        return (
                          <tr key={i} className="border-t hover:bg-muted/30">
                            <td className="p-3 pl-5 text-muted-foreground whitespace-nowrap">
                              {new Date(e.date).toLocaleDateString()}
                            </td>
                            <td className="p-3">
                              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold capitalize ${
                                e.kind === "sale" ? "bg-blue-500/10 text-blue-600" :
                                e.kind === "purchase" ? "bg-amber-500/10 text-amber-600" :
                                "bg-emerald-500/10 text-emerald-600"
                              }`}>
                                <Icon className="h-3 w-3" /> {e.kind}
                              </span>
                            </td>
                            <td className="p-3 font-medium">
                              {linkTo ? (
                                <Link to={linkTo} className="text-primary hover:underline">
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
    </>
  );
}