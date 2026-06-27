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
  if (format === "thermal") {
    const pageW = size.w;
    const pageH = size.h;
    const qrSize = Math.round(Math.min(pageW, pageH) * 0.50);

    const pageCss = `@page { size: ${pageW}mm ${pageH}mm; margin: 0; }`;

    const body = items
      .map((it, idx) => {
        const last = idx === items.length - 1;
        const qImg = imgs[it.id]?.q
          ? `<img src="${imgs[it.id].q}" style="width:${qrSize}mm;height:${qrSize}mm;image-rendering:pixelated" />`
          : "";
        return `<div class="label" style="${last ? "" : "page-break-after:always;break-after:page;"}width:${pageW}mm;height:${pageH}mm;box-sizing:border-box;overflow:hidden;display:flex;flex-direction:row;align-items:stretch;padding-top:1mm;padding-left:0;padding-right:0;padding-bottom:0;margin:0;gap:0">
  <div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:flex-start;overflow:hidden;padding:0">
    <div style="font-size:9pt;font-weight:900;line-height:1.2;overflow:hidden;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;word-break:break-word;overflow-wrap:anywhere;margin:0">${esc(it.name)}</div>
    <div style="font-size:7pt;font-family:monospace;font-weight:900;margin-top:0.5mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(it.id)}</div>
  </div>
  <div style="flex-shrink:0;display:flex;align-items:flex-start;justify-content:center">${qImg}</div>
</div>`;
      })
      .join("");

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  ${pageCss}
  *{margin:0;padding:0;box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  html,body{width:${pageW}mm;height:${pageH}mm;overflow:hidden;background:#fff}
</style>
</head>
<body>${body}</body>
</html>`;
  }

  const pageCss = `@page { size: A4; margin: 5mm; }`;
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
  const body = `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:2mm">${cells}</div>`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  ${pageCss}
  html,body{margin:0;padding:0;background:#fff;overflow:hidden}
  *{ -webkit-print-color-adjust:exact; print-color-adjust:exact }
</style>
</head>
<body>${body}</body>
</html>`;
}
