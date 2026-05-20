import { useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { ScanLine } from "lucide-react";

export function ScanInput({
  onScan,
  placeholder = "Scan barcode or type item ID and press Enter",
  invalid = false,
}: { onScan: (code: string) => void; placeholder?: string; invalid?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div className={`relative ${invalid ? "animate-pulse" : ""}`}>
      <ScanLine className={`absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 ${invalid ? "text-destructive" : "text-primary"}`} />
      <Input
        ref={ref}
        autoFocus
        className={`h-16 pl-14 text-xl font-mono font-semibold transition-colors ${
          invalid ? "border-destructive border-2 bg-destructive/5 focus-visible:ring-destructive" : ""
        }`}
        placeholder={placeholder}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const v = e.currentTarget.value.trim();
            if (v) {
              onScan(v);
              e.currentTarget.value = "";
            }
          }
        }}
      />
    </div>
  );
}
