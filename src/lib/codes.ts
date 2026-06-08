// Heavy libs (bwip-js ~150KB, qrcode ~30KB) are loaded on demand so the 17
// routes that only use inr() don't pay for them on first paint.
export async function makeBarcodeDataUrl(text: string): Promise<string> {
  if (typeof document === "undefined") return "";
  const { default: bwipjs } = await import("bwip-js/browser");
  const canvas = document.createElement("canvas");
  bwipjs.toCanvas(canvas, {
    bcid: "code128",
    text,
    scale: 2,
    height: 10,
    includetext: true,
    textsize: 7,
    textyoffset: 1,
  });
  return canvas.toDataURL("image/png");
}

// Load the qrcode lib once and reuse it, and memoize generated data URLs so the
// same ID is never re-encoded (huge win when previewing/printing many labels).
let _qrLib: ReturnType<typeof import> | null = null;
const _qrCache = new Map<string, string>();

export async function makeQrDataUrl(payload: unknown): Promise<string> {
  const text = typeof payload === "string" ? payload : JSON.stringify(payload);
  const cached = _qrCache.get(text);
  if (cached) return cached;
  if (!_qrLib) _qrLib = import("qrcode");
  const QRCode = await _qrLib;
  // 160px is plenty sharp for a ~20mm sticker and ~2.5x faster to encode than 240px.
  const url = await QRCode.toDataURL(text, { margin: 1, width: 160 });
  _qrCache.set(text, url);
  return url;
}

// Normalize whatever a scanner / keyboard wedge produces into a plain item ID.
// New labels encode the bare ID in both the barcode and the QR code. Older
// labels encoded a JSON payload in the QR — extract the `id` from those too so
// scanning still resolves the unit during sales.
export function parseScannedCode(raw: string): string {
  const t = (raw ?? "").trim();
  if (t.startsWith("{") && t.endsWith("}")) {
    try {
      const o = JSON.parse(t);
      if (o && typeof o.id === "string") return o.id.trim();
    } catch {
      /* not JSON — fall through */
    }
  }
  return t;
}

export function inr(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return "₹" + v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Date displayed as DD/MM/YYYY across the app.
export function fmtDate(d: string | number | Date | null | undefined): string {
  if (!d && d !== 0) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB"); // DD/MM/YYYY
}

// Date + time displayed as DD/MM/YYYY, HH:MM.
export function fmtDateTime(d: string | number | Date | null | undefined): string {
  if (!d && d !== 0) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-GB", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
