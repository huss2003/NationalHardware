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
  const pageW = size.w;
  const qrSize = Math.max(8, Math.min(pageW * 0.40, size.h * 0.40));
  const textH = 15;
  const contentH = Math.max(qrSize, textH);
  const contentW = pageW;

  const body = `
<div style="box-sizing:border-box;overflow:hidden;display:flex;flex-direction:row;align-items:stretch;padding:0;margin:0;gap:0">
  <div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:flex-start;overflow:hidden">
    <div style="font-size:9pt;font-weight:900;line-height:1.2;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;word-break:break-word;overflow-wrap:anywhere;margin:0">${esc(item.name)}</div>
    <div style="font-size:7pt;font-family:monospace;font-weight:900;margin-top:0.5mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(item.id)}</div>
  </div>
  <div style="flex-shrink:0;display:flex;align-items:flex-start;justify-content:center">
    <img src="${qr}" style="width:${qrSize}mm;height:${qrSize}mm;image-rendering:pixelated" />
  </div>
</div>`;

  return {
    html: `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { size: ${contentW}mm ${contentH}mm; margin: 0; }
  html,body{margin:0;padding:0;background:#fff;overflow:hidden}
  .label{width:${contentW}mm;height:${contentH}mm}
  *{ -webkit-print-color-adjust:exact; print-color-adjust:exact }
</style>
</head>
<body>${body}
</body>
</html>`,
    contentW,
    contentH,
  };
}

(async () => {
  const sizes = [
    { w: 50, h: 30, label: "50x30mm (landscape)" },
    { w: 50, h: 50, label: "50x50mm (square)" },
    { w: 50, h: 65, label: "50x65mm (portrait)" },
  ];

  const item = { id: "T-TEST", name: "Sample Item Name Long Text Wrapping Test" };
  const qr = await QRCode.toDataURL(item.id, { margin: 1, width: 160 });

  for (const size of sizes) {
    const { html, contentW, contentH } = buildLabelHtml({ item, qr, size });
    console.log(`\n--- Testing ${size.label} (PDF: ${contentW}x${contentH}mm, paperSize: ${contentW}x${contentH}) ---`);
    const res = await fetch(`${PRINT_SERVER}/api/print/html`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        html,
        printerName: LABEL_PRINTER,
        paperWidth: contentW,
        paperHeight: contentH,
      }),
    });
    const text = await res.text();
    console.log("HTTP", res.status, text);
    if (!res.ok) { process.exit(1); }
  }
  console.log("\nAll 3 done. Each PDF is content-sized with correct paperSize passed to driver.");
})().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
