import { useEffect, useState } from "react";
import { makeBarcodeDataUrl, makeQrDataUrl } from "@/lib/codes";

export type LabelItem = { id: string; name: string; qr_payload: any };

export type LabelSize = { w: number; h: number };

export type LabelOrientation = "horizontal" | "vertical";

export function LabelSheet({
  items,
  format,
  size = { w: 50, h: 25 },
  orientation = "horizontal",
}: {
  items: LabelItem[];
  format: "thermal" | "a4";
  size?: LabelSize;
  orientation?: LabelOrientation;
}) {
  const [imgs, setImgs] = useState<Record<string, { b: string; q: string }>>({});
  useEffect(() => {
    (async () => {
      const out: Record<string, { b: string; q: string }> = {};
      for (const it of items) {
        out[it.id] = { b: await makeBarcodeDataUrl(it.id), q: await makeQrDataUrl(it.qr_payload) };
      }
      setImgs(out);
    })();
  }, [items]);

  if (format === "thermal") {
    // Lay each label out at the exact roll size so the thermal printer feeds
    // one sticker per page with no scaling. The @page rule overrides the
    // global print margins for these roll-fed labels.
    // The selected orientation controls the sticker page itself: horizontal is
    // always wide, vertical is always tall.
    const isHorizontal = orientation === "horizontal";
    const pageW = isHorizontal ? Math.max(size.w, size.h) : Math.min(size.w, size.h);
    const pageH = isHorizontal ? Math.min(size.w, size.h) : Math.max(size.w, size.h);
    const innerW = pageW;
    const innerH = pageH;
    const qrSize = Math.max(12, Math.min(innerH - 4, innerW * 0.4));
    return (
      <div className="print-area">
        <style>{`@media print { @page { size: ${pageW}mm ${pageH}mm; margin: 0; } html, body { width: ${pageW}mm; height: ${pageH}mm; } }`}</style>
        {items.map((it) => (
          <div key={it.id} style={{ width: `${pageW}mm`, height: `${pageH}mm`, pageBreakAfter: "always", breakAfter: "page", marginBottom: "2mm", background: "#fff", boxSizing: "border-box", overflow: "hidden", position: "relative", border: "1px dashed #ccc" }}>
            <div
              style={{
                width: `${innerW}mm`,
                height: `${innerH}mm`,
                boxSizing: "border-box",
                padding: "1mm",
                display: "flex",
                gap: "1mm",
                background: "#fff",
                overflow: "hidden",
                position: "absolute",
                top: 0,
                left: 0,
                transformOrigin: "top left",
                transform: "none",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "8pt", fontWeight: 800, lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.name}</div>
                <div style={{ fontSize: "7pt", fontFamily: "monospace", fontWeight: 700, marginTop: "1mm" }}>{it.id}</div>
                {imgs[it.id] && <img src={imgs[it.id].b} alt="" style={{ width: "100%", height: `${Math.max(6, innerH * 0.4)}mm`, objectFit: "contain", marginTop: "1mm" }} />}
              </div>
              {imgs[it.id] && <img src={imgs[it.id].q} alt="" style={{ width: `${qrSize}mm`, height: `${qrSize}mm` }} />}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // A4 grid: 4 cols x 10 rows
  return (
    <div className="print-area" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "2mm", padding: "5mm", background: "#fff" }}>
      {items.map((it) => (
        <div key={it.id} style={{ border: "1px dashed #aaa", padding: "2mm", display: "flex", gap: "2mm", height: "25mm" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "8pt", fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.name}</div>
            <div style={{ fontSize: "7pt", fontFamily: "monospace", fontWeight: 700, marginTop: "1mm" }}>{it.id}</div>
            {imgs[it.id] && <img src={imgs[it.id].b} alt="" style={{ width: "100%", height: "9mm", objectFit: "contain", marginTop: "1mm" }} />}
          </div>
          {imgs[it.id] && <img src={imgs[it.id].q} alt="" style={{ width: "18mm", height: "18mm" }} />}
        </div>
      ))}
    </div>
  );
}
