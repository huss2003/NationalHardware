import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LabelSheet, type LabelItem, type LabelSize } from "@/components/erp/LabelSheet";
import { Printer } from "lucide-react";
import { useState } from "react";

// Roll sizes for the Sexnik Veer 2-inch (50mm) thermal printer plus a couple
// of common variants. Width is fixed at the 50mm head; height is the label gap.
const THERMAL_SIZES: { label: string; size: LabelSize }[] = [
  { label: '50 × 25 mm', size: { w: 50, h: 25 } },
  { label: '50 × 30 mm', size: { w: 50, h: 30 } },
  { label: '50 × 38 mm', size: { w: 50, h: 38 } },
  { label: '50 × 40 mm', size: { w: 50, h: 40 } },
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
  const size = THERMAL_SIZES[sizeIdx].size;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px] max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 no-print">
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
            <div>
              <div className="text-xs font-medium mb-1.5">Label size (Sexnik Veer 2 inch)</div>
              <div className="grid grid-cols-4 gap-2">
                {THERMAL_SIZES.map((s, i) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => setSizeIdx(i)}
                    className={`h-9 rounded-md border text-xs font-semibold transition-colors ${
                      sizeIdx === i
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-foreground border-input hover:bg-muted"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Choose your printer (e.g. <span className="font-medium">Sexnik Veer</span>) in the system
            print dialog that opens after you tap Print.
          </p>
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          {items.length === 0
            ? <div className="text-xs text-muted-foreground text-center py-6">Nothing to print.</div>
            : <LabelSheet items={items} format={fmt} size={size} />}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={() => window.print()} className="gap-2" disabled={items.length === 0}>
            <Printer className="h-4 w-4" /> Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}