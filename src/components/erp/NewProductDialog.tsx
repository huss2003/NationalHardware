import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { inr, makeQrDataUrl } from "@/lib/codes";
import { SubCategoryPicker, type SubCategory } from "@/components/erp/SubCategoryPicker";

export type NewCat = "plywood" | "hardware" | "door" | "mica" | "other";
const prefixForCat = (c: NewCat) =>
  c === "plywood" ? "PLY" : c === "hardware" ? "HDR" : c === "door" ? "DOR" : c === "mica" ? "MIC" : "OTH";
const hasDimensions = (c: NewCat) => c === "plywood" || c === "door";

/** Parse "8*4" / "8x4" / "8 X 4" style tokens out of a sub-category name. */
function parseDims(label?: string | null): { l: number; w: number } | null {
  if (!label) return null;
  const m = label.match(/(\d+(?:\.\d+)?)\s*[x*×]\s*(\d+(?:\.\d+)?)/i);
  if (!m) return null;
  return { l: Number(m[1]), w: Number(m[2]) };
}

export type NewProductDialogDefaults = {
  category?: NewCat;
  subcategory?: SubCategory | null;
  /** Free-form size label for hardware/mica/other, OR a dimension label like "8*4" to parse. */
  size?: string | null;
  name?: string;
};

export function NewProductDialog({
  onCreated,
  open: openProp,
  onOpenChange,
  trigger,
  defaults,
}: {
  onCreated: (product?: any) => void;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
  trigger?: ReactNode;
  defaults?: NewProductDialogDefaults;
}) {
  const [openUn, setOpenUn] = useState(false);
  const controlled = openProp !== undefined;
  const open = controlled ? !!openProp : openUn;
  const setOpen = (o: boolean) => { if (!controlled) setOpenUn(o); onOpenChange?.(o); };

  const [name, setName] = useState("");
  const [category, setCategory] = useState<NewCat>("plywood");
  const [subcategory, setSubcategory] = useState<SubCategory | null>(null);
  const [length, setLength] = useState<number>(0);
  const [width, setWidth] = useState<number>(0);
  const [areaInput, setAreaInput] = useState<number>(0);
  const [size, setSize] = useState("");
  const [pricePerSqft, setPricePerSqft] = useState<number>(0);
  const [pricePerPc, setPricePerPc] = useState<number>(0);
  const [qty, setQty] = useState<number>(1);
  const [unit, setUnit] = useState("");            // "" = auto from category
  const [reorderLevel, setReorderLevel] = useState<number>(5);
  const [qrUrl, setQrUrl] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const effectiveUnit = unit.trim() || (hasDimensions(category) ? "sheet" : "pcs");

  const dimUnit: "ft" | "in" = category === "door" ? "in" : "ft";
  const toSqft = (l: number, w: number) => (category === "door" ? (l * w) / 144 : l * w);

  const computedArea = hasDimensions(category) && length && width ? toSqft(length, width) : 0;
  const areaSqft = hasDimensions(category)
    ? (computedArea > 0 ? computedArea : Number(areaInput || 0))
    : 0;
  const sizeLabel = hasDimensions(category)
    ? (length && width ? `${length}x${width} ${dimUnit}` : (areaSqft ? `${areaSqft.toFixed(2)} sqft` : ""))
    : size;
  const unitPrice = hasDimensions(category)
    ? Number(pricePerSqft || 0) * areaSqft
    : Number(pricePerPc || 0);

  const qrPayload = useMemo(() => ({ name, category, size: sizeLabel }), [name, category, sizeLabel]);

  useEffect(() => {
    let cancelled = false;
    if (!name) { setQrUrl(""); return; }
    makeQrDataUrl(qrPayload).then((u) => { if (!cancelled) setQrUrl(u); });
    return () => { cancelled = true; };
  }, [qrPayload, name]);

  const reset = () => {
    setName(""); setCategory("plywood"); setLength(0); setWidth(0);
    setAreaInput(0); setSize(""); setPricePerSqft(0); setPricePerPc(0); setQty(1); setUnit(""); setReorderLevel(5); setQrUrl("");
    setSubcategory(null);
  };

  // Apply defaults each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    reset();
    if (!defaults) return;
    const cat = (defaults.category ?? (defaults.subcategory?.category as NewCat) ?? "plywood") as NewCat;
    setCategory(cat);
    if (defaults.subcategory) {
      setSubcategory(defaults.subcategory);
      if (hasDimensions(cat) && defaults.subcategory.default_price_per_sqft) {
        setPricePerSqft(Number(defaults.subcategory.default_price_per_sqft));
      }
      if (!hasDimensions(cat) && defaults.subcategory.default_price_per_pc) {
        setPricePerPc(Number(defaults.subcategory.default_price_per_pc));
      }
    }
    if (defaults.name) setName(defaults.name);
    if (defaults.size) {
      const dims = parseDims(defaults.size) ?? parseDims(defaults.subcategory?.name);
      if (hasDimensions(cat) && dims) {
        setLength(dims.l); setWidth(dims.w);
      } else {
        setSize(defaults.size);
      }
    } else {
      const dims = parseDims(defaults.subcategory?.name);
      if (hasDimensions(cat) && dims) { setLength(dims.l); setWidth(dims.w); }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (hasDimensions(category) && length && width) {
      setAreaInput(Number(toSqft(length, width).toFixed(4)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [length, width, category]);

  const onAreaChange = (val: number) => {
    setAreaInput(val);
    if (length > 0 && val > 0) {
      const newW = category === "door" ? (val * 144) / length : val / length;
      setWidth(Number(newW.toFixed(4)));
    }
  };

  const submit = async () => {
    if (!name.trim()) return toast.error("Name is required");
    if (!subcategory) return toast.error("Sub-category is required");
    if (hasDimensions(category)) {
      if (!areaSqft) return toast.error("Enter length & breadth or area (sqft)");
      if (!pricePerSqft) return toast.error("Price per sqft is required");
    } else {
      if (!size.trim()) return toast.error("Size is required");
      if (!pricePerPc) return toast.error("Price is required");
    }
    if (qty < 1) return toast.error("Quantity must be at least 1");

    setBusy(true);
    try {
      const prefix = prefixForCat(category);
      const dbCategory: any = category;
      const { data: prod, error: pErr } = await supabase
        .from("products")
        .insert({
          name: name.trim(),
          category: dbCategory,
          prefix,
          unit: effectiveUnit,
          default_cost: unitPrice,
          default_price: unitPrice,
          gst_rate: 18,
          reorder_level: Number(reorderLevel) || 0,
          subcategory_id: subcategory.id,
        } as any)
        .select()
        .single();
      if (pErr) throw pErr;

      const { data: userRes } = await supabase.auth.getUser();
      const actorId = userRes?.user?.id ?? null;
      const isLot = category === "hardware";

      if (isLot) {
        const { data: nid, error: nErr } = await supabase.rpc("next_item_id", { _prefix: prefix });
        if (nErr) throw nErr;
        const newId = nid as unknown as string;
        const qr: any = { id: newId, name: name.trim(), category, size: sizeLabel, status: "available", lot: true };
        const { error: iErr } = await supabase.from("item_instances").insert({
          id: newId, product_id: prod.id, status: "available", cost_price: unitPrice,
          barcode_payload: newId, qr_payload: qr, is_lot: true, qty_on_hand: qty,
        } as any);
        if (iErr) throw iErr;
        await supabase.from("item_history").insert({
          item_id: newId, event: "purchased" as any, actor_user_id: actorId,
          notes: `Initial stock +${qty}`,
        } as any);
      } else {
        for (let i = 0; i < qty; i++) {
          const { data: nid, error: nErr } = await supabase.rpc("next_item_id", { _prefix: prefix });
          if (nErr) throw nErr;
          const newId = nid as unknown as string;
          const qr: any = { id: newId, name: name.trim(), category, size: sizeLabel, status: "available" };
          if (hasDimensions(category)) {
            if (category === "door") { qr.length_in = Number(length) || null; qr.width_in = Number(width) || null; }
            else { qr.length_ft = Number(length) || null; qr.width_ft = Number(width) || null; }
            qr.area_sqft = Number(areaSqft.toFixed(2));
          }
          const { error: iErr } = await supabase.from("item_instances").insert({
            id: newId, product_id: prod.id, status: "available", cost_price: unitPrice,
            barcode_payload: newId, qr_payload: qr, is_lot: false, qty_on_hand: 1,
            length_value: hasDimensions(category) ? (Number(length) || null) : null,
            width_value: hasDimensions(category) ? (Number(width) || null) : null,
            area_sqft: hasDimensions(category) ? Number(areaSqft.toFixed(2)) : null,
            dimension_unit: hasDimensions(category) ? dimUnit : null,
          } as any);
          if (iErr) throw iErr;
          await supabase.from("item_history").insert({
            item_id: newId, event: "purchased" as any, actor_user_id: actorId,
            notes: "Initial stock",
          } as any);
        }
      }

      toast.success(`Created ${name} with ${qty} unit${qty > 1 ? "s" : ""}`);
      setOpen(false); reset(); onCreated(prod);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to create product");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      {trigger !== null && (
        <DialogTrigger asChild>
          {trigger ?? <Button className="h-12"><Plus className="mr-1 h-5 w-5" />New product</Button>}
        </DialogTrigger>
      )}
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>New product</DialogTitle></DialogHeader>
        <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
          <div>
            <Label className="text-xs">Category</Label>
            <select
              className="h-10 rounded-md border bg-background px-3 w-full text-sm"
              value={category}
              onChange={(e) => { setCategory(e.target.value as NewCat); setSubcategory(null); }}
            >
              <option value="plywood">Plywood</option>
              <option value="hardware">Hardware</option>
              <option value="door">Door</option>
              <option value="mica">Mica</option>
              <option value="other">Others</option>
            </select>
          </div>
          <div>
            <Label className="text-xs">Sub-Category</Label>
            <SubCategoryPicker
              value={subcategory}
              onChange={(s) => {
                setSubcategory(s);
                if (s) {
                  if (hasDimensions(category) && s.default_price_per_sqft && !pricePerSqft) {
                    setPricePerSqft(Number(s.default_price_per_sqft));
                  }
                  if (!hasDimensions(category) && s.default_price_per_pc && !pricePerPc) {
                    setPricePerPc(Number(s.default_price_per_pc));
                  }
                }
              }}
              category={category}
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              e.g. "18MM 8*4 LC" — items like Blackhud / Comet / Velocity live under this sub-category.
            </p>
          </div>
          <div>
            <Label className="text-xs">Item / Brand Name</Label>
            <Input placeholder="e.g. Blackhud, Comet, Velocity…" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          {hasDimensions(category) ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Length ({dimUnit})</Label>
                  <Input type="number" min={0} step="0.01" value={length || ""} onChange={(e) => setLength(Number(e.target.value))} />
                </div>
                <div>
                  <Label className="text-xs">Breadth ({dimUnit})</Label>
                  <Input type="number" min={0} step="0.01" value={width || ""} onChange={(e) => setWidth(Number(e.target.value))} />
                </div>
              </div>
              <div>
                <Label className="text-xs">
                  Area (sqft) — alternate unit
                  <span className="ml-1 text-muted-foreground font-normal">
                    {category === "door" ? "(L × B ÷ 144)" : "(L × B)"}
                  </span>
                </Label>
                <Input type="number" min={0} step="0.01" value={areaInput || ""} onChange={(e) => onAreaChange(Number(e.target.value))} />
              </div>
            </>
          ) : (
            <div>
              <Label className="text-xs">Size</Label>
              <Input placeholder="e.g. 4 inch, M8x50, 1mm" value={size} onChange={(e) => setSize(e.target.value)} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {hasDimensions(category) ? (
              <div>
                <Label className="text-xs">Price per sqft (₹)</Label>
                <Input type="number" min={0} step="0.01" value={pricePerSqft || ""} onChange={(e) => setPricePerSqft(Number(e.target.value))} />
              </div>
            ) : (
              <div>
                <Label className="text-xs">Price per pc (₹)</Label>
                <Input type="number" min={0} step="0.01" value={pricePerPc || ""} onChange={(e) => setPricePerPc(Number(e.target.value))} />
              </div>
            )}
            <div>
              <Label className="text-xs">Quantity (PCS)</Label>
              <Input type="number" min={1} step={1} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} />
            </div>
            <div>
              <Label className="text-xs">Unit</Label>
              <Input list="unit-options" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder={effectiveUnit} />
              <datalist id="unit-options">
                {["sheet", "piece", "sqft", "dozen", "running-foot", "box", "kg"].map((u) => <option key={u} value={u} />)}
              </datalist>
            </div>
            <div>
              <Label className="text-xs">Reorder level</Label>
              <Input type="number" min={0} step={1} value={reorderLevel} onChange={(e) => setReorderLevel(Math.max(0, Number(e.target.value) || 0))} />
            </div>
          </div>

          {hasDimensions(category) && areaSqft > 0 && (
            <div className="text-xs text-muted-foreground">
              Area per unit: <span className="font-semibold text-foreground">{areaSqft.toFixed(2)} sqft</span>
              {" • "}Unit price: <span className="font-semibold text-foreground">{inr(unitPrice)}</span>
            </div>
          )}

          <div className="rounded-md border border-border/60 p-3 flex items-center gap-3 bg-muted/30">
            <div className="h-24 w-24 shrink-0 grid place-items-center bg-background rounded border border-border/60">
              {qrUrl ? (
                <img src={qrUrl} alt="QR preview" className="h-24 w-24" />
              ) : (
                <span className="text-[10px] text-muted-foreground text-center px-1">QR preview</span>
              )}
            </div>
            <div className="text-xs space-y-0.5 min-w-0 flex-1">
              <div className="text-muted-foreground uppercase tracking-wider text-[10px] font-semibold">QR value</div>
              <div className="font-mono break-all">{JSON.stringify(qrPayload)}</div>
            </div>
          </div>

          <Button className="w-full h-12" onClick={submit} disabled={busy}>
            {busy ? "Creating…" : "Create"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}