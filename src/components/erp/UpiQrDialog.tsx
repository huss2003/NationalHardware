import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { inr } from "@/lib/codes";
import { Check, Smartphone } from "lucide-react";

type UpiSettings = {
  upi_primary_vpa: string | null;
  upi_secondary_vpa: string | null;
  upi_payee_name: string | null;
  upi_merchant_code: string | null;
  upi_default: number | null;
  shop_name: string | null;
};

// Build a UPI deep-link. pa is kept raw (VPAs are URL-safe); only the name is encoded.
function buildUpiUri(vpa: string, pn: string, amount: number, tr: string, mc?: string | null) {
  let uri = `upi://pay?pa=${vpa}&pn=${encodeURIComponent(pn || "Shop")}&am=${amount.toFixed(2)}&cu=INR&tr=${tr}`;
  if (mc) uri += `&mc=${mc}`;
  return uri;
}

/** Shows a UPI QR (amount prefilled) before saving a UPI bill. Confirm = save as paid. */
export function UpiQrDialog({
  open,
  onOpenChange,
  amount,
  onConfirm,
  busy,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  amount: number;
  onConfirm: () => void;
  busy?: boolean;
}) {
  const [cfg, setCfg] = useState<UpiSettings | null>(null);
  const [qr, setQr] = useState<string>("");

  // One ref per opened dialog.
  const tr = useMemo(() => `STQU${Date.now()}`, [open]);

  useEffect(() => {
    if (!open) return;
    supabase.from("app_settings")
      .select("upi_primary_vpa,upi_secondary_vpa,upi_payee_name,upi_merchant_code,upi_default,shop_name")
      .eq("id", true).maybeSingle()
      .then(({ data }) => setCfg((data as UpiSettings) ?? null));
  }, [open]);

  const usePrimary = (cfg?.upi_default ?? 1) !== 2;
  const vpa = (usePrimary ? cfg?.upi_primary_vpa : cfg?.upi_secondary_vpa) ?? "";
  const accountLabel = usePrimary ? "HDFC" : "PhonePe";
  const payee = cfg?.upi_payee_name || cfg?.shop_name || "Shop";
  const mc = usePrimary ? cfg?.upi_merchant_code : null;

  useEffect(() => {
    if (!open || !vpa) { setQr(""); return; }
    const uri = buildUpiUri(vpa, payee, amount, tr, mc);
    QRCode.toDataURL(uri, { margin: 1, width: 300 }).then(setQr).catch(() => setQr(""));
  }, [open, vpa, payee, amount, tr, mc]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[calc(100vw-1rem)] max-w-sm flex-col gap-0 overflow-hidden rounded-3xl p-0">
        <div className="shrink-0 border-b border-slate-100 px-5 py-4 text-center">
          <DialogTitle className="text-lg font-extrabold tracking-tight text-slate-900">Scan to pay</DialogTitle>
          <p className="mt-0.5 text-sm text-slate-500">
            {vpa ? <>Paying to <span className="font-semibold text-slate-700">{vpa}</span> · {accountLabel}</> : "No UPI ID set — add one in Settings"}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto bg-[#fafbfc] px-5 py-5">
          <div className="mx-auto w-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            {qr
              ? <img src={qr} alt="UPI payment QR" className="h-60 w-60" />
              : <div className="grid h-60 w-60 place-items-center text-sm text-slate-400">Generating…</div>}
          </div>
          <div className="mt-4 rounded-2xl bg-[#3b82f6]/10 px-4 py-3 text-center">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#3b82f6]">Amount</p>
            <p className="text-3xl font-extrabold tabular-nums text-slate-900">{inr(amount)}</p>
          </div>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-slate-400">
            <Smartphone className="h-3.5 w-3.5" /> Scan with GPay, PhonePe, Paytm or any UPI app
          </p>
        </div>

        <div className="shrink-0 space-y-2 border-t border-slate-100 bg-white px-5 py-4">
          <Button
            type="button"
            className="h-14 w-full rounded-2xl bg-[#25D366] text-base font-bold text-white hover:bg-[#20bd5c] disabled:opacity-40"
            disabled={busy}
            onClick={onConfirm}
          >
            <Check className="mr-1.5 h-5 w-5" /> {busy ? "Saving…" : "Payment received"}
          </Button>
          <Button type="button" variant="outline" className="h-11 w-full rounded-2xl" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
