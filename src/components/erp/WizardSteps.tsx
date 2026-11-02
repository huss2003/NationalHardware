import { Button } from "@/components/ui/button";
import { inr } from "@/lib/codes";

export type DiscountMode = "pct" | "pp";

/** Quantity (pieces) step shared by the PLY/MICA wizards. */
export function QuantityStep({
  accent,
  perUnitLabel,
  perUnit,
  qty,
  setQty,
  onNext,
}: {
  accent: string;
  perUnitLabel: string;
  perUnit: number;
  qty: string;
  setQty: (v: string) => void;
  onNext: () => void;
}) {
  const qtyN = Math.max(1, Number(qty) || 1);
  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <span className="text-sm font-semibold text-slate-600">{perUnitLabel}</span>
        <span className="text-base font-bold tabular-nums text-slate-800">{inr(perUnit)}</span>
      </div>

      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-slate-700">Quantity (pieces)</span>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          autoFocus
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onNext(); }}
          placeholder="1"
          className="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-2xl font-bold text-slate-900 tabular-nums focus:outline-none"
          style={{ ["--tw-ring-color" as string]: accent }}
          onFocus={(e) => (e.currentTarget.style.borderColor = accent)}
          onBlur={(e) => (e.currentTarget.style.borderColor = "")}
        />
      </label>

      <div className="flex items-baseline justify-between rounded-2xl px-4 py-3" style={{ backgroundColor: `${accent}14` }}>
        <span className="text-sm font-semibold text-slate-600">Line total</span>
        <span className="text-2xl font-extrabold tabular-nums" style={{ color: accent }}>{inr(qtyN * perUnit)}</span>
      </div>

      <Button
        type="button"
        className="h-14 w-full rounded-2xl text-base font-bold text-white"
        style={{ backgroundColor: accent }}
        onClick={onNext}
      >
        Next
      </Button>
    </div>
  );
}

/** Discount step shared by the PLY/MICA wizards. Pick ONE mode: total % or ₹ per piece. Optional. */
export function DiscountStep({
  accent,
  gross,
  net,
  qty,
  mode,
  setMode,
  value,
  setValue,
}: {
  accent: string;
  gross: number;
  net: number;
  qty: number;
  mode: DiscountMode;
  setMode: (m: DiscountMode) => void;
  value: string;
  setValue: (v: string) => void;
}) {
  const tab = (m: DiscountMode, label: string) => (
    <button
      type="button"
      onClick={() => { setMode(m); setValue(""); }}
      className="flex-1 rounded-xl px-3 py-2 text-sm font-bold transition-colors"
      style={mode === m ? { backgroundColor: accent, color: "#fff" } : { color: "#64748b" }}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-5">
      <div className="flex gap-1 rounded-2xl border border-slate-200 bg-white p-1">
        {tab("pct", "Total %")}
        {tab("pp", "Per piece ₹")}
      </div>

      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-slate-700">
          {mode === "pct" ? "Discount %" : "Discount ₹ per piece"} <span className="font-normal text-slate-400">(optional)</span>
        </span>
        <div className="flex items-center rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 focus-within:border-[color:var(--accent)]" style={{ ["--accent" as string]: accent }}>
          <span className="mr-2 text-xl font-bold text-slate-400">{mode === "pct" ? "%" : "₹"}</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="0"
            className="w-full bg-transparent text-2xl font-bold text-slate-900 tabular-nums focus:outline-none"
          />
        </div>
      </label>

      <div className="space-y-1.5 rounded-2xl px-4 py-3" style={{ backgroundColor: `${accent}14` }}>
        <Row label={`Gross (${qty} pcs)`} value={inr(gross)} />
        <Row label="Discount" value={`- ${inr(Math.max(0, gross - net))}`} />
        <div className="my-1 h-px bg-slate-200" />
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-bold text-slate-700">Net</span>
          <span className="text-2xl font-extrabold tabular-nums" style={{ color: accent }}>{inr(net)}</span>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between text-sm">
      <span className="font-semibold text-slate-500">{label}</span>
      <span className="font-bold tabular-nums text-slate-700">{value}</span>
    </div>
  );
}
