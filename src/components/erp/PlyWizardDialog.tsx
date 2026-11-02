import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check } from "lucide-react";
import { inr } from "@/lib/codes";

const THICKNESS = ["18 mm", "12 mm", "9 mm", "8 mm", "6 mm", "25 mm Board"] as const;
const BRANDS = ["Applewood Ultra", "Applewood Premium", "Velocity", "Primo Wud"] as const;
const SIZES = ["8*4", "7*4", "7*3", "6*4", "6*3", "8*3"] as const;

// "8*4" -> 32 (sq ft). Falls back to 0 on anything unexpected.
export function sizeArea(size: string): number {
  const [a, b] = size.split("*").map((n) => Number(n.trim()));
  return Number.isFinite(a) && Number.isFinite(b) ? a * b : 0;
}

type Added = { name: string; area: number; rate: number };

// Honey-amber accent gives PLY its own identity, distinct from the blue app chrome.
const ACCENT = "#b26a2b";

/** Stepped PLY picker: thickness -> brand -> size -> rate -> add to cart. Mobile-first. */
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
  const [brand, setBrand] = useState("");
  const [size, setSize] = useState("");
  const [rate, setRate] = useState("");

  const reset = () => { setStep(0); setThickness(""); setBrand(""); setSize(""); setRate(""); };
  const close = () => { onOpenChange(false); reset(); };

  const addToCart = () => {
    const r = Number(rate);
    if (!Number.isFinite(r) || r <= 0) return;
    onAdd({ name: `PLY — ${thickness} — ${brand} — ${size}`, area: sizeArea(size), rate: r });
    close();
  };

  const titles = ["Choose thickness", "Choose brand", "Choose size", "Set rate"];
  const area = sizeArea(size);
  const amount = area * (Number(rate) || 0);
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
            {[0, 1, 2, 3].map((i) => (
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
              {THICKNESS.map((t) => (
                <button key={t} type="button" className={tileClass} onClick={() => { setThickness(t); setStep(1); }}>
                  {t}
                </button>
              ))}
            </div>
          )}

          {step === 1 && (
            <div className="grid grid-cols-2 gap-3">
              {BRANDS.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => { setBrand(b); setStep(2); }}
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
              {SIZES.map((s) => (
                <button key={s} type="button" className={tileClass} onClick={() => { setSize(s); setStep(3); }}>
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
                    onKeyDown={(e) => { if (e.key === "Enter") addToCart(); }}
                    placeholder="0"
                    className="w-full bg-transparent text-2xl font-bold text-slate-900 tabular-nums focus:outline-none"
                  />
                </div>
              </label>

              <div className="flex items-baseline justify-between rounded-2xl bg-[#f6efe7] px-4 py-3">
                <span className="text-sm font-semibold text-slate-600">Amount</span>
                <span className="text-2xl font-extrabold tabular-nums" style={{ color: ACCENT }}>{inr(amount)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Sticky action — only on the final step */}
        {step === 3 && (
          <div className="shrink-0 border-t border-slate-100 bg-white px-5 py-4">
            <Button
              type="button"
              className="h-14 w-full rounded-2xl text-base font-bold text-white shadow-sm disabled:opacity-40"
              style={{ backgroundColor: ACCENT }}
              disabled={!(Number(rate) > 0)}
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
