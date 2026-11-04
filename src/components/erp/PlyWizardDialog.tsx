import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check } from "lucide-react";
import { inr } from "@/lib/codes";
import { DiscountStep, QuantityStep, type DiscountMode } from "@/components/erp/WizardSteps";
import { useRootNodeId, useChildren } from "@/lib/inventoryNodes";

// "8*4" -> 32 (sq ft). Falls back to 0 on anything unexpected.
export function sizeArea(size: string): number {
  const [a, b] = size.split("*").map((n) => Number(n.trim()));
  return Number.isFinite(a) && Number.isFinite(b) ? a * b : 0;
}

// Discount baked into an effective per-sq-ft rate so the line stays (qty, rate, area).
// pct: rate*(1-p/100).  per-piece ₹d: rate - d/area  (d is ₹ off each piece).
function effectiveRate(rate: number, area: number, mode: DiscountMode, disc: number): number {
  if (disc <= 0) return rate;
  const r = mode === "pct" ? rate * (1 - disc / 100) : rate - (area > 0 ? disc / area : 0);
  return Math.max(0, r);
}

type Added = { name: string; area: number; rate: number; qty: number };

// Honey-amber accent gives PLY its own identity, distinct from the blue app chrome.
const ACCENT = "#b26a2b";

/** PLY picker: thickness -> brand -> size -> rate -> quantity -> discount -> add. Mobile-first. */
export function PlyWizardDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAdd: (item: Added) => void;
}) {
  const [step, setStep] = useState(0);
  const [thickness, setThickness] = useState("");
  const [thicknessId, setThicknessId] = useState<string | null>(null);
  const [brand, setBrand] = useState("");
  const [brandId, setBrandId] = useState<string | null>(null);
  const [size, setSize] = useState("");
  const [rate, setRate] = useState("");
  const [qty, setQty] = useState("1");
  const [discMode, setDiscMode] = useState<DiscountMode>("pct");
  const [disc, setDisc] = useState("");

  // Live tree from Inventory 2: PLY root -> thickness -> brand -> size.
  const { data: plyRoot } = useRootNodeId("PLY");
  const { data: thicknesses = [] } = useChildren(plyRoot);
  const { data: brands = [] } = useChildren(thicknessId);
  const { data: sizes = [] } = useChildren(brandId);

  const reset = () => {
    setStep(0); setThickness(""); setThicknessId(null); setBrand(""); setBrandId(null);
    setSize(""); setRate(""); setQty("1"); setDiscMode("pct"); setDisc("");
  };
  const close = () => { onOpenChange(false); reset(); };

  const area = sizeArea(size);
  const rateN = Number(rate) || 0;
  const qtyN = Math.max(1, Number(qty) || 1);
  const discN = Number(disc) || 0;
  const rateEff = effectiveRate(rateN, area, discMode, discN);
  const net = qtyN * area * rateEff;

  const addToCart = () => {
    if (rateN <= 0) return;
    onAdd({ name: `PLY — ${thickness} — ${brand} — ${size}`, area, rate: rateEff, qty: qtyN });
    close();
  };

  const titles = ["Choose thickness", "Choose brand", "Choose size", "Set rate", "Quantity", "Discount"];
  const chips = [thickness, brand, size].filter(Boolean);

  const tileClass =
    "flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 py-5 text-base font-bold text-slate-700 shadow-sm transition-all min-h-[64px] active:scale-[0.97] hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]";

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <DialogContent
        style={{ ["--accent" as string]: ACCENT }}
        className="flex max-h-[90vh] w-[calc(100vw-1rem)] max-w-md flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-lg"
      >
        {/* Header: back + title + progress rail + chosen-value breadcrumb */}
        <div className="shrink-0 px-5 pt-5 pb-4">
          <div className="flex items-center gap-2">
            {step > 0 ? (
              <button
                type="button"
                aria-label="Back"
                onClick={() => setStep((s) => s - 1)}
                className="-ml-1 rounded-full p-1.5 text-slate-500 hover:bg-slate-100 active:scale-95"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            ) : (
              <span
                className="grid h-8 w-8 place-items-center rounded-full text-sm font-extrabold text-white"
                style={{ backgroundColor: ACCENT }}
              >
                P
              </span>
            )}
            <DialogTitle className="text-lg font-extrabold tracking-tight text-slate-900">
              {titles[step]}
            </DialogTitle>
          </div>

          <div className="mt-4 flex gap-1.5" aria-hidden>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <span
                key={i}
                className="h-1.5 flex-1 rounded-full transition-colors"
                style={{ backgroundColor: i <= step ? ACCENT : "#e8e2da" }}
              />
            ))}
          </div>

          {chips.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {chips.map((c) => (
                <span
                  key={c}
                  className="rounded-full bg-[#f6efe7] px-2.5 py-1 text-xs font-semibold text-[color:var(--accent)]"
                >
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto bg-[#faf7f3] px-5 py-5">
          {step === 0 && (
            <div className="grid grid-cols-2 gap-3">
              {thicknesses.length === 0 && (
                <p className="col-span-2 py-6 text-center text-sm text-slate-400">No thicknesses yet — add them in Inventory 2 → PLY.</p>
              )}
              {thicknesses.map((t) => (
                <button key={t.id} type="button" className={tileClass} onClick={() => { setThickness(t.name); setThicknessId(t.id); setStep(1); }}>
                  {t.name}
                </button>
              ))}
            </div>
          )}

          {step === 1 && (
            <div className="grid grid-cols-2 gap-3">
              {brands.length === 0 && (
                <p className="col-span-2 py-6 text-center text-sm text-slate-400">No brands under {thickness} — add them in Inventory 2.</p>
              )}
              {brands.map(({ id, name: b }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => { setBrand(b); setBrandId(id); setStep(2); }}
                  className="group flex flex-col gap-2.5 rounded-2xl border border-slate-200 bg-white p-2.5 text-left shadow-sm transition-all active:scale-[0.97] hover:border-[color:var(--accent)]"
                >
                  <img
                    src={`https://placehold.co/280x180?text=${encodeURIComponent(b)}`}
                    alt={b}
                    className="aspect-[3/2] w-full rounded-xl bg-slate-100 object-cover"
                  />
                  <span className="px-1 pb-1 text-sm font-bold text-slate-700 group-hover:text-[color:var(--accent)]">
                    {b}
                  </span>
                </button>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {sizes.length === 0 && (
                <p className="col-span-2 sm:col-span-3 py-6 text-center text-sm text-slate-400">No sizes under {brand} — add them in Inventory 2.</p>
              )}
              {sizes.map(({ id, name: s }) => (
                <button key={id} type="button" className={tileClass} onClick={() => { setSize(s); setStep(3); }}>
                  <span className="flex flex-col items-center leading-tight">
                    {s}
                    <span className="mt-0.5 text-[11px] font-medium text-slate-400">{sizeArea(s)} sq ft</span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-bold text-slate-800">{thickness} · {brand} · {size}</p>
                <p className="mt-0.5 text-xs text-slate-500">{area} sq ft per piece</p>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Rate per sq ft</span>
                <div className="flex items-center rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 focus-within:border-[color:var(--accent)]">
                  <span className="mr-2 text-xl font-bold text-slate-400">₹</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    autoFocus
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && rateN > 0) setStep(4); }}
                    placeholder="0"
                    className="w-full bg-transparent text-2xl font-bold text-slate-900 tabular-nums focus:outline-none"
                  />
                </div>
              </label>

              <div className="flex items-baseline justify-between rounded-2xl bg-[#f6efe7] px-4 py-3">
                <span className="text-sm font-semibold text-slate-600">Per piece</span>
                <span className="text-xl font-extrabold tabular-nums" style={{ color: ACCENT }}>{inr(area * rateN)}</span>
              </div>

              <Button
                type="button"
                className="h-14 w-full rounded-2xl text-base font-bold text-white disabled:opacity-40"
                style={{ backgroundColor: ACCENT }}
                disabled={!(rateN > 0)}
                onClick={() => setStep(4)}
              >
                Next
              </Button>
            </div>
          )}

          {step === 4 && (
            <QuantityStep
              accent={ACCENT}
              perUnitLabel="Per piece"
              perUnit={area * rateN}
              qty={qty}
              setQty={setQty}
              onNext={() => setStep(5)}
            />
          )}

          {step === 5 && (
            <DiscountStep
              accent={ACCENT}
              gross={qtyN * area * rateN}
              net={net}
              qty={qtyN}
              mode={discMode}
              setMode={setDiscMode}
              value={disc}
              setValue={setDisc}
            />
          )}
        </div>

        {/* Sticky action — only on the final (discount) step */}
        {step === 5 && (
          <div className="shrink-0 border-t border-slate-100 bg-white px-5 py-4">
            <Button
              type="button"
              className="h-14 w-full rounded-2xl text-base font-bold text-white shadow-sm disabled:opacity-40"
              style={{ backgroundColor: ACCENT }}
              disabled={!(rateN > 0)}
              onClick={addToCart}
            >
              <Check className="mr-1.5 h-5 w-5" /> Add to cart
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
