// Mock-data test print: 49 x 29 mm on 50 x 30 mm label stock (1mm margin).
// No webapp, no DB, no project code. Pure standalone Node script.
//   node print-server/test-mock-49x29.cjs
const QRCode = require("qrcode");

const PRINT_SERVER = "http://127.0.0.1:3001";
const LABEL_PRINTER = "LABEL";

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Mock data — completely independent of the webapp.
const MOCK_ITEM = { id: "MOCK-0001", name: "Sample Product 49x29" };

(async () => {
  const pageW = 29, pageH = 49; // print area (1mm margin on each side of 50x30 stock), vertical
  const isHorizontal = pageW >= pageH;
  const flexDir = isHorizontal ? "row" : "column";
  // QR sized to ~35% of shorter dim so it fits with name + id
  const qrSize = Math.max(6, Math.min(pageH * 0.40, pageW * 0.40));

  const pageCss = `@page { size: ${pageW}mm ${pageH}mm; margin: 0; } @media print { html, body { width: ${pageW}mm; height: ${pageH}mm; } }`;

  const qr = await QRCode.toDataURL(MOCK_ITEM.id, { margin: 1, width: 160 });

  const body = `
<div class="label" style="width:${pageW}mm;height:${pageH}mm;background:#fff;box-sizing:border-box;overflow:hidden;position:relative">
  <div style="width:${pageW}mm;height:${pageH}mm;box-sizing:border-box;padding:0.8mm;display:flex;flex-direction:${flexDir};align-items:center;justify-content:center;gap:1mm;background:#fff;overflow:hidden;position:absolute;top:0;left:0">
    <div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;height:100%">
      <div style="font-size:7pt;font-weight:900;line-height:1.1;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;word-break:break-word;margin:0">${esc(MOCK_ITEM.name)}</div>
      <div style="font-size:6pt;font-family:monospace;font-weight:900;margin-top:0.3mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(MOCK_ITEM.id)}</div>
    </div>
    <img src="${qr}" style="width:${qrSize}mm;height:${qrSize}mm;image-rendering:pixelated;flex-shrink:0" />
  </div>
</div>`;

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  ${pageCss}
  html,body{margin:0;padding:0;background:#fff}
  *{ -webkit-print-color-adjust:exact; print-color-adjust:exact }
</style>
</head>
<body>${body}</body>
</html>`;

  const res = await fetch(`${PRINT_SERVER}/api/print/html`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      html,
      printerName: LABEL_PRINTER,
      paperWidth: pageW,
      paperHeight: pageH,
    }),
  });
  const text = await res.text();
  console.log(`29x49mm vertical mock -> HTTP ${res.status} ${text}`);
  if (!res.ok) process.exit(1);
})().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
