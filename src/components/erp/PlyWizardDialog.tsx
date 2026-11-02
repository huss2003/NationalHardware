import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft } from "lucide-react";
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

/** Stepped PLY picker: thickness -> brand -> size -> rate -> add to cart. */
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

  const reset = () => {
    setStep(0); setThickness(""); setBrand(""); setSize(""); setRate("");
  };
  const close = () => { onOpenChange(false); reset(); };

  const addToCart = () => {
    const r = Number(rate);
    if (!Number.isFinite(r) || r <= 0) return;
    const area = sizeArea(size);
    onAdd({ name: `PLY — ${thickness} — ${brand} — ${size}`, area, rate: r });
    close();
  };

  const titles = ["Select thickness", "Select brand", "Select size", "Enter rate"];
  const area = sizeArea(size);
  const amount = area * (Number(rate) || 0);

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step > 0 && (
              <button
                type="button"
                aria-label="Back"
                onClick={() => setStep((s) => s - 1)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            {titles[step]}
          </DialogTitle>
        </DialogHeader>

        {step === 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {THICKNESS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => { setThickness(t); setStep(1); }}
                className="rounded-xl border border-[#e8ecf1] bg-white p-6 text-lg font-bold text-slate-700 shadow-sm transition-all hover:border-[#3b82f6] hover:text-[#3b82f6] hover:shadow-md active:scale-[0.98]"
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {step === 1 && (
          <div className="grid grid-cols-2 gap-4">
            {BRANDS.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => { setBrand(b); setStep(2); }}
                className="group flex flex-col items-center gap-3 rounded-xl border border-[#e8ecf1] bg-white p-4 shadow-sm transition-all hover:border-[#3b82f6] hover:shadow-md active:scale-[0.98]"
              >
                <img
                  src={`https://placehold.co/280x160?text=${encodeURIComponent(b)}`}
                  alt={b}
                  className="h-28 w-full rounded-lg bg-slate-100 object-cover"
                />
                <span className="text-base font-bold text-slate-700 group-hover:text-[#3b82f6]">{b}</span>
              </button>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {SIZES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => { setSize(s); setStep(3); }}
                className="rounded-xl border border-[#e8ecf1] bg-white p-6 text-lg font-bold text-slate-700 shadow-sm transition-all hover:border-[#3b82f6] hover:text-[#3b82f6] hover:shadow-md active:scale-[0.98]"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="text-sm text-slate-500">
              {thickness} · {brand} · {size} <span className="text-slate-400">({area} sq ft)</span>
            </div>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              autoFocus
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addToCart(); }}
              placeholder="Enter rate"
            />
            <div className="text-right text-sm">
              Amount: <span className="font-bold text-slate-800">{inr(amount)}</span>
            </div>
            <Button type="button" className="w-full h-11" disabled={!(Number(rate) > 0)} onClick={addToCart}>
              Add to cart
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
