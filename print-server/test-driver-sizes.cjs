// Prints one label per Option in the LABEL driver GPD (LabelPrinter.GPD),
// skipping the giant ones (>= 100mm) that obviously aren't label stock.
// Each label has its size + driver OptionN stamped on the front for ID.
//
// node print-server/test-driver-sizes.cjs
const QRCode = require("qrcode");

const PRINT_SERVER = "http://127.0.0.1:3001";
const LABEL_PRINTER = "LABEL";

// Pulled from C:\WINDOWS\System32\spool\DRIVERS\x64\3\LabelPrinter.GPD
// (skipping huge 94/100/105/194 mm ones — they need a wide carriage printer).
const DRIVER_SIZES = [
  { name: "50mm x 20mm",   w: 50,  h: 20,  option: "Option20" },
  { name: "50mm x 30mm",   w: 50,  h: 30,  option: "Option21" },
  { name: "40mm x 50mm",   w: 40,  h: 50,  option: "Option22" },
  { name: "60mm x 40mm",   w: 60,  h: 40,  option: "Option23" },
  { name: "72mm x 100mm",  w: 72,  h: 100, option: "Option25" },
  { name: "50.8x101.6mm (2x4in)", w: 50.8, h: 101.6, option: "Option28" },
];

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildLabelHtml({ item, qr, size, idxLabel }) {
  const pageW = size.w, pageH = size.h;
  // orientation: horizontal when wider than tall, else vertical (same rule as app)
  const isHorizontal = pageW >= pageH;
  const flexDir = isHorizontal ? "row" : "column";
  const qrSize = isHorizontal
    ? Math.max(8, Math.min(pageH * 0.35, pageW * 0.35))
    : Math.max(8, Math.min(pageW * 0.35, pageH * 0.35));

  const pageCss = `@page { size: ${pageW}mm ${pageH}mm; margin: 0; } @media print { html, body { width: ${pageW}mm; height: ${pageH}mm; } }`;

  const stamp = `[${idxLabel.opt}] ${pageW}x${pageH}mm ${isHorizontal ? "horiz" : "vert"}`;
  const body = `
<div class="label" style="width:${pageW}mm;height:${pageH}mm;background:#fff;box-sizing:border-box;overflow:hidden;position:relative">
  <div style="width:${pageW}mm;height:${pageH}mm;box-sizing:border-box;padding:1.5mm;display:flex;flex-direction:${flexDir};align-items:center;justify-content:center;gap:2mm;background:#fff;overflow:hidden;position:absolute;top:0;left:0">
    <div style="position:absolute;top:1mm;left:2mm;right:2mm;font-size:6pt;font-family:monospace;color:#666">${esc(stamp)}</div>
    <div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;height:100%">
      <div style="font-size:8pt;font-weight:900;line-height:1.15;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;word-break:break-word;margin:0">${esc(item.name)}</div>
      <div style="font-size:7pt;font-family:monospace;font-weight:900;margin-top:0.5mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(item.id)}</div>
    </div>
    <img src="${qr}" style="width:${qrSize}mm;height:${qrSize}mm;image-rendering:pixelated;flex-shrink:0" />
  </div>
</div>`;

  return `<!DOCTYPE html>
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
}

async function printOne(size, idxLabel) {
  const item = { id: "T-" + idxLabel.opt, name: "Sample Item" };
  const qr = await QRCode.toDataURL(item.id, { margin: 1, width: 160 });
  const html = buildLabelHtml({ item, qr, size, idxLabel });

  const res = await fetch(`${PRINT_SERVER}/api/print/html`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      html,
      printerName: LABEL_PRINTER,
      paperWidth: size.w,
      paperHeight: size.h,
    }),
  });
  const text = await res.text();
  console.log(`[${idxLabel.opt}] ${size.w}x${size.h}mm -> HTTP ${res.status} ${text}`);
  if (!res.ok) process.exitCode = 1;
}

(async () => {
  for (let i = 0; i < DRIVER_SIZES.length; i++) {
    const s = DRIVER_SIZES[i];
    await printOne(s, { opt: s.option, n: i + 1 });
  }
  console.log("Done. Each label is stamped with its size + driver option name.");
})().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
