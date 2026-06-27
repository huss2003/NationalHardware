const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { execSync, exec } = require("child_process");
const temp = require("temp");
temp.track();

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const PORT = process.env.PORT || 3001;
const EDGE_PATH = process.env.EDGE_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

function getWindowsPrinterName(name) {
  if (name === "LABEL") return "LABEL";
  if (name === "POS58 Printer") return "POS58 Printer";
  return name;
}

function ensureEdgeExists() {
  if (!fs.existsSync(EDGE_PATH)) {
    throw new Error(`Microsoft Edge not found at ${EDGE_PATH}`);
  }
}

function htmlToPdf(html, outputPath) {
  return new Promise((resolve, reject) => {
    const tmpHtml = temp.path({ suffix: ".html" });
    fs.writeFileSync(tmpHtml, html, "utf-8");
    const pdfPath = outputPath || temp.path({ suffix: ".pdf" });
    const args = [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--no-pdf-header-footer",
      "--run-all-compositor-stages-before-draw",
      "--virtual-time-budget=1000",
      `--print-to-pdf=${pdfPath}`,
      `file:///${tmpHtml.replace(/\\/g, "/")}`,
    ];
    try {
      execSync(`"${EDGE_PATH}" ${args.join(" ")}`, {
        timeout: 30000,
        stdio: "pipe",
        windowsHide: true,
      });
      console.log(`PDF saved: ${pdfPath} (${fs.statSync(pdfPath).size} bytes)`);
      resolve(pdfPath);
    } catch (err) {
      reject(new Error(`Edge PDF generation failed: ${err.message}`));
    } finally {
      try { fs.unlinkSync(tmpHtml); } catch {}
    }
  });
}

async function printPdf(pdfPath, printerName, paperWidth, paperHeight) {
  const { execSync } = require("child_process");
  const printer = getWindowsPrinterName(printerName || "LABEL");

  if (paperWidth && paperHeight) {
    const orient = paperWidth >= paperHeight ? "landscape" : "portrait";
    const sumatraPath = path.join(__dirname, "node_modules", "pdf-to-printer", "dist", "SumatraPDF.exe");
    const args = [
      "-print-to", printer,
      "-silent",
      "-print-settings", `paper=${paperWidth}x${paperHeight},orientation=${orient},noscale`,
      pdfPath,
    ];
    execSync(`"${sumatraPath}" ${args.join(" ")}`, { timeout: 30000, stdio: "pipe", windowsHide: true });
  } else {
    const { print } = require("pdf-to-printer");
    await print(pdfPath, { printer, silent: true });
  }
}

app.post("/api/print/html", async (req, res) => {
  try {
    ensureEdgeExists();
    const { html, printerName, paperWidth, paperHeight } = req.body;
    if (!html) {
      return res.status(400).json({ error: "Missing 'html' in request body" });
    }
    const pdfPath = await htmlToPdf(html, null);
    await printPdf(pdfPath, printerName, paperWidth, paperHeight);
    res.json({ success: true, message: `Printed to: ${printerName || "LABEL"}` });
  } catch (err) {
    console.error("Print HTML error:", err);
    res.status(500).json({ error: err.message });
  }
});

function buildReceiptHtml(opts) {
  const { header, footer, items, totals } = opts;
  const lines = items.map((i) =>
    `<tr><td>${i.qty ? i.qty + "x " : ""}${i.name}</td><td style="text-align:right">$${(i.price || 0).toFixed(2)}</td></tr>`
  ).join("\n");
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  @page { size: 58mm 200mm; margin: 0; }
  body { width: 58mm; font-family: 'Courier New', monospace; font-size: 10pt; padding: 2mm; box-sizing: border-box; }
  .header { text-align: center; font-weight: bold; margin-bottom: 3mm; white-space: pre-wrap; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 1mm 0; }
  .total { font-weight: bold; border-top: 1px dashed #000; margin-top: 2mm; padding-top: 2mm; }
  .footer { text-align: center; margin-top: 3mm; white-space: pre-wrap; }
</style></head><body>
${header ? `<div class="header">${header}</div>` : ""}
<table>${lines}</table>
<div class="total">
  <div>Subtotal: $${(totals.subtotal || 0).toFixed(2)}</div>
  ${totals.tax ? `<div>Tax: $${(totals.tax || 0).toFixed(2)}</div>` : ""}
  <div style="font-size:12pt">Total: $${(totals.total || 0).toFixed(2)}</div>
</div>
${footer ? `<div class="footer">${footer}</div>` : ""}
</body></html>`;
}

app.post("/api/print/receipt", async (req, res) => {
  try {
    ensureEdgeExists();
    const { header, footer, items, totals, printerName } = req.body;
    if (!items || !totals) {
      return res.status(400).json({ error: "Missing required fields: items, totals" });
    }
    const html = buildReceiptHtml({ header, footer, items, totals });
    const pdfPath = await htmlToPdf(html, null);
    await printPdf(pdfPath, printerName || "POS58 Printer");
    res.json({ success: true, message: `Receipt printed to: ${printerName || "POS58 Printer"}` });
  } catch (err) {
    console.error("Print receipt error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/printers", async (req, res) => {
  try {
    const raw = execSync(
      'powershell -Command "Get-Printer | Select-Object Name, DriverName, PrinterStatus | ConvertTo-Json"',
      { encoding: "utf-8", timeout: 10000, windowsHide: true }
    );
    const parsed = JSON.parse(raw);
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    res.json(arr.map((p) => ({ name: p.Name, driver: p.DriverName, status: p.PrinterStatus })));
  } catch (err) {
    res.status(500).json({ error: `Failed to list printers: ${err.message}` });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", edge: fs.existsSync(EDGE_PATH), port: PORT });
});

if (require.main === module) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`SEZNIK Print Server running on http://0.0.0.0:${PORT}`);
    console.log(`Edge exists: ${fs.existsSync(EDGE_PATH)}`);
    try {
      const raw = execSync(
        'powershell -Command "Get-Printer | Select-Object Name, DriverName, PrinterStatus | ConvertTo-Json"',
        { encoding: "utf-8", timeout: 10000, windowsHide: true }
      );
      const parsed = JSON.parse(raw);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      for (const p of arr) {
        console.log(`  Printer: ${p.Name} (${p.DriverName}) [${p.PrinterStatus}]`);
      }
    } catch (e) {
      console.log("  (could not list printers)");
    }
  });
}

module.exports = app;
