// Client integration for a local SEZNIK DEV print server.
//
// The SEZNIK DEV thermal printer (USB VID:0FE6 PID:811E) is a 2-in-1 device
// exposed on Windows as two logical printers on the same USB port:
//   - "POS58 Printer" (driver POS58ENG) -> receipts, 48mm roll
//   - "LABEL"         (driver LABEL)     -> product/barcode labels
//
// A browser cannot drive a USB printer directly, so the printer PC runs a small
// Node/Express print server (see the integration guide). Client PCs POST jobs to
// it over HTTP. This module is that client. When no server is configured the app
// falls back to the normal browser print dialog.

export const LABEL_PRINTER = "LABEL";
export const RECEIPT_PRINTER = "POS58 Printer";

const LS_URL = "scanflow.printServer.url";
const LS_ENABLED = "scanflow.printServer.enabled";

export function getPrintServerUrl(): string {
  if (typeof localStorage === "undefined") return "";
  return localStorage.getItem(LS_URL) ?? "";
}

export function setPrintServerUrl(url: string) {
  if (typeof localStorage === "undefined") return;
  // strip trailing slash so we can append /api/... cleanly
  localStorage.setItem(LS_URL, url.trim().replace(/\/+$/, ""));
}

export function isPrintServerEnabled(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(LS_ENABLED) === "1";
}

export function setPrintServerEnabled(v: boolean) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(LS_ENABLED, v ? "1" : "0");
}

function base(): string {
  const u = getPrintServerUrl();
  if (!u) throw new Error("Print server URL is not set. Add it in the print dialog settings.");
  return u;
}

async function post(path: string, body: unknown) {
  const res = await fetch(`${base()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Print server responded ${res.status}${txt ? `: ${txt}` : ""}`);
  }
  return res.json().catch(() => ({ success: true }));
}

// Send fully-rendered label HTML (QR + name + id) to the LABEL printer.
export async function printLabelHtml(opts: {
  html: string;
  widthMm: number;
  heightMm: number;
  printerName?: string;
}) {
  return post("/api/print/html", {
    html: opts.html,
    printerName: opts.printerName ?? LABEL_PRINTER,
    paperWidth: opts.widthMm,
    paperHeight: opts.heightMm,
  });
}

export type ReceiptLine = { name: string; price: number; qty?: number; unitPrice?: number };

// Send a receipt to the POS58 receipt printer.
export async function printReceipt(opts: {
  header?: string;
  footer?: string;
  items: ReceiptLine[];
  subtotal: number;
  tax?: number;
  total: number;
}) {
  return post("/api/print/receipt", {
    header: opts.header,
    footer: opts.footer,
    items: opts.items,
    totals: { subtotal: opts.subtotal, tax: opts.tax ?? 0, total: opts.total },
  });
}

// List printers the server can see (status check / connectivity test).
export async function getPrinters() {
  const res = await fetch(`${base()}/api/printers`);
  if (!res.ok) throw new Error(`Print server responded ${res.status}`);
  return res.json();
}
