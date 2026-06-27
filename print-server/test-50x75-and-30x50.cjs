const QRCode = require("qrcode");

const PRINT_SERVER = "http://127.0.0.1:3001";
const LABEL_PRINTER = "LABEL";

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildLabelHtml({ item, qr, size }) {
  const pageW = size.w, pageH = size.h;
  const qrSize = Math.max(8, Math.min(pageW * 0.40, pageH * 0.40));

  const body = `
<div style="width:${pageW}mm;height:${pageH}mm;background:#fff;box-sizing:border-box;overflow:hidden;display:flex;flex-direction:row;align-items:stretch;padding:1.5mm;gap:2mm">
  <div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;overflow:hidden">
    <div style="font-size:9pt;font-weight:900;line-height:1.2;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;word-break:break-word;overflow-wrap:anywhere;margin:0">${esc(item.name)}</div>
    <div style="font-size:7pt;font-family:monospace;font-weight:900;margin-top:0.5mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(item.id)}</div>
  </div>
  <div style="flex-shrink:0;display:flex;align-items:center;justify-content:center">
    <img src="${qr}" style="width:${qrSize}mm;height:${qrSize}mm;image-rendering:pixelated" />
  </div>
</div>`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { size: ${pageW}mm ${pageH}mm; margin: 0; }
  html,body{margin:0;padding:0;width:${pageW}mm;height:${pageH}mm;background:#fff;overflow:hidden}
  *{ -webkit-print-color-adjust:exact; print-color-adjust:exact }
</style>
</head>
<body>${body}
</body>
</html>`;
}

(async () => {
  const item = { id: "T-50x50", name: "Sample Item Name Long Text Wrapping Test" };
  const qr = await QRCode.toDataURL(item.id, { margin: 1, width: 160 });
  const size = { w: 50, h: 50 };
  const html = buildLabelHtml({ item, qr, size });

  console.log("POSTing 50x50mm label...");
  const res = await fetch(`${PRINT_SERVER}/api/print/html`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ html, printerName: LABEL_PRINTER }),
  });
  const text = await res.text();
  console.log("HTTP", res.status, text);
  if (!res.ok) process.exit(1);
  console.log("Done. Check label — should fit in one.");
})().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
