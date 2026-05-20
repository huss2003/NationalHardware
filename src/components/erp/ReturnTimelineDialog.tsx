import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  PackageCheck, Undo2, MoveRight, ShoppingCart, Wrench, AlertTriangle, History,
} from "lucide-react";

type Ev = {
  id: number;
  item_id: string;
  event: string;
  ref_table: string | null;
  ref_id: string | null;
  notes: string | null;
  created_at: string;
};

const EVENT_META: Record<string, { label: string; icon: any; cls: string }> = {
  purchased:           { label: "PURCHASED",   icon: PackageCheck, cls: "bg-success/15 text-success" },
  sold:                { label: "SOLD",        icon: ShoppingCart, cls: "bg-primary/15 text-primary" },
  returned:            { label: "RETURNED",    icon: Undo2,        cls: "bg-warning/15 text-warning" },
  moved:               { label: "MOVED",       icon: MoveRight,    cls: "bg-accent/40 text-foreground" },
  damaged:             { label: "DAMAGED",     icon: AlertTriangle,cls: "bg-destructive/15 text-destructive" },
  used_in_production:  { label: "USED",        icon: Wrench,       cls: "bg-muted text-foreground" },
};

export function ReturnTimelineDialog({
  open, onOpenChange, returnId, returnNo, refTable,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  returnId: string | null;
  returnNo?: string | null;
  refTable: "sales_returns" | "purchase_returns";
}) {
  const [loading, setLoading] = useState(false);
  const [itemIds, setItemIds] = useState<string[]>([]);
  const [events, setEvents] = useState<Ev[]>([]);

  useEffect(() => {
    if (!open || !returnId) return;
    (async () => {
      setLoading(true);
      const itemsTable = refTable === "sales_returns" ? "sales_return_items" : "purchase_return_items";
      const { data: lines } = await supabase
        .from(itemsTable as any)
        .select("item_instance_id")
        .eq("return_id", returnId);
      const ids = (lines ?? [])
        .map((l: any) => l.item_instance_id)
        .filter(Boolean) as string[];
      setItemIds(ids);
      if (ids.length === 0) {
        setEvents([]); setLoading(false); return;
      }
      const { data: hist } = await supabase
        .from("item_history")
        .select("*")
        .in("item_id", ids)
        .order("created_at", { ascending: true });
      setEvents((hist ?? []) as Ev[]);
      setLoading(false);
    })();
  }, [open, returnId, refTable]);

  const grouped = itemIds.map((id) => ({
    id,
    events: events.filter((e) => e.item_id === id),
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" /> Item Timeline · {returnNo ?? "Return"}
          </DialogTitle>
        </DialogHeader>
        {loading && <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div>}
        {!loading && grouped.length === 0 && (
          <div className="text-sm text-muted-foreground py-10 text-center">
            No scanned items recorded against this return.
          </div>
        )}
        <div className="space-y-6">
          {grouped.map((g) => (
            <div key={g.id}>
              <div className="text-xs font-mono font-semibold mb-3 px-2 py-1 rounded bg-muted inline-block">
                {g.id}
              </div>
              <ol className="relative border-l border-border ml-3 space-y-3">
                {g.events.map((e) => {
                  const meta = EVENT_META[e.event] ?? { label: e.event.toUpperCase(), icon: History, cls: "bg-muted text-foreground" };
                  const Icon = meta.icon;
                  return (
                    <li key={e.id} className="ml-5">
                      <span className={`absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-background ${meta.cls}`}>
                        <Icon className="h-3 w-3" />
                      </span>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-semibold tracking-wider px-2 py-0.5 rounded ${meta.cls}`}>
                          {meta.label}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(e.created_at).toLocaleString("en", { dateStyle: "medium", timeStyle: "short" })}
                        </span>
                      </div>
                      {(e.notes || e.ref_table) && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {e.notes ?? `${e.ref_table} · ${e.ref_id?.slice(0, 8)}`}
                        </div>
                      )}
                    </li>
                  );
                })}
                {g.events.length === 0 && (
                  <li className="ml-5 text-xs text-muted-foreground">No history events.</li>
                )}
              </ol>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}