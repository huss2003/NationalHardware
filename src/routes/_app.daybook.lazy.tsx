import { createLazyFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { inr } from "@/lib/codes";
import { Plus, Wallet, Landmark, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createLazyFileRoute("/_app/daybook")({ component: DayBook });

type Account = "cash" | "bank";
type Txn = { id: string; txn_type: string; vch_no: string | null; account_name: string; narration: string | null; debit: number; credit: number };

const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function DayBook() {
  const qc = useQueryClient();
  const [date, setDate] = useState(todayLocal());
  const [account, setAccount] = useState<Account>("cash");
  const [expOpen, setExpOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: summary } = useQuery({
    queryKey: ["daybook", "summary", account, date],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("daybook_summary", { _account: account, _date: date });
      if (error) throw error;
      const r = (Array.isArray(data) ? data[0] : data) ?? { opening: 0, cash_in: 0, cash_out: 0 };
      return { opening: Number(r.opening), cashIn: Number(r.cash_in), cashOut: Number(r.cash_out) };
    },
  });

  const { data: txns = [] } = useQuery({
    queryKey: ["daybook", "txns", account, date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_transactions")
        .select("id, txn_type, vch_no, account_name, narration, debit, credit")
        .eq("ledger_account", account).eq("txn_date", date)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as Txn[]) ?? [];
    },
  });

  const opening = summary?.opening ?? 0;
  const cashIn = summary?.cashIn ?? 0;
  const cashOut = summary?.cashOut ?? 0;
  const closing = opening + cashIn - cashOut;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["daybook", "summary", account, date] });
    qc.invalidateQueries({ queryKey: ["daybook", "txns", account, date] });
  };

  const addExpense = async () => {
    const a = Number(amount);
    if (!Number.isFinite(a) || a <= 0) { toast.error("Enter an amount"); return; }
    setBusy(true);
    const { error } = await supabase.from("cash_transactions").insert({
      txn_date: date, txn_type: "expense", account_name: note.trim() || "Expense",
      narration: note.trim() || null, debit: 0, credit: a, ledger_account: "cash", source: "app_expense",
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Expense added");
    setExpOpen(false); setAmount(""); setNote("");
    refresh();
  };

  const accentFor = account === "cash" ? "#3b82f6" : "#7c3aed";

  return (
    <>
      <PageHeader title="Day-book" />
      <div className="mx-auto max-w-4xl px-3 sm:px-6 pb-24 space-y-4">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-auto" />
          <div className="flex rounded-lg border border-[#e8ecf1] bg-white p-1">
            {([["cash", "Cash", Wallet], ["bank", "Bank", Landmark]] as const).map(([v, lbl, Icon]) => (
              <button
                key={v}
                type="button"
                onClick={() => setAccount(v)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-bold transition-colors ${
                  account === v ? "bg-[#3b82f6] text-white" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <Icon className="h-4 w-4" /> {lbl}
              </button>
            ))}
          </div>
          {account === "cash" && (
            <Button size="sm" variant="outline" className="ml-auto gap-1.5" onClick={() => setExpOpen(true)}>
              <Plus className="h-4 w-4" /> Add expense
            </Button>
          )}
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Opening" value={opening} />
          <Stat label="Cash in" value={cashIn} tone="in" />
          <Stat label="Cash out" value={cashOut} tone="out" />
          <Stat label={account === "cash" ? "Closing (in hand)" : "Closing (bank)"} value={closing} accent={accentFor} />
        </div>

        {/* Transactions */}
        <div className="overflow-hidden rounded-2xl border border-[#e8ecf1] bg-white shadow-sm">
          <div className="grid grid-cols-[1fr_auto_auto] gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
            <span>Particulars</span><span className="text-right">In</span><span className="text-right">Out</span>
          </div>
          {txns.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">No {account} transactions on this day.</div>
          ) : txns.map((t) => (
            <div key={t.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 border-b border-slate-50 px-4 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-700">{t.account_name || t.txn_type}</p>
                <p className="truncate text-xs text-slate-400">
                  <span className="capitalize">{t.txn_type}</span>{t.vch_no ? ` · ${t.vch_no}` : ""}{t.narration ? ` · ${t.narration}` : ""}
                </p>
              </div>
              <span className="w-20 text-right font-bold tabular-nums text-emerald-600">{Number(t.debit) ? inr(Number(t.debit)) : "—"}</span>
              <span className="w-20 text-right font-bold tabular-nums text-amber-600">{Number(t.credit) ? inr(Number(t.credit)) : "—"}</span>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={expOpen} onOpenChange={(v) => !v && setExpOpen(false)}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-sm rounded-2xl">
          <DialogTitle>Add cash expense</DialogTitle>
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">Amount</span>
              <Input type="number" min={0} autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0"
                onKeyDown={(e) => { if (e.key === "Enter") addExpense(); }} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">Note <span className="font-normal text-slate-400">(optional)</span></span>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Tea, transport, labour" />
            </label>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setExpOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={addExpense} disabled={busy}>{busy ? "Saving…" : "Add expense"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Stat({ label, value, tone, accent }: { label: string; value: number; tone?: "in" | "out"; accent?: string }) {
  const color = accent ?? (tone === "in" ? "#059669" : tone === "out" ? "#d97706" : "#0f172a");
  return (
    <div className="rounded-2xl border border-[#e8ecf1] bg-white p-3 shadow-sm">
      <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
        {tone === "in" && <ArrowDownLeft className="h-3 w-3 text-emerald-500" />}
        {tone === "out" && <ArrowUpRight className="h-3 w-3 text-amber-500" />}
        {label}
      </div>
      <p className="mt-1 text-lg font-extrabold tabular-nums" style={{ color }}>{inr(value)}</p>
    </div>
  );
}
