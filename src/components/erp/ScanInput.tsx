import { useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { ScanLine } from "lucide-react";

export function ScanInput({ onScan, placeholder = "Scan barcode or type item ID and press Enter" }: { onScan: (code: string) => void; placeholder?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div className="relative">
      <ScanLine className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 text-primary" />
      <Input
        ref={ref}
        autoFocus
        className="h-16 pl-14 text-xl font-mono font-semibold"
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
