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
    includetext: false,
  });
  return canvas.toDataURL("image/png");
}

export async function makeQrDataUrl(payload: unknown): Promise<string> {
  const text = typeof payload === "string" ? payload : JSON.stringify(payload);
  const { default: QRCode } = await import("qrcode");
  return QRCode.toDataURL(text, { margin: 1, width: 240 });
}

export function inr(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return "₹" + v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
