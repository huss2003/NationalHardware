import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LabelSheet, type LabelItem } from "@/components/erp/LabelSheet";
import { Printer } from "lucide-react";

export function ReprintLabelDialog({
  open, onOpenChange, items, format = "thermal", title = "Reprint stickers",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  items: LabelItem[];
  format?: "thermal" | "a4";
  title?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px] max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="rounded-md border bg-muted/30 p-3">
          {items.length === 0
            ? <div className="text-xs text-muted-foreground text-center py-6">Nothing to print.</div>
            : <LabelSheet items={items} format={format} />}
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