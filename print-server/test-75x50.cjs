// Test a single custom size: 75 x 50 mm, landscape.
// node print-server/test-75x50.cjs
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

function buildLabelHtml({ item, qr, size, orientation, idxLabel }) {
  const pageW = size.w, pageH = size.h;
  const isHorizontal = orientation === "horizontal";
  const flexDir = isHorizontal ? "row" : "column";
  const qrSize = isHorizontal
    ? Math.max(10, Math.min(pageH * 0.38, pageW * 0.38))
    : Math.max(10, Math.min(pageW * 0.38, pageH * 0.38));

  const pageCss = `@page { size: ${pageW}mm ${pageH}mm; margin: 0; } @media print { html, body { width: ${pageW}mm; height: ${pageH}mm; } }`;

  const body = `
<div class="label" style="width:${pageW}mm;height:${pageH}mm;background:#fff;box-sizing:border-box;overflow:hidden;position:relative">
  <div style="width:${pageW}mm;height:${pageH}mm;box-sizing:border-box;padding:1.5mm;display:flex;flex-direction:${flexDir};align-items:center;justify-content:center;gap:2mm;background:#fff;overflow:hidden;position:absolute;top:0;left:0;transform-origin:top left;transform:none">
    <div style="position:absolute;top:1mm;left:2mm;font-size:6pt;font-family:monospace;color:#888">[${idxLabel}] ${size.w}x${size.h}mm ${orientation}</div>
    <div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;height:100%">
      <div style="font-size:9pt;font-weight:900;line-height:1.2;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;word-break:break-word;margin:0">${esc(item.name)}</div>
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

(async () => {
  const size = { w: 50, h: 75 };
  const orientation = "vertical"; // 50 wide, 75 tall -> column layout
  const item = { id: "TEST-50X75V", name: "Sample Item Name" };
  const qr = await QRCode.toDataURL(item.id, { margin: 1, width: 160 });
  const html = buildLabelHtml({ item, qr, size, orientation, idxLabel: "75x50" });

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
  console.log(`50x75mm ${orientation} -> HTTP ${res.status} ${text}`);
  if (!res.ok) process.exit(1);
})().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
