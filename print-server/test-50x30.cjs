const QRCode = require("qrcode");
const PRINT_SERVER = "http://127.0.0.1:3001";
const LABEL_PRINTER = "LABEL";

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildLabelHtml({ items, imgs, size, orientation }) {
  const pageW = size.w;
  const pageH = size.h;
  const qrSize = Math.max(8, Math.min(pageW * 0.40, pageH * 0.40));
  const pageCss = `@page { size: ${pageW}mm ${pageH}mm; margin: 0; } @media print { html, body { width: ${pageW}mm; height: ${pageH}mm; } }`;

  const body = items.map((it, idx) => {
    const last = idx === items.length - 1;
    const qImg = imgs[it.id]?.q
      ? `<img src="${imgs[it.id].q}" style="width:${qrSize}mm;height:${qrSize}mm;image-rendering:pixelated" />`
      : "";
    return `<div class="label" style="width:${pageW}mm;height:${pageH}mm;${last ? "" : "page-break-after:always;break-after:page;"}background:#fff;box-sizing:border-box;overflow:hidden;display:flex;flex-direction:row;align-items:stretch;padding:1.5mm;gap:2mm">
  <div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;overflow:hidden">
    <div style="font-size:9pt;font-weight:900;line-height:1.2;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;word-break:break-word;overflow-wrap:anywhere;margin:0">${esc(it.name)}</div>
    <div style="font-size:7pt;font-family:monospace;font-weight:900;margin-top:0.5mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(it.id)}</div>
  </div>
  <div style="flex-shrink:0;display:flex;align-items:center;justify-content:center">${qImg}</div>
</div>`;
  }).join("");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<style>${pageCss} html,body{margin:0;padding:0;background:#fff} *{-webkit-print-color-adjust:exact;print-color-adjust:exact}</style>
</head><body>${body}</body></html>`;
}

(async () => {
  const item = { id: "TEST-50x30", name: "50x30mm Label Test" };
  const qr = await QRCode.toDataURL(item.id, { margin: 1, width: 160 });
  const imgs = { [item.id]: { b: "", q: qr } };
  const html = buildLabelHtml({
    items: [item],
    imgs,
    size: { w: 50, h: 30 },
    orientation: "horizontal",
  });

  console.log("POSTing 50x30mm label...");
  const res = await fetch(`${PRINT_SERVER}/api/print/html`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ html, printerName: LABEL_PRINTER, paperWidth: 50, paperHeight: 30 }),
  });
  const text = await res.text();
  console.log("HTTP", res.status, text);
})().catch(e => { console.error("FAILED:", e); process.exit(1); });
