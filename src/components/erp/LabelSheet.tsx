import { useEffect, useState } from "react";
import { makeBarcodeDataUrl, makeQrDataUrl } from "@/lib/codes";

export type LabelItem = { id: string; name: string; qr_payload: any };

export type LabelSize = { w: number; h: number };

export function LabelSheet({
  items,
  format,
  size = { w: 50, h: 25 },
}: {
  items: LabelItem[];
  format: "thermal" | "a4";
  size?: LabelSize;
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
    const qrSize = Math.max(12, Math.min(size.h - 4, size.w * 0.4));
    return (
      <div className="print-area">
        <style>{`@media print { @page { size: ${size.w}mm ${size.h}mm; margin: 0; } }`}</style>
        {items.map((it) => (
          <div key={it.id} style={{ width: `${size.w}mm`, height: `${size.h}mm`, pageBreakAfter: "always", padding: "1mm", display: "flex", gap: "1mm", border: "1px dashed #ccc", marginBottom: "2mm", background: "#fff", boxSizing: "border-box", overflow: "hidden" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "8pt", fontWeight: 800, lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.name}</div>
              <div style={{ fontSize: "7pt", fontFamily: "monospace", fontWeight: 700, marginTop: "1mm" }}>{it.id}</div>
              {imgs[it.id] && <img src={imgs[it.id].b} alt="" style={{ width: "100%", height: `${Math.max(6, size.h * 0.4)}mm`, objectFit: "contain", marginTop: "1mm" }} />}
            </div>
            {imgs[it.id] && <img src={imgs[it.id].q} alt="" style={{ width: `${qrSize}mm`, height: `${qrSize}mm` }} />}
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
