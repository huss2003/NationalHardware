import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/erp/PageHeader";
import { DetailSkeleton, TableSkeleton } from "@/components/erp/Skeletons";
import { StatusPill } from "@/components/erp/StatusPill";
import { inr, makeBarcodeDataUrl, makeQrDataUrl, fmtDateTime } from "@/lib/codes";
import { useAuth } from "@/lib/auth-store";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/units/$itemId")({ component: UnitPage });

// Module-level in-memory cache: itemId -> history rows
const historyCache = new Map<string, any[]>();

function UnitPage() {
  const { itemId } = Route.useParams();
  const user = useAuth(s => s.user);
  const [item, setItem] = useState<any>(null);
  const [product, setProduct] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [bar, setBar] = useState(""); const [qr, setQr] = useState("");

  const load = useCallback(async () => {
    const { data: i } = await supabase.from("item_instances").select("*").eq("id", itemId).single();
    setItem(i);
    if (i) {
      // Fetch product + labels in parallel; skip history until timeline is opened
      const [{ data: p }, b, q] = await Promise.all([
        supabase.from("products").select("*").eq("id", i.product_id).single(),
        makeBarcodeDataUrl(i.id),
        makeQrDataUrl(i.id),
      ]);
      setProduct(p);
      setBar(b);
      setQr(q);
    }
  }, [itemId]);
  useEffect(() => { load(); }, [load]);

  const loadHistory = useCallback(async () => {
    if (historyLoaded || historyLoading) return;
    const cached = historyCache.get(itemId);
    if (cached) {
      setHistory(cached);
      setHistoryLoaded(true);
      return;
    }
    setHistoryLoading(true);
    const { data: h } = await supabase
      .from("item_history")
      .select("id,event,created_at,notes")
      .eq("item_id", itemId)
      .order("created_at", { ascending: false })
      .limit(100);
    const rows = h ?? [];
    historyCache.set(itemId, rows);
    setHistory(rows);
    setHistoryLoaded(true);
    setHistoryLoading(false);
  }, [itemId, historyLoaded, historyLoading]);

  const toggleHistory = () => {
    const next = !historyOpen;
    setHistoryOpen(next);
    if (next) loadHistory();
  };

  if (!item) return (<div className="p-8 max-w-[1400px] mx-auto space-y-4"><DetailSkeleton rows={3} /><TableSkeleton rows={5} columns={5} /></div>);

  const prefix = (product?.prefix ?? "").toUpperCase();
  const isPly = prefix === "PLY" || product?.category === "plywood";
  const isDoor = prefix === "DOR" || product?.category === "door";
  const hasDims = isPly || isDoor;
  const dimUnit = item.dimension_unit ?? (isPly ? "feet" : isDoor ? "inches" : "");

  const damage = async () => {
    const reason = prompt("Reason for damage?") ?? "";
    const { error } = await supabase.rpc("mark_damaged", { _item_id: itemId, _reason: reason, _actor_user_id: user?.id ?? "" });
    if (error) toast.error(error.message); else { toast.success("Marked damaged"); load(); }
  };

  return (
    <>
      <PageHeader title={item.id} subtitle={product?.name} actions={<StatusPill status={item.status} />} />
      <div className="px-4 sm:px-6 lg:px-8 pb-8 grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="p-5 lg:col-span-2 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div><div className="text-xs text-muted-foreground">Cost</div><div className="text-xl font-bold">{inr(item.cost_price)}</div></div>
            <div><div className="text-xs text-muted-foreground">Default unit</div><div className="text-xl font-bold">1 pc</div></div>
            {hasDims && (
              <>
                <div>
                  <div className="text-xs text-muted-foreground">L × W ({dimUnit})</div>
                  <div className="text-xl font-bold">
                    {item.length_value && item.width_value
                      ? `${item.length_value} × ${item.width_value}`
                      : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Area (sqft)</div>
                  <div className="text-xl font-bold">
                    {item.area_sqft != null ? Number(item.area_sqft).toFixed(2) : "—"}
                  </div>
                </div>
              </>
            )}
            <div className="md:col-span-2"><div className="text-xs text-muted-foreground">Created</div><div className="text-base font-bold">{fmtDateTime(item.created_at)}</div></div>
          </div>
          {hasDims && (
            <div className="text-xs text-muted-foreground">
              Formula: <code className="font-mono">{isPly ? "L × W (feet)" : "L × W ÷ 144 (inches)"}</code>
            </div>
          )}
          <div className="flex gap-2">
            {item.status === "available" && <Button variant="destructive" onClick={damage}>Mark damaged</Button>}
          </div>
          <div>
            <button
              onClick={toggleHistory}
              className="w-full flex items-center justify-between font-bold mb-2 py-2 hover:text-primary transition-colors"
              aria-expanded={historyOpen}
            >
              <span>Timeline {historyLoaded && `(${history.length})`}</span>
              <span className="text-xs text-muted-foreground">{historyOpen ? "Hide ▲" : "Show ▼"}</span>
            </button>
            {historyOpen && (
              <>
                {historyLoading && (
                  <div className="space-y-3 pl-5">
                    {[0,1,2].map(k => (
                      <div key={k} className="space-y-2">
                        <div className="h-3 w-24 bg-muted rounded animate-pulse" />
                        <div className="h-2 w-40 bg-muted/60 rounded animate-pulse" />
                      </div>
                    ))}
                  </div>
                )}
                {!historyLoading && (
                  <ol className="relative border-l-2 border-primary/30 ml-2 space-y-4 pl-5">
                    {history.length === 0 && <li className="text-sm text-muted-foreground">No history yet.</li>}
                    {history.map((h) => (
                      <li key={h.id} className="relative">
                        <span className="absolute -left-[27px] top-1 h-4 w-4 rounded-full bg-primary"></span>
                        <div className="font-bold uppercase text-sm">{h.event.replace("_"," ")}</div>
                        <div className="text-xs text-muted-foreground">{fmtDateTime(h.created_at)}{h.notes ? ` • ${h.notes}` : ""}</div>
                      </li>
                    ))}
                  </ol>
                )}
              </>
            )}
          </div>
        </Card>
        <Card className="p-5 text-center">
          <div className="text-xs uppercase text-muted-foreground">Label preview</div>
          <div className="font-bold mt-1 text-lg">{product?.name}</div>
          <div className="font-mono mt-2">{item.id}</div>
          {bar && <img src={bar} alt="barcode" className="mx-auto my-3 w-48" />}
          {qr && <img src={qr} alt="qr" className="mx-auto w-40" />}
        </Card>
      </div>
    </>
  );
}
