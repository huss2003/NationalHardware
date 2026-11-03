import { isPrintServerEnabled, getPrintServerUrl, printReceiptHtml } from "@/lib/printServer";

export type ReceiptSale = {
  invoice_no: string | null;
  invoice_date: string;
  bill_type?: string | null;
  subtotal: number; discount: number;
  cgst: number; sgst: number; igst: number; round_off?: number | null; grand_total: number;
  payment_mode: string;
};
export type ReceiptItem = { name: string; qty: number; rate: number; line_total: number };
export type ReceiptShop = { shop_name?: string | null; address?: string | null; gstin?: string | null; phone?: string | null };

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const money = (n: number) => Number(n || 0).toFixed(2);
const dt = (d: string) => { const [y, m, day] = d.slice(0, 10).split("-"); return `${day}/${m}/${y}`; };

/** Self-contained 58mm thermal receipt HTML. ESTIMATE vs TAX INVOICE by bill_type. */
export function buildReceiptHtml({ shop, sale, items }: { shop: ReceiptShop | null; sale: ReceiptSale; items: ReceiptItem[] }): string {
  const isGst = (sale.bill_type ?? "gst") === "gst";
  const title = isGst ? "TAX INVOICE" : "ESTIMATE";
  const tax = Number(sale.cgst) + Number(sale.sgst) + Number(sale.igst);
  const rows = items.map((it) => `
    <tr><td colspan="3" class="nm">${esc(it.name)}</td></tr>
    <tr><td>${it.qty} x ${money(it.rate)}</td><td></td><td class="r">${money(it.line_total)}</td></tr>`).join("");

  const line = (label: string, val: number, bold = false) =>
    `<tr class="${bold ? "b" : ""}"><td colspan="2">${esc(label)}</td><td class="r">${money(val)}</td></tr>`;

  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @page { size: 58mm auto; margin: 0; }
  * { box-sizing: border-box; }
  body { width: 56mm; margin: 0 auto; padding: 2mm 1mm; font-family: "Courier New", monospace; font-size: 11px; color: #000; }
  .c { text-align: center; } .r { text-align: right; } .b { font-weight: 700; }
  .shop { font-size: 14px; font-weight: 700; }
  .ttl { font-weight: 700; letter-spacing: 1px; margin: 3px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { vertical-align: top; }
  .nm { padding-top: 3px; }
  hr { border: none; border-top: 1px dashed #000; margin: 4px 0; }
  .sm { font-size: 10px; }
  </style></head><body>
    <div class="c shop">${esc(shop?.shop_name ?? "National Hardware and Plywood")}</div>
    ${shop?.address ? `<div class="c sm">${esc(shop.address)}</div>` : ""}
    ${isGst && shop?.gstin ? `<div class="c sm">GSTIN: ${esc(shop.gstin)}</div>` : ""}
    ${shop?.phone ? `<div class="c sm">${esc(shop.phone)}</div>` : ""}
    <div class="c ttl">${title}</div>
    <div class="sm">No: ${esc(sale.invoice_no ?? "-")}</div>
    <div class="sm">Date: ${dt(sale.invoice_date)} &nbsp; ${esc(String(sale.payment_mode).toUpperCase())}</div>
    <hr>
    <table>${rows}</table>
    <hr>
    <table>
      ${line("Subtotal", Number(sale.subtotal))}
      ${Number(sale.discount) > 0 ? line("Discount", -Number(sale.discount)) : ""}
      ${isGst && Number(sale.cgst) > 0 ? line("CGST", Number(sale.cgst)) : ""}
      ${isGst && Number(sale.sgst) > 0 ? line("SGST", Number(sale.sgst)) : ""}
      ${isGst && Number(sale.igst) > 0 ? line("IGST", Number(sale.igst)) : ""}
      ${isGst && tax === 0 ? "" : ""}
      ${Math.abs(Number(sale.round_off ?? 0)) >= 0.005 ? line("Round Off", Number(sale.round_off)) : ""}
      ${line("TOTAL", Number(sale.grand_total), true)}
    </table>
    <hr>
    <div class="c sm">${isGst ? "Thank you! Goods once sold are not returnable." : "Estimate only - not a tax invoice."}</div>
  </body></html>`;
}

function printViaIframe(html: string) {
  const f = document.createElement("iframe");
  f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(f);
  const d = f.contentWindow!.document;
  d.open(); d.write(html); d.close();
  setTimeout(() => {
    try { f.contentWindow!.focus(); f.contentWindow!.print(); } catch {}
    setTimeout(() => f.remove(), 1500);
  }, 300);
}

/** Print the receipt: via the local print server when enabled, else the browser dialog. */
export async function printThermalReceipt(args: { shop: ReceiptShop | null; sale: ReceiptSale; items: ReceiptItem[] }) {
  const html = buildReceiptHtml(args);
  if (isPrintServerEnabled() && getPrintServerUrl()) {
    try { await printReceiptHtml(html); return; }
    catch { /* fall back to the browser dialog */ }
  }
  printViaIframe(html);
}
