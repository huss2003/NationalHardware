// Calls the project's print server with the exact same payload shape that
// ReprintLabelDialog.doPrint() -> printLabelHtml() -> POST /api/print/html
// would produce. Run after the server is up (it already is on :3001).
//
// node print-server/test-label.cjs
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

function buildLabelHtml({ items, imgs, size, orientation }) {
  const pageW = size.w, pageH = size.h;
  const isHorizontal = orientation === "horizontal";
  const flexDir = isHorizontal ? "row" : "column";
  const qrSize = isHorizontal
    ? Math.max(10, Math.min(pageH * 0.38, pageW * 0.38))
    : Math.max(10, Math.min(pageW * 0.38, pageH * 0.38));

  const pageCss = `@page { size: ${pageW}mm ${pageH}mm; margin: 0; } @media print { html, body { width: ${pageW}mm; height: ${pageH}mm; } }`;

  const body = items
    .map((it, idx) => {
      const last = idx === items.length - 1;
      const qImg = imgs[it.id]?.q
        ? `<img src="${imgs[it.id].q}" style="width:${qrSize}mm;height:${qrSize}mm;image-rendering:pixelated;flex-shrink:0" />`
        : "";
      return `
<div class="label" style="width:${pageW}mm;height:${pageH}mm;${last ? "" : "page-break-after:always;break-after:page;"}background:#fff;box-sizing:border-box;overflow:hidden;position:relative">
  <div style="width:${pageW}mm;height:${pageH}mm;box-sizing:border-box;padding:1.5mm;display:flex;flex-direction:${flexDir};align-items:center;justify-content:center;gap:2mm;background:#fff;overflow:hidden;position:absolute;top:0;left:0;transform-origin:top left;transform:none">
    <div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;height:100%">
      <div style="font-size:9pt;font-weight:900;line-height:1.2;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;word-break:break-word;margin:0">${esc(it.name)}</div>
      <div style="font-size:7pt;font-family:monospace;font-weight:900;margin-top:0.5mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(it.id)}</div>
    </div>
    ${qImg}
  </div>
</div>`;
    })
    .join("");

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
  const item = {
    id: "TEST-0001",
    name: "Test Label — SEZNIK 50x75mm",
  };
  const qr = await QRCode.toDataURL(item.id, { margin: 1, width: 160 });
  const imgs = { [item.id]: { b: "", q: qr } };
  const html = buildLabelHtml({
    items: [item],
    imgs,
    size: { w: 50, h: 75 },
    orientation: "horizontal",
  });

  console.log("POSTing test label to", PRINT_SERVER, "printer:", LABEL_PRINTER);
  const res = await fetch(`${PRINT_SERVER}/api/print/html`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      html,
      printerName: LABEL_PRINTER,
      paperWidth: 50,
      paperHeight: 75,
    }),
  });
  const text = await res.text();
  console.log("HTTP", res.status, text);
  if (!res.ok) process.exit(1);
})().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
