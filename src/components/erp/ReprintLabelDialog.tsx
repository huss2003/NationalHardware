import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { LabelItem, LabelSize, LabelOrientation } from "@/components/erp/LabelSheet";
import { makeBarcodeDataUrl, makeQrDataUrl } from "@/lib/codes";
import { buildLabelHtml, type CodeImgs } from "@/lib/labelHtml";
import { Printer } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

// Roll sizes for the Sexnik Veer 2-inch (50mm) thermal printer plus a couple
// of common variants. Width is fixed at the 50mm head; height is the label gap.
const THERMAL_SIZES: { label: string; size: LabelSize }[] = [
  { label: '50 × 25 mm', size: { w: 50, h: 25 } },
  { label: '50 × 30 mm', size: { w: 50, h: 30 } },
  { label: '50 × 38 mm', size: { w: 50, h: 38 } },
  { label: '50 × 40 mm', size: { w: 50, h: 40 } },
  { label: '40 × 25 mm', size: { w: 40, h: 25 } },
  { label: '40 × 30 mm', size: { w: 40, h: 30 } },
  { label: '60 × 40 mm', size: { w: 60, h: 40 } },
  { label: '75 × 50 mm', size: { w: 75, h: 50 } },
];

export function ReprintLabelDialog({
  open, onOpenChange, items, format = "thermal", title = "Reprint stickers",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  items: LabelItem[];
  format?: "thermal" | "a4";
  title?: string;
}) {
  const [fmt, setFmt] = useState<"thermal" | "a4">(format);
  const [sizeIdx, setSizeIdx] = useState(0);
  const [orientation, setOrientation] = useState<LabelOrientation>("horizontal");
  const [custom, setCustom] = useState(false);
  const [customW, setCustomW] = useState(50);
  const [customH, setCustomH] = useState(25);
  const [imgs, setImgs] = useState<CodeImgs>({});

  const size: LabelSize = custom
    ? { w: Math.max(10, customW || 0), h: Math.max(10, customH || 0) }
    : THERMAL_SIZES[sizeIdx].size;
  const previewSize: LabelSize = fmt === "thermal"
    ? {
        w: orientation === "horizontal" ? Math.max(size.w, size.h) : Math.min(size.w, size.h),
        h: orientation === "horizontal" ? Math.min(size.w, size.h) : Math.max(size.w, size.h),
      }
    : size;

  // Generate the barcode + QR images for every item once the dialog has items.
  useEffect(() => {
    let alive = true;
    (async () => {
      const out: CodeImgs = {};
      for (const it of items) {
        out[it.id] = { b: await makeBarcodeDataUrl(it.id), q: await makeQrDataUrl(it.qr_payload) };
      }
      if (alive) setImgs(out);
    })();
    return () => { alive = false; };
  }, [items]);

  // The exact HTML that the printer receives — also rendered in the preview
  // iframe so what you see is what prints (correct count, no blank pages).
  const html = useMemo(
    () => buildLabelHtml({ items, imgs, format: fmt, size, orientation }),
    [items, imgs, fmt, size.w, size.h, orientation],
  );

  const printRef = useRef<HTMLIFrameElement>(null);

  const doPrint = () => {
    const iframe = printRef.current;
    if (!iframe) return;
    const win = iframe.contentWindow;
    if (!win) return;
    win.focus();
    win.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <div className="text-xs font-medium mb-1.5">Label format</div>
            <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-lg">
              {([
                { v: "thermal", label: "Thermal roll (2 inch)" },
                { v: "a4", label: "A4 sheet" },
              ] as const).map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setFmt(o.v)}
                  className={`h-9 rounded-md text-sm font-semibold transition-colors ${
                    fmt === o.v
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {fmt === "thermal" && (
            <>
            <div>
              <div className="text-xs font-medium mb-1.5">Label size (Sexnik Veer 2 inch)</div>
              <div className="grid grid-cols-4 gap-2">
                {THERMAL_SIZES.map((s, i) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => { setSizeIdx(i); setCustom(false); }}
                    className={`h-9 rounded-md border text-xs font-semibold transition-colors ${
                      !custom && sizeIdx === i
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-foreground border-input hover:bg-muted"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setCustom(true)}
                  className={`h-9 rounded-md border text-xs font-semibold transition-colors ${
                    custom
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-input hover:bg-muted"
                  }`}
                >
                  Custom
                </button>
              </div>
              {custom && (
                <div className="mt-2 flex items-end gap-2">
                  <div className="flex-1">
                    <div className="text-[11px] text-muted-foreground mb-1">Width (mm)</div>
                    <input
                      type="number"
                      min={10}
                      value={customW || ""}
                      onChange={(e) => setCustomW(Number(e.target.value) || 0)}
                      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                    />
                  </div>
                  <span className="pb-2 text-muted-foreground">×</span>
                  <div className="flex-1">
                    <div className="text-[11px] text-muted-foreground mb-1">Height (mm)</div>
                    <input
                      type="number"
                      min={10}
                      value={customH || ""}
                      onChange={(e) => setCustomH(Number(e.target.value) || 0)}
                      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                    />
                  </div>
                </div>
              )}
            </div>
            <div>
              <div className="text-xs font-medium mb-1.5">Orientation</div>
              <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-lg">
                {([
                  { v: "horizontal", label: "Horizontal" },
                  { v: "vertical", label: "Vertical" },
                ] as const).map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    onClick={() => setOrientation(o.v)}
                    className={`h-9 rounded-md text-sm font-semibold transition-colors ${
                      orientation === o.v
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            </>
          )}

          <p className="text-xs text-muted-foreground">
            Choose your printer (e.g. <span className="font-medium">Sexnik Veer</span>) in the system
            print dialog that opens after you tap Print.
          </p>
        </div>

        <div>
          <div className="text-xs font-medium mb-1.5">
            Preview — {items.length} label{items.length === 1 ? "" : "s"} (exactly what prints)
          </div>
          <div className="rounded-md border bg-muted/30 p-3 flex justify-center">
            {items.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-6">Nothing to print.</div>
            ) : (
              <iframe
                title="label-preview"
                srcDoc={html}
                className="bg-white rounded shadow-sm border"
                style={{
                  width: fmt === "thermal" ? `${Math.min(previewSize.w * 4, 320)}px` : "100%",
                  height: fmt === "thermal" ? `${Math.min(previewSize.h * 4 * Math.min(items.length, 4) + 16, 420)}px` : "420px",
                }}
              />
            )}
          </div>
        </div>

        {/* Hidden iframe used purely for printing — guarantees the printout
            matches the preview and prints only the labels. */}
        <iframe
          ref={printRef}
          title="label-print"
          srcDoc={html}
          style={{ position: "fixed", width: `${previewSize.w}mm`, height: `${previewSize.h}mm`, border: 0, left: "-9999px", top: 0 }}
        />

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={doPrint} className="gap-2" disabled={items.length === 0}>
            <Printer className="h-4 w-4" /> Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
