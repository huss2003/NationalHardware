import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, ChevronRight } from "lucide-react";
import { DiscountStep, QuantityStep, type DiscountMode } from "@/components/erp/WizardSteps";
import { useRootNodeId, useChildren, type InvNode } from "@/lib/inventoryNodes";

type Added = { name: string; amount: number; qty: number };

// Indigo accent — distinct from PLY (amber), MICA (teal), app chrome (blue).
const ACCENT = "#4f46e5";

function effectiveAmount(amount: number, mode: DiscountMode, disc: number): number {
  if (disc <= 0) return amount;
  return Math.max(0, mode === "pct" ? amount * (1 - disc / 100) : amount - disc);
}

/**
 * HARDWARE picker. Drills the Inventory 2 HARDWARE tree to any depth (user-built),
 * then on a leaf node: amount -> quantity -> discount -> add. Mobile-first.
 */
export function HardwareWizardDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAdd: (item: Added) => void;
}) {
  // path = nodes drilled into, under the HARDWARE root. phase: browse tree, then entry.
  const [path, setPath] = useState<InvNode[]>([]);
  const [phase, setPhase] = useState<"browse" | "amount" | "qty" | "disc">("browse");
  const [amount, setAmount] = useState("");
  const [qty, setQty] = useState("1");
  const [discMode, setDiscMode] = useState<DiscountMode>("pct");
  const [disc, setDisc] = useState("");

  const { data: hwRoot } = useRootNodeId("HARDWARE");
  const parentId = path.length ? path[path.length - 1].id : hwRoot;
  const { data: children = [], isLoading } = useChildren(parentId);

  const reset = () => {
    setPath([]); setPhase("browse"); setAmount(""); setQty("1"); setDiscMode("pct"); setDisc("");
  };
  const close = () => { onOpenChange(false); reset(); };

  const amountN = Number(amount) || 0;
  const qtyN = Math.max(1, Number(qty) || 1);
  const discN = Number(disc) || 0;
  const amountEff = effectiveAmount(amountN, discMode, discN);
  const net = qtyN * amountEff;

  // A node with no children is a leaf → price it.
  const pick = (n: InvNode) => setPath((p) => [...p, n]);
  const back = () => {
    if (phase === "amount") { setPath((p) => p.slice(0, -1)); setPhase("browse"); return; }
    if (phase === "qty") { setPhase("amount"); return; }
    if (phase === "disc") { setPhase("qty"); return; }
    setPath((p) => p.slice(0, -1)); // browse: up one level
  };

  // Drilled into a node with no children → it's a leaf, go price it.
  useEffect(() => {
    if (phase === "browse" && path.length > 0 && !isLoading && children.length === 0) setPhase("amount");
  }, [phase, path.length, isLoading, children.length]);

  const leafName = path.length ? path.map((p) => p.name).join(" / ") : "";
  const title =
    phase === "amount" ? "Enter amount" :
    phase === "qty" ? "Quantity" :
    phase === "disc" ? "Discount" :
    path.length ? path[path.length - 1].name : "Choose hardware";

  const canGoBack = phase !== "browse" || path.length > 0;

  const addToCart = () => {
    if (amountN <= 0) return;
    onAdd({ name: `${leafName} (HARDWARE)`, amount: amountEff, qty: qtyN });
    close();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <DialogContent
        style={{ ["--accent" as string]: ACCENT }}
        className="flex max-h-[90vh] w-[calc(100vw-1rem)] max-w-md flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-lg"
      >
        <div className="shrink-0 px-5 pt-5 pb-4">
          <div className="flex items-center gap-2">
            {canGoBack ? (
              <button type="button" aria-label="Back" onClick={back}
                className="-ml-1 rounded-full p-1.5 text-slate-500 hover:bg-slate-100 active:scale-95">
                <ArrowLeft className="h-5 w-5" />
              </button>
            ) : (
              <span className="grid h-8 w-8 place-items-center rounded-full text-sm font-extrabold text-white" style={{ backgroundColor: ACCENT }}>H</span>
            )}
            <DialogTitle className="text-lg font-extrabold tracking-tight text-slate-900">{title}</DialogTitle>
          </div>

          {path.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1 text-xs">
              {path.map((p, i) => (
                <span key={p.id} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="h-3 w-3 text-slate-300" />}
                  <span className="rounded-full bg-[#eef2ff] px-2 py-0.5 font-semibold text-[color:var(--accent)]">{p.name}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto bg-[#f6f7fe] px-5 py-5">
          {phase === "browse" && (
            <div className="grid grid-cols-2 gap-3">
              {isLoading ? (
                <p className="col-span-2 py-6 text-center text-sm text-slate-400">Loading…</p>
              ) : children.length === 0 ? (
                <p className="col-span-2 py-6 text-center text-sm text-slate-400">Nothing here — add hardware items in Inventory 2 → HARDWARE.</p>
              ) : children.map((n) => (
                <button key={n.id} type="button" onClick={() => pick(n)}
                  className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-5 text-left text-base font-bold text-slate-700 shadow-sm transition-all min-h-[64px] active:scale-[0.97] hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]">
                  <span className="truncate">{n.name}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                </button>
              ))}
            </div>
          )}

          {phase === "amount" && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-bold text-slate-800">{leafName}</p>
              </div>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Amount (per piece)</span>
                <div className="flex items-center rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 focus-within:border-[color:var(--accent)]">
                  <span className="mr-2 text-xl font-bold text-slate-400">₹</span>
                  <input type="number" inputMode="numeric" min={0} autoFocus value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && amountN > 0) setPhase("qty"); }}
                    placeholder="0"
                    className="w-full bg-transparent text-2xl font-bold text-slate-900 tabular-nums focus:outline-none" />
                </div>
              </label>
              <Button type="button" className="h-14 w-full rounded-2xl text-base font-bold text-white disabled:opacity-40"
                style={{ backgroundColor: ACCENT }} disabled={!(amountN > 0)} onClick={() => setPhase("qty")}>
                Next
              </Button>
            </div>
          )}

          {phase === "qty" && (
            <QuantityStep accent={ACCENT} perUnitLabel="Per piece" perUnit={amountN} qty={qty} setQty={setQty} onNext={() => setPhase("disc")} />
          )}

          {phase === "disc" && (
            <DiscountStep accent={ACCENT} gross={qtyN * amountN} net={net} qty={qtyN}
              mode={discMode} setMode={setDiscMode} value={disc} setValue={setDisc} />
          )}
        </div>

        {phase === "disc" && (
          <div className="shrink-0 border-t border-slate-100 bg-white px-5 py-4">
            <Button type="button" className="h-14 w-full rounded-2xl text-base font-bold text-white shadow-sm disabled:opacity-40"
              style={{ backgroundColor: ACCENT }} disabled={!(amountN > 0)} onClick={addToCart}>
              <Check className="mr-1.5 h-5 w-5" /> Add to cart
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
