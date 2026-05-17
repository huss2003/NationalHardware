import { useEffect, useState } from "react";
import { makeBarcodeDataUrl, makeQrDataUrl } from "@/lib/codes";

export type LabelItem = { id: string; name: string; qr_payload: any };

export function LabelSheet({ items, format }: { items: LabelItem[]; format: "thermal" | "a4" }) {
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
    return (
      <div className="print-area">
        {items.map((it) => (
          <div key={it.id} style={{ width: "50mm", height: "25mm", pageBreakAfter: "always", padding: "1mm", display: "flex", gap: "1mm", border: "1px dashed #ccc", marginBottom: "2mm", background: "#fff" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "8pt", fontWeight: 800, lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.name}</div>
              <div style={{ fontSize: "7pt", fontFamily: "monospace", fontWeight: 700, marginTop: "1mm" }}>{it.id}</div>
              {imgs[it.id] && <img src={imgs[it.id].b} alt="" style={{ width: "100%", height: "10mm", objectFit: "contain", marginTop: "1mm" }} />}
            </div>
            {imgs[it.id] && <img src={imgs[it.id].q} alt="" style={{ width: "20mm", height: "20mm" }} />}
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
