import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check } from "lucide-react";
import { inr } from "@/lib/codes";
import { DiscountStep, QuantityStep, type DiscountMode } from "@/components/erp/WizardSteps";

const CATEGORIES = ["National old", "National Digital", "National Premium", "Lami Décor"] as const;

type Added = { name: string; amount: number; qty: number };

// Teal accent gives MICA its own identity, distinct from PLY (amber) and the blue app chrome.
const ACCENT = "#0f766e";

// Discount baked into an effective per-piece amount. pct: amt*(1-p/100). per-piece ₹d: amt - d.
function effectiveAmount(amount: number, mode: DiscountMode, disc: number): number {
  if (disc <= 0) return amount;
  return Math.max(0, mode === "pct" ? amount * (1 - disc / 100) : amount - disc);
}

/** MICA picker: category -> mica number -> amount -> quantity -> discount -> add. Mobile-first. */
export function MicaWizardDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAdd: (item: Added) => void;
}) {
  const [step, setStep] = useState(0);
  const [category, setCategory] = useState("");
  const [micaNo, setMicaNo] = useState("");
  const [amount, setAmount] = useState("");
  const [qty, setQty] = useState("1");
  const [discMode, setDiscMode] = useState<DiscountMode>("pct");
  const [disc, setDisc] = useState("");

  const reset = () => {
    setStep(0); setCategory(""); setMicaNo(""); setAmount(""); setQty("1"); setDiscMode("pct"); setDisc("");
  };
  const close = () => { onOpenChange(false); reset(); };

  const amountN = Number(amount) || 0;
  const qtyN = Math.max(1, Number(qty) || 1);
  const discN = Number(disc) || 0;
  const amountEff = effectiveAmount(amountN, discMode, discN);
  const net = qtyN * amountEff;

  const addToCart = () => {
    if (!micaNo.trim() || amountN <= 0) return;
    onAdd({ name: `${micaNo.trim()} (${category})`, amount: amountEff, qty: qtyN });
    close();
  };

  const titles = ["Choose category", "Enter mica number", "Enter amount", "Quantity", "Discount"];
  const chips = [category, micaNo.trim()].filter(Boolean);

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <DialogContent
        style={{ ["--accent" as string]: ACCENT }}
        className="flex max-h-[90vh] w-[calc(100vw-1rem)] max-w-md flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-lg"
      >
        {/* Header */}
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
              <span className="grid h-8 w-8 place-items-center rounded-full text-sm font-extrabold text-white" style={{ backgroundColor: ACCENT }}>
                M
              </span>
            )}
            <DialogTitle className="text-lg font-extrabold tracking-tight text-slate-900">{titles[step]}</DialogTitle>
          </div>

          <div className="mt-4 flex gap-1.5" aria-hidden>
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="h-1.5 flex-1 rounded-full transition-colors"
                style={{ backgroundColor: i <= step ? ACCENT : "#dce7e5" }}
              />
            ))}
          </div>

          {chips.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {chips.map((c) => (
                <span key={c} className="rounded-full bg-[#e6f1ef] px-2.5 py-1 text-xs font-semibold text-[color:var(--accent)]">
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto bg-[#f5faf9] px-5 py-5">
          {step === 0 && (
            <div className="grid grid-cols-2 gap-3">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => { setCategory(c); setStep(1); }}
                  className="group flex flex-col gap-2.5 rounded-2xl border border-slate-200 bg-white p-2.5 text-left shadow-sm transition-all active:scale-[0.97] hover:border-[color:var(--accent)]"
                >
                  <img
                    src={`https://placehold.co/280x180?text=${encodeURIComponent(c)}`}
                    alt={c}
                    className="aspect-[3/2] w-full rounded-xl bg-slate-100 object-cover"
                  />
                  <span className="px-1 pb-1 text-sm font-bold text-slate-700 group-hover:text-[color:var(--accent)]">{c}</span>
                </button>
              ))}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Mica number</span>
                <input
                  type="text"
                  autoFocus
                  value={micaNo}
                  onChange={(e) => setMicaNo(e.target.value.toUpperCase())}
                  onKeyDown={(e) => { if (e.key === "Enter" && micaNo.trim()) setStep(2); }}
                  placeholder="e.g. SS-01-5253"
                  className="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-lg font-bold uppercase tracking-wide text-slate-900 focus:border-[color:var(--accent)] focus:outline-none"
                />
              </label>
              <Button
                type="button"
                className="h-14 w-full rounded-2xl text-base font-bold text-white disabled:opacity-40"
                style={{ backgroundColor: ACCENT }}
                disabled={!micaNo.trim()}
                onClick={() => setStep(2)}
              >
                Next
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-bold text-slate-800">{micaNo.trim()}</p>
                <p className="mt-0.5 text-xs text-slate-500">{category}</p>
              </div>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Amount (per piece)</span>
                <div className="flex items-center rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 focus-within:border-[color:var(--accent)]">
                  <span className="mr-2 text-xl font-bold text-slate-400">₹</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    autoFocus
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && amountN > 0) setStep(3); }}
                    placeholder="0"
                    className="w-full bg-transparent text-2xl font-bold text-slate-900 tabular-nums focus:outline-none"
                  />
                </div>
              </label>
              <Button
                type="button"
                className="h-14 w-full rounded-2xl text-base font-bold text-white disabled:opacity-40"
                style={{ backgroundColor: ACCENT }}
                disabled={!(amountN > 0)}
                onClick={() => setStep(3)}
              >
                Next
              </Button>
            </div>
          )}

          {step === 3 && (
            <QuantityStep
              accent={ACCENT}
              perUnitLabel="Per piece"
              perUnit={amountN}
              qty={qty}
              setQty={setQty}
              onNext={() => setStep(4)}
            />
          )}

          {step === 4 && (
            <DiscountStep
              accent={ACCENT}
              gross={qtyN * amountN}
              net={net}
              qty={qtyN}
              mode={discMode}
              setMode={setDiscMode}
              value={disc}
              setValue={setDisc}
            />
          )}
        </div>

        {/* Sticky action — final (discount) step */}
        {step === 4 && (
          <div className="shrink-0 border-t border-slate-100 bg-white px-5 py-4">
            <Button
              type="button"
              className="h-14 w-full rounded-2xl text-base font-bold text-white shadow-sm disabled:opacity-40"
              style={{ backgroundColor: ACCENT }}
              disabled={!(amountN > 0)}
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
