import { useMemo, useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty, CommandGroup } from "@/components/ui/command";
import { ChevronDown, Check } from "lucide-react";

const round2 = (n: number) => Math.round(n * 100) / 100;

// Build inclusive numeric options (as strings) from min..max by step.
function buildOptions(min: number, max: number, step: number): string[] {
  const count = Math.round((max - min) / step);
  const out: string[] = [];
  for (let i = 0; i <= count; i++) out.push(String(round2(min + i * step)));
  return out;
}

/**
 * Mobile-first searchable size picker. Taps open a bottom sheet with a search
 * box and big tap rows. Typing a value outside the list (e.g. 72.05) offers a
 * "Use …" row so custom sizes are still allowed.
 */
export function SizePickerField({
  value,
  onChange,
  min = 24,
  max = 48,
  step = 0.25,
  placeholder = "Select…",
}: {
  value: string;
  onChange: (v: string) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const options = useMemo(() => buildOptions(min, max, step), [min, max, step]);

  const pick = (v: string) => { onChange(v); setOpen(false); setSearch(""); };

  // Offer a custom row when the typed text is a valid number not already listed.
  const trimmed = search.trim();
  const isCustom = trimmed !== "" && isFinite(Number(trimmed)) && !options.includes(String(round2(Number(trimmed))));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <span className={value ? "text-foreground" : "text-muted-foreground"}>{value || placeholder}</span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </button>

      <Drawer open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSearch(""); }}>
        <DrawerContent className="max-h-[80vh]">
          <DrawerHeader className="pb-2">
            <DrawerTitle>Select size (inches)</DrawerTitle>
          </DrawerHeader>
          <Command shouldFilter className="px-2 pb-4">
            <CommandInput
              value={search}
              onValueChange={setSearch}
              placeholder="Search or type a size…"
              inputMode="decimal"
              autoFocus
            />
            <CommandList className="max-h-[55vh]">
              {isCustom && (
                <CommandItem value={trimmed} onSelect={() => pick(String(round2(Number(trimmed))))} className="py-3 text-base">
                  Use “{trimmed}”
                </CommandItem>
              )}
              <CommandEmpty>No match. Type a number to use a custom size.</CommandEmpty>
              <CommandGroup>
                {options.map((o) => (
                  <CommandItem key={o} value={o} onSelect={() => pick(o)} className="py-3 text-base">
                    <Check className={`mr-2 h-4 w-4 ${value === o ? "opacity-100" : "opacity-0"}`} />
                    {o}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </DrawerContent>
      </Drawer>
    </>
  );
}
