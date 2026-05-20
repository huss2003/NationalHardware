import { AlertOctagon, Ban, HelpCircle, PackageX, Copy } from "lucide-react";

export type ScanWarningKind = "unknown" | "wrong_prefix" | "sold" | "used" | "damaged" | "duplicate" | "generic";

const KIND_META: Record<ScanWarningKind, { title: string; icon: any }> = {
  unknown: { title: "Unknown item", icon: HelpCircle },
  wrong_prefix: { title: "Wrong category prefix", icon: Ban },
  sold: { title: "Item already SOLD", icon: PackageX },
  used: { title: "Item already used in production", icon: PackageX },
  damaged: { title: "Item is marked DAMAGED", icon: AlertOctagon },
  duplicate: { title: "Already in cart", icon: Copy },
  generic: { title: "Scan rejected", icon: AlertOctagon },
};

export function ScanWarning({ kind = "generic", message, code }: { kind?: ScanWarningKind; message: string; code?: string }) {
  const m = KIND_META[kind];
  const Icon = m.icon;
  return (
    <div
      role="alert"
      className="mt-3 rounded-lg border-2 border-destructive bg-destructive/10 text-destructive px-4 py-3 flex items-start gap-3 shadow-sm animate-in fade-in slide-in-from-top-1"
    >
      <div className="h-9 w-9 rounded-md bg-destructive text-destructive-foreground grid place-items-center shrink-0">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold uppercase tracking-wide">{m.title}</div>
        <div className="text-sm font-medium">
          {message}
          {code && <span className="ml-2 font-mono text-xs bg-destructive/15 px-1.5 py-0.5 rounded">{code}</span>}
        </div>
      </div>
    </div>
  );
}