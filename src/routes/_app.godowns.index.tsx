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
import {
  Plus, Warehouse, Boxes, Package,
} from "lucide-react";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { GodownStockInDialog } from "@/components/erp/GodownStockInDialog";
import { GodownStockOutDialog } from "@/components/erp/GodownStockOutDialog";

export const Route = createFileRoute("/_app/godowns/")({ component: Godowns });

type Godown = {
  id: string; name: string; code: string | null; address: string | null;
  manager_name: string | null; phone: string | null; active: boolean;
};

function Godowns() {
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [instances, setInstances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("all");
  const [stockIn, setStockIn] = useState<{ id: string; name: string } | null>(null);
  const [stockOut, setStockOut] = useState<{ id: string; name: string } | null>(null);

  const reload = async () => {
    setLoading(true);
    const [g, ii] = await Promise.all([
      supabase.from("godowns").select("*").order("name"),
      supabase
        .from("item_instances")
        .select("id, status, cost_price, godown_id, product_id, products(name, sku, image_url)")
        .eq("status", "available")
        .limit(2000),
    ]);
    setGodowns(g.data ?? []);
    setInstances(ii.data ?? []);
    setLoading(false);
  };
  useEffect(() => { reload(); }, []);

  const byGodown = useMemo(() => {
    const map = new Map<string, { count: number; value: number }>();
    instances.forEach((i) => {
      const key = i.godown_id ?? "_none";
      const prev = map.get(key) ?? { count: 0, value: 0 };
      prev.count += 1;
      prev.value += Number(i.cost_price ?? 0);
      map.set(key, prev);
    });
    return map;
  }, [instances]);

  const totals = useMemo(() => {
    const totalUnits = instances.length;
    const totalValue = instances.reduce((s, i) => s + Number(i.cost_price ?? 0), 0);
    return { totalUnits, totalValue, godownCount: godowns.length };
  }, [instances, godowns]);

  const filteredInstances = useMemo(() => {
    if (selectedId === "all") return instances;
    if (selectedId === "_none") return instances.filter((i) => !i.godown_id);
    return instances.filter((i) => i.godown_id === selectedId);
  }, [selectedId, instances]);

  // Aggregate by product for the selected godown
  const productRows = useMemo(() => {
    const m = new Map<string, { name: string; sku: string | null; qty: number; value: number }>();
    filteredInstances.forEach((i) => {
      const k = i.product_id;
      const prev = m.get(k) ?? {
        name: i.products?.name ?? "—",
        sku: i.products?.sku ?? null,
        qty: 0, value: 0,
      };
      prev.qty += 1;
      prev.value += Number(i.cost_price ?? 0);
      m.set(k, prev);
    });
    return Array.from(m.values()).sort((a, b) => b.qty - a.qty);
  }, [filteredInstances]);

  return (
    <>
      <PageHeader
        title="Godown Inventory"
        subtitle="Manage warehouses and stock allocation across locations."
        actions={
          <div className="flex items-center gap-2">
            {selectedId !== "all" && selectedId !== "_none" && (() => {
              const g = godowns.find((x) => x.id === selectedId);
              if (!g) return null;
              return (
                <>
                  <Button size="sm" variant="outline" className="gap-2"
                    onClick={() => setStockIn({ id: g.id, name: g.name })}>
                    <ArrowDownToLine className="h-4 w-4" /> Stock In
                  </Button>
                  <Button size="sm" variant="outline" className="gap-2"
                    onClick={() => setStockOut({ id: g.id, name: g.name })}>
                    <ArrowUpFromLine className="h-4 w-4" /> Stock Out
                  </Button>
                </>
              );
            })()}
            <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" /> New Godown
              </Button>
            </DialogTrigger>
            <NewGodownDialog
              onClose={() => setOpen(false)}
              onSaved={() => { setOpen(false); reload(); }}
            />
            </Dialog>
          </div>
        }
      />
      <div className="px-8 pb-10 max-w-[1400px] mx-auto w-full space-y-5">
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
          <KpiCard icon={Warehouse} iconBg="bg-primary/10 text-primary"
            label="Godowns" value={String(totals.godownCount)} hint="Active locations" />
          <KpiCard icon={Boxes} iconBg="bg-success/10 text-success"
            label="Total Units" value={String(totals.totalUnits)} hint="In available stock" />
          <KpiCard icon={Package} iconBg="bg-primary/10 text-primary"
            label="Stock Value" value={inr(totals.totalValue)} hint="Across all godowns" />
        </div>

        {/* Stock table */}
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-3">
            <h2 className="text-lg font-semibold tracking-tight">Stock by location</h2>
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm font-medium min-w-[220px]"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              <option value="all">All Locations ({instances.length})</option>
              {godowns.map((g) => {
                const stats = byGodown.get(g.id) ?? { count: 0, value: 0 };
                return (
                  <option key={g.id} value={g.id}>
                    {g.name} ({stats.count})
                  </option>
                );
              })}
              {(byGodown.get("_none")?.count ?? 0) > 0 && (
                <option value="_none">Unassigned ({byGodown.get("_none")?.count ?? 0})</option>
              )}
            </select>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Units</TableHead>
                <TableHead className="text-right pr-5">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={4} className="p-0">
                  <TableSkeleton rows={5} columns={4} showHeader={false} />
                </TableCell></TableRow>
              )}
              {!loading && productRows.map((p, i) => (
                <TableRow key={i}>
                  <TableCell className="pl-5 font-medium">{p.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {p.sku ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{p.qty}</TableCell>
                  <TableCell className="text-right pr-5 font-semibold tabular-nums">
                    {inr(p.value)}
                  </TableCell>
                </TableRow>
              ))}
              {!loading && productRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-14 text-muted-foreground">
                    <Boxes className="h-7 w-7 mx-auto mb-2 opacity-50" />
                    No stock in this location yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
      {stockIn && (
        <GodownStockInDialog
          open={!!stockIn}
          onOpenChange={(v) => { if (!v) setStockIn(null); }}
          godownId={stockIn.id}
          godownName={stockIn.name}
          onDone={reload}
        />
      )}
      {stockOut && (
        <GodownStockOutDialog
          open={!!stockOut}
          onOpenChange={(v) => { if (!v) setStockOut(null); }}
          godownId={stockOut.id}
          godownName={stockOut.name}
          onDone={reload}
        />
      )}
    </>
  );
}

function GodownTile({
  name, code, manager, address, active, count, value, onClick,
}: {
  name: string; code: string; manager?: string; address?: string;
  active?: boolean; count: number; value: number; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-2xl border bg-card transition-all hover:shadow-sm ${
        active
          ? "border-primary ring-1 ring-primary/30 shadow-sm"
          : "border-border/60"
      }`}
    >
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary grid place-items-center">
            <Warehouse className="h-4 w-4" />
          </div>
          <span className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
            {code}
          </span>
        </div>
        <div className="text-base font-semibold text-foreground truncate">{name}</div>
        {manager && (
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <Building2 className="h-3 w-3" /> {manager}
          </div>
        )}
        {address && (
          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 truncate">
            <MapPin className="h-3 w-3 shrink-0" /> <span className="truncate">{address}</span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-border/60">
          <div>
            <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Units</div>
            <div className="text-lg font-semibold tabular-nums">{count}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Value</div>
            <div className="text-lg font-semibold tabular-nums">{inr(value)}</div>
          </div>
        </div>
      </div>
    </button>
  );
}

function NewGodownDialog({
  onClose, onSaved,
}: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [manager, setManager] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!name.trim()) { toast.error("Name is required"); return; }
    setBusy(true);
    const { error } = await supabase.from("godowns").insert({
      name: name.trim(),
      code: code.trim() || null,
      address: address.trim() || null,
      manager_name: manager.trim() || null,
      phone: phone.trim() || null,
      active: true,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Godown created");
    onSaved();
  };

  return (
    <DialogContent className="sm:max-w-[480px]">
      <DialogHeader><DialogTitle>New Godown</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Name</label>
            <Input className="h-10" placeholder="Main Warehouse" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Code</label>
            <Input className="h-10" placeholder="MAIN" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Address</label>
          <Input className="h-10" placeholder="Plot 12, Industrial Area" value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Manager</label>
            <Input className="h-10" placeholder="Rakesh Kumar" value={manager} onChange={(e) => setManager(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Phone</label>
            <Input className="h-10" placeholder="+91 …" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Create Godown"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function KpiCard({
  icon: Icon, iconBg, label, value, hint,
}: {
  icon: any; iconBg: string; label: string; value: string; hint: React.ReactNode;
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
      <div className="text-xs mt-3 text-muted-foreground inline-flex items-center gap-1">
        {hint}
      </div>
    </Card>
  );
}