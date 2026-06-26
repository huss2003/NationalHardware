import type { LabelItem, LabelSize, LabelOrientation } from "@/components/erp/LabelSheet";

function esc(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type CodeImgs = Record<string, { b: string; q: string }>;

/**
 * Build a fully self-contained HTML document for the labels. The same markup is
 * used for the on-screen iframe preview AND the actual print, so what you see is
 * exactly what comes out of the printer (no extra blank pages, exact count).
 */
export function buildLabelHtml({
  items,
  imgs,
  format,
  size,
  orientation,
}: {
  items: LabelItem[];
  imgs: CodeImgs;
  format: "thermal" | "a4";
  size: LabelSize;
  orientation: LabelOrientation;
}): string {
  let pageCss = "";
  let body = "";

  if (format === "thermal") {
    // @page dimensions ALWAYS match the physical paper. Orientation only
    // controls how content is arranged inside the fixed label size.
    const pageW = size.w;
    const pageH = size.h;
    const innerW = pageW;
    const innerH = pageH;
    const isHorizontal = orientation === "horizontal";
    // Lay content out as a row (QR beside text) for horizontal, or a column
    // (QR above text) for vertical — within the same fixed page size.
    const flexDir = isHorizontal ? "row" : "column";
    // No barcode anymore — the QR alone carries the item ID, so size it from
    // the dimension that runs across the content flow.
    const qrSize = isHorizontal
      ? Math.max(14, Math.min(innerH - 2, innerW * 0.55))
      : Math.max(14, Math.min(innerW - 2, innerH * 0.55));

    pageCss = `@page { size: ${pageW}mm ${pageH}mm; margin: 0; } @media print { html, body { width: ${pageW}mm; height: ${pageH}mm; } }`;

    body = items
      .map((it, idx) => {
        const last = idx === items.length - 1;
        const qImg = imgs[it.id]?.q
          ? `<img src="${imgs[it.id].q}" style="width:${qrSize}mm;height:${qrSize}mm;image-rendering:pixelated" />`
          : "";
        return `
<div class="label" style="width:${pageW}mm;height:${pageH}mm;${last ? "" : "page-break-after:always;break-after:page;"}background:#fff;box-sizing:border-box;overflow:hidden;position:relative">
  <div style="width:${innerW}mm;height:${innerH}mm;box-sizing:border-box;padding:1mm;display:flex;flex-direction:${flexDir};align-items:center;justify-content:center;gap:1.5mm;background:#fff;overflow:hidden;position:absolute;top:0;left:0;transform-origin:top left;transform:none">
    <div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;height:100%">
      <div style="font-size:10pt;font-weight:900;line-height:1.15;overflow:hidden;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;word-break:break-word">${esc(it.name)}</div>
      <div style="font-size:8pt;font-family:monospace;font-weight:900;margin-top:1mm">${esc(it.id)}</div>
    </div>
    ${qImg}
  </div>
</div>`;
      })
      .join("");
  } else {
    pageCss = `@page { size: A4; margin: 5mm; }`;
    const cells = items
      .map((it) => {
        const qImg = imgs[it.id]?.q
          ? `<img src="${imgs[it.id].q}" style="width:21mm;height:21mm;image-rendering:pixelated" />`
          : "";
        return `
<div style="border:1px dashed #aaa;padding:2mm;display:flex;align-items:center;gap:2mm;height:25mm;box-sizing:border-box">
  <div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;height:100%">
    <div style="font-size:10pt;font-weight:900;line-height:1.15;overflow:hidden;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;word-break:break-word">${esc(it.name)}</div>
    <div style="font-size:8pt;font-family:monospace;font-weight:900;margin-top:1mm">${esc(it.id)}</div>
  </div>
  ${qImg}
</div>`;
      })
      .join("");
    body = `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:2mm">${cells}</div>`;
  }

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
