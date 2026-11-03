import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { QuickCreatePartyDialog, type PartyRow } from "@/components/erp/QuickCreatePartyDialog";
import { Search, Plus, Pencil, Trash2, BookOpen, Users, Truck } from "lucide-react";
import { toast } from "sonner";

export const Route = createLazyFileRoute("/_app/parties")({ component: Parties });

type Kind = "customer" | "supplier";

function Parties() {
  const qc = useQueryClient();
  const [kind, setKind] = useState<Kind>("customer");
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<null | { mode: "add" } | { mode: "edit"; row: PartyRow }>(null);
  const [deleting, setDeleting] = useState<PartyRow | null>(null);
  const [busy, setBusy] = useState(false);

  const table = kind === "customer" ? "customers" : "suppliers";

  const { data: rows = [], isFetching } = useQuery({
    queryKey: ["parties", kind],
    queryFn: async () => {
      const { data, error } = await supabase.from(table).select("id, name, phone, gstin, address, state").order("name");
      if (error) throw error;
      return (data as PartyRow[]) ?? [];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      r.name.toLowerCase().includes(q) ||
      (r.phone ?? "").toLowerCase().includes(q) ||
      (r.gstin ?? "").toLowerCase().includes(q));
  }, [rows, search]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["parties", kind] });

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    const { error } = await supabase.from(table).delete().eq("id", deleting.id);
    setBusy(false);
    if (error) {
      // FK violation => party has bills/transactions
      toast.error(/foreign key|violates/i.test(error.message)
        ? `Can't delete — this ${kind} has bills or transactions.`
        : error.message);
      return;
    }
    toast.success(`${kind === "customer" ? "Customer" : "Supplier"} deleted`);
    setDeleting(null);
    refresh();
  };

  return (
    <>
      <PageHeader title="Parties" />
      <div className="mx-auto max-w-5xl px-4 sm:px-6 pb-12 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-[#e8ecf1] bg-white p-1">
            {([["customer", "Customers", Users], ["supplier", "Suppliers", Truck]] as const).map(([v, lbl, Icon]) => (
              <button
                key={v}
                type="button"
                onClick={() => setKind(v)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-bold transition-colors ${
                  kind === v ? "bg-[#3b82f6] text-white" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <Icon className="h-4 w-4" /> {lbl}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name / phone / GSTIN" className="w-64 pl-8" />
          </div>
          <Button className="ml-auto gap-2" onClick={() => setDialog({ mode: "add" })}>
            <Plus className="h-4 w-4" /> Add {kind}
          </Button>
        </div>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="p-3 pl-4 text-left">Name</th>
                  <th className="p-3 text-left">Phone</th>
                  <th className="p-3 text-left">GSTIN</th>
                  <th className="p-3 text-left">State</th>
                  <th className="p-3 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isFetching ? (
                  <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Loading…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No {kind}s found.</td></tr>
                ) : filtered.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-muted/20">
                    <td className="p-3 pl-4 font-medium text-slate-700">{r.name}</td>
                    <td className="p-3 text-slate-500">{r.phone || "—"}</td>
                    <td className="p-3 font-mono text-xs text-slate-500">{r.gstin || "—"}</td>
                    <td className="p-3 text-slate-500">{r.state || "—"}</td>
                    <td className="p-3 pr-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button asChild variant="ghost" size="icon" className="h-8 w-8" title="Open ledger">
                          <Link to="/ledger"><BookOpen className="h-4 w-4" /></Link>
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit" onClick={() => setDialog({ mode: "edit", row: r })}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-red-500" title="Delete" onClick={() => setDeleting(r)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <p className="text-xs text-muted-foreground">{filtered.length} {kind}(s). A party with existing bills can't be deleted — edit it instead.</p>
      </div>

      <QuickCreatePartyDialog
        open={dialog !== null}
        onOpenChange={(v) => !v && setDialog(null)}
        kind={kind}
        editRow={dialog?.mode === "edit" ? dialog.row : null}
        onCreated={() => { setDialog(null); refresh(); }}
      />

      <Dialog open={deleting !== null} onOpenChange={(v) => !v && setDeleting(null)}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-sm rounded-2xl">
          <DialogTitle>Delete “{deleting?.name}”?</DialogTitle>
          <p className="text-sm text-slate-500">This permanently removes the {kind}. It can’t be undone. A {kind} with bills can’t be deleted.</p>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={busy}>Cancel</Button>
            <Button className="bg-red-500 hover:bg-red-600" onClick={confirmDelete} disabled={busy}>{busy ? "Deleting…" : "Delete"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
