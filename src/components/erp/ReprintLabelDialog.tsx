import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { LabelItem, LabelSize, LabelOrientation } from "@/components/erp/LabelSheet";
import { makeQrDataUrl } from "@/lib/codes";
import { buildLabelHtml, type CodeImgs } from "@/lib/labelHtml";
import {
  LABEL_PRINTER,
  getPrintServerUrl,
  getPrinters,
  isPrintServerEnabled,
  printLabelHtml,
  setPrintServerEnabled,
  setPrintServerUrl,
} from "@/lib/printServer";
import { Printer, Server, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

// Roll/label sizes for the SEZNIK DEV thermal printer (LABEL logical printer,
// 203 DPI). 50 x 75 mm is the validated/confirmed working size. The earlier
// 50mm-width presets are kept for the receipt-width thermal roll variants.
const THERMAL_SIZES: { label: string; size: LabelSize }[] = [
  { label: '50 × 75 mm', size: { w: 50, h: 75 } },
  { label: '50 × 50 mm', size: { w: 50, h: 50 } },
  { label: '50 × 30 mm', size: { w: 50, h: 30 } },
  { label: '50 × 25 mm', size: { w: 50, h: 25 } },
  { label: '50 × 20 mm', size: { w: 50, h: 20 } },
  { label: '40 × 50 mm', size: { w: 40, h: 50 } },
  { label: '60 × 40 mm', size: { w: 60, h: 40 } },
  { label: '100 × 100 mm', size: { w: 100, h: 100 } },
  { label: '100 × 150 mm', size: { w: 100, h: 150 } },
  { label: '72 × 100 mm', size: { w: 72, h: 100 } },
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
  const [customH, setCustomH] = useState(75);
  const [imgs, setImgs] = useState<CodeImgs>({});

  // Print destination: browser print dialog vs SEZNIK print server.
  const [destination, setDestination] = useState<"browser" | "server">(
    isPrintServerEnabled() ? "server" : "browser",
  );
  const [serverUrl, setServerUrl] = useState(getPrintServerUrl());
  const [testState, setTestState] = useState<"idle" | "testing" | "ok" | "fail">("idle");
  const [sending, setSending] = useState(false);

  const size: LabelSize = custom
    ? { w: Math.max(10, customW || 0), h: Math.max(10, customH || 0) }
    : THERMAL_SIZES[sizeIdx].size;
  // @page dimensions always match the physical paper — never swap on orientation.
  const previewSize: LabelSize = size;

  // Generate the QR images for every item once the dialog has items.
  useEffect(() => {
    let alive = true;
    (async () => {
      const ids = Array.from(new Set(items.map((it) => it.id)));
      const entries = await Promise.all(
        ids.map(async (id) => [id, { b: "", q: await makeQrDataUrl(id) }] as const),
      );
      if (alive) setImgs(Object.fromEntries(entries));
    })();
    return () => { alive = false; };
  }, [items]);

  // The exact HTML the printer receives — also rendered in the preview iframe.
  const html = useMemo(
    () => buildLabelHtml({ items, imgs, format: fmt, size, orientation }),
    [items, imgs, fmt, size.w, size.h, orientation],
  );

  const printRef = useRef<HTMLIFrameElement>(null);

  const persistServer = (url: string, enabled: boolean) => {
    setPrintServerUrl(url);
    setPrintServerEnabled(enabled);
  };

  const testConnection = async () => {
    setPrintServerUrl(serverUrl);
    setTestState("testing");
    try {
      await getPrinters();
      setTestState("ok");
      toast.success("Connected to print server");
    } catch (e: any) {
      setTestState("fail");
      toast.error(`Cannot reach print server: ${e.message ?? e}`);
    }
  };

  const doPrint = async () => {
    if (items.length === 0) return;
    if (destination === "server") {
      persistServer(serverUrl, true);
      setSending(true);
      try {
        await printLabelHtml({
          html,
          widthMm: previewSize.w,
          heightMm: previewSize.h,
          printerName: LABEL_PRINTER,
        });
        toast.success(`Sent ${items.length} label${items.length === 1 ? "" : "s"} to ${LABEL_PRINTER}`);
        onOpenChange(false);
      } catch (e: any) {
        toast.error(`Print server error: ${e.message ?? e}`);
      } finally {
        setSending(false);
      }
      return;
    }
    // Browser fallback — print from the hidden iframe.
    persistServer(serverUrl, false);
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
            <div className="text-xs font-medium mb-1.5">Print destination</div>
            <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-lg">
              {([
                { v: "browser", label: "Browser print" },
                { v: "server", label: "SEZNIK print server" },
              ] as const).map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setDestination(o.v)}
                  className={`h-9 rounded-md text-sm font-semibold transition-colors ${
                    destination === o.v
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {destination === "server" && (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <div className="text-xs font-medium flex items-center gap-1.5">
                <Server className="h-3.5 w-3.5" /> Print server address
              </div>
              <div className="flex items-end gap-2">
                <input
                  type="text"
                  value={serverUrl}
                  onChange={(e) => { setServerUrl(e.target.value); setTestState("idle"); }}
                  placeholder="http://192.168.1.100:3000"
                  className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm font-mono"
                />
                <Button type="button" variant="outline" className="h-9 gap-1.5" onClick={testConnection} disabled={!serverUrl || testState === "testing"}>
                  {testState === "testing" ? <Loader2 className="h-4 w-4 animate-spin" /> :
                   testState === "ok" ? <CheckCircle2 className="h-4 w-4 text-green-600" /> :
                   testState === "fail" ? <XCircle className="h-4 w-4 text-destructive" /> : null}
                  Test
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Labels print to the <span className="font-medium">{LABEL_PRINTER}</span> printer on the PC running the print server.
                Run the Node print server on the printer PC and enter its IP and port here.
              </p>
            </div>
          )}

          <div>
            <div className="text-xs font-medium mb-1.5">Label format</div>
            <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-lg">
              {([
                { v: "thermal", label: "Thermal label (SEZNIK)" },
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
              <div className="text-xs font-medium mb-1.5">Label size (SEZNIK — 50 × 75 mm confirmed)</div>
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
            {destination === "server"
              ? <>Tapping Print sends the job straight to the <span className="font-medium">SEZNIK</span> printer — no system dialog.</>
              : <>Choose your printer (e.g. <span className="font-medium">SEZNIK / LABEL</span>) in the system print dialog that opens after you tap Print.</>}
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

        {/* Hidden iframe used purely for browser printing. */}
        <iframe
          ref={printRef}
          title="label-print"
          srcDoc={html}
          style={{ position: "fixed", width: `${previewSize.w}mm`, height: `${previewSize.h}mm`, border: 0, left: "-9999px", top: 0 }}
        />

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={doPrint} className="gap-2" disabled={items.length === 0 || sending}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
            {destination === "server" ? "Send to printer" : "Print"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
