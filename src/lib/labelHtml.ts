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
    const horizontal = orientation === "horizontal";
    const innerW = horizontal ? size.h : size.w;
    const innerH = horizontal ? size.w : size.h;
    const qrSize = Math.max(12, Math.min(innerH - 4, innerW * 0.4));
    const barH = Math.max(6, innerH * 0.4);

    pageCss = `@page { size: ${size.w}mm ${size.h}mm; margin: 0; }`;

    body = items
      .map((it, idx) => {
        const last = idx === items.length - 1;
        const bImg = imgs[it.id]?.b
          ? `<img src="${imgs[it.id].b}" style="width:100%;height:${barH}mm;object-fit:contain;margin-top:1mm" />`
          : "";
        const qImg = imgs[it.id]?.q
          ? `<img src="${imgs[it.id].q}" style="width:${qrSize}mm;height:${qrSize}mm" />`
          : "";
        return `
<div class="label" style="width:${size.w}mm;height:${size.h}mm;${last ? "" : "page-break-after:always;"}background:#fff;box-sizing:border-box;overflow:hidden;position:relative">
  <div style="width:${innerW}mm;height:${innerH}mm;box-sizing:border-box;padding:1mm;display:flex;gap:1mm;background:#fff;overflow:hidden;position:absolute;top:0;left:0;transform-origin:top left;transform:${horizontal ? `translateX(${size.w}mm) rotate(90deg)` : "none"}">
    <div style="flex:1;min-width:0">
      <div style="font-size:8pt;font-weight:800;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(it.name)}</div>
      <div style="font-size:7pt;font-family:monospace;font-weight:700;margin-top:1mm">${esc(it.id)}</div>
      ${bImg}
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
        const bImg = imgs[it.id]?.b
          ? `<img src="${imgs[it.id].b}" style="width:100%;height:9mm;object-fit:contain;margin-top:1mm" />`
          : "";
        const qImg = imgs[it.id]?.q
          ? `<img src="${imgs[it.id].q}" style="width:18mm;height:18mm" />`
          : "";
        return `
<div style="border:1px dashed #aaa;padding:2mm;display:flex;gap:2mm;height:25mm;box-sizing:border-box">
  <div style="flex:1;min-width:0">
    <div style="font-size:8pt;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(it.name)}</div>
    <div style="font-size:7pt;font-family:monospace;font-weight:700;margin-top:1mm">${esc(it.id)}</div>
    ${bImg}
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
