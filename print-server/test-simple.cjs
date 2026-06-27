const QRCode = require("qrcode");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { print } = require("pdf-to-printer");

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const TMP = path.join(__dirname, "_tmp_test");

(async () => {
  if (!fs.existsSync(TMP)) fs.mkdirSync(TMP, { recursive: true });

  const qr = await QRCode.toDataURL("TEST-001", { margin: 1, width: 160 });

  // Simple landscape HTML: 50mm x 30mm, text left, QR right
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<style>
  @page { size: 50mm 30mm; margin: 0; }
  html, body { margin: 0; padding: 0; width: 50mm; height: 30mm; background: #fff; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
</style></head>
<body style="display:flex;align-items:center;padding:1.5mm;gap:2mm;font-family:Arial,sans-serif">
  <div style="flex:1;display:flex;flex-direction:column;justify-content:center;height:100%">
    <div style="font-size:10pt;font-weight:bold">Test Label</div>
    <div style="font-size:7pt;font-family:monospace;margin-top:1mm">TEST-001</div>
  </div>
  <img src="${qr}" style="width:25mm;height:25mm;image-rendering:pixelated" />
</body></html>`;

  const htmlPath = path.join(TMP, "test.html");
  const pdfPath = path.join(TMP, "test.pdf");
  fs.writeFileSync(htmlPath, html, "utf-8");

  console.log("Generating PDF...");
  execSync(`"${EDGE}" --headless --disable-gpu --no-sandbox --print-to-pdf="${pdfPath}" --no-pdf-header-footer "file:///${htmlPath.replace(/\\/g, "/")}"`, { timeout: 15000 });

  console.log("Printing with paperSize 50x30mm...");
  await print(pdfPath, {
    printer: "LABEL",
    silent: true,
    scale: "fit",
    paperSize: { width: "50mm", height: "30mm" },
  });
  console.log("Done! Check the label.");

  // Cleanup
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch(e) {}
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
