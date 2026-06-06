import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/erp/PageHeader";
import { useAuth } from "@/lib/auth-store";
import {
  Trash2, Plus, Minus, ArrowLeft, Building2, FileText, Calendar,
  Receipt, Upload, Package, ImageIcon, Check, Warehouse,
} from "lucide-react";
import { toast } from "sonner";
import { inr } from "@/lib/codes";
import { QuickCreatePartyDialog } from "@/components/erp/QuickCreatePartyDialog";
import { SubCategoryThenItemPicker } from "@/components/erp/SubCategoryThenItemPicker";

export const Route = createLazyFileRoute("/_app/purchases/new")({ component: NewPurchase });

type Line = {
  product_id: string;
  name: string;
  unit: string;
  qty: number;
  rate: number;
  gst_rate: number;
  godown_id: string | null;
};

function NewPurchase() {
  const nav = useNavigate();
  const user = useAuth((s) => s.user);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [godowns, setGodowns] = useState<{ id: string; name: string }[]>([]);
  const [stockGodownId, setStockGodownId] = useState<string>(""); // "" = shop floor
  const [supplierId, setSupplierId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [supplierFocus, setSupplierFocus] = useState(false);
  const [creatingSupplier, setCreatingSupplier] = useState(false);
  const [billNo, setBillNo] = useState("");
  const [billType, setBillType] = useState<"gst" | "non_gst">("gst");
  const [billDate, setBillDate] = useState(new Date().toISOString().slice(0, 10));
  const [discount, setDiscount] = useState(0);
  const [lines, setLines] = useState<Line[]>([]);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState("");
  const [billFile, setBillFile] = useState<File | null>(null);
  const supplierBoxRef = useRef<HTMLDivElement>(null);
  const [createSupplierOpen, setCreateSupplierOpen] = useState(false);
  const billFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const [s, p, g] = await Promise.all([
        supabase.from("suppliers").select("*").order("name"),
        supabase.from("products").select("*").eq("active", true).order("name"),
        supabase.from("godowns").select("id, name").eq("active", true).order("name"),
      ]);
      setSuppliers(s.data ?? []);
      setProducts(p.data ?? []);
      setGodowns((g.data ?? []) as any);
    })();
  }, []);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (supplierBoxRef.current && !supplierBoxRef.current.contains(e.target as Node)) {
        setSupplierFocus(false);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const supplierMatches = useMemo(() => {
    const q = supplierName.trim().toLowerCase();
    if (!q) return suppliers.slice(0, 8);
    return suppliers.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 8);
  }, [supplierName, suppliers]);

  const exactMatch = useMemo(
    () => suppliers.find((s) => s.name.toLowerCase() === supplierName.trim().toLowerCase()),
    [supplierName, suppliers],
  );

  const pickSupplier = (s: any) => {
    setSupplierId(s.id);
    setSupplierName(s.name);
    setSupplierFocus(false);
  };

  const createSupplier = async () => {
    const name = supplierName.trim();
    if (!name) return;
    setCreatingSupplier(true);
    try {
      const { data, error } = await supabase
        .from("suppliers")
        .insert({ name })
        .select()
        .single();
      if (error) throw error;
      setSuppliers((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      pickSupplier(data);
      toast.success("Supplier created");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCreatingSupplier(false);
    }
  };

  const addProduct = (p: any) => {
    if (lines.find((l) => l.product_id === p.id)) return;
    setLines([
      ...lines,
      {
        product_id: p.id,
        name: p.finish ? `${p.name} — ${p.finish}` : p.name,
        unit: p.unit || "pcs",
        qty: 1,
        rate: Number(p.default_cost),
        gst_rate: Number(p.gst_rate),
        godown_id: stockGodownId || null,
      },
    ]);
  };
  const upd = (i: number, patch: Partial<Line>) =>
    setLines(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const rm = (i: number) => setLines(lines.filter((_, idx) => idx !== i));

  const subtotal = lines.reduce((a, l) => a + l.qty * l.rate, 0);
  const tax =
    billType === "gst"
      ? lines.reduce((a, l) => a + (l.qty * l.rate * l.gst_rate) / 100, 0)
      : 0;
  const total = Math.max(0, subtotal - discount) + tax;

  const save = async () => {
    if (lines.length === 0) {
      toast.error("Add at least one item");
      return;
    }
    if (!supplierId) {
      toast.error("Pick or create a supplier");
      return;
    }
    if (!billNo.trim()) {
      toast.error("Invoice number is required");
      return;
    }
    if (!billDate) {
      toast.error("Invoice date is required");
      return;
    }
    setBusy(true);
    try {
      let billUrl: string | null = null;
      if (billFile) {
        const path = `${Date.now()}-${billFile.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error: upErr } = await supabase.storage
          .from("bill-images")
          .upload(path, billFile);
        if (upErr) throw upErr;
        billUrl = path;
      }
      const { data: pur, error: pErr } = await supabase
        .from("purchases")
        .insert({
          supplier_id: supplierId,
          bill_no: billNo,
          bill_date: billDate,
          notes: notes.trim() || (billType === "gst" ? "GST bill" : "Non-GST bill"),
          bill_image_url: billUrl,
          subtotal,
          tax_total: tax,
          grand_total: total,
          created_by: user?.id,
        })
        .select()
        .single();
      if (pErr) throw pErr;

      for (const l of lines) {
        const effGst = billType === "gst" ? l.gst_rate : 0;
        const { data: pi, error: piErr } = await supabase
          .from("purchase_items")
          .insert({
            purchase_id: pur.id,
            product_id: l.product_id,
            qty: l.qty,
            rate: l.rate,
            gst_rate: effGst,
            line_total: l.qty * l.rate,
          })
          .select()
          .single();
        if (piErr) throw piErr;
        const { error: mErr } = await supabase.rpc("mint_item_instances", {
          _purchase_item_id: pi.id,
          _actor_user_id: user?.id ?? "",
        });
        if (mErr) throw mErr;
        if (l.godown_id) {
          // Assign freshly minted units to the line's chosen godown
          await supabase
            .from("item_instances")
            .update({ godown_id: l.godown_id, updated_at: new Date().toISOString() })
            .eq("source_purchase_item_id", pi.id)
            .is("godown_id", null);
        }
      }
      toast.success("Purchase saved & units minted");
      nav({ to: "/purchases/$id", params: { id: pur.id } });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const itemCols = billType === "gst" ? 7 : 6;

  return (
    <>
      <PageHeader
        title="New Purchase Order"
        subtitle="Create a bill, capture supplier details, and mint individual units."
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => nav({ to: "/purchases" })}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button size="sm" disabled={busy} onClick={save} className="gap-2">
              <Check className="h-4 w-4" /> {busy ? "Saving…" : "Save Purchase"}
            </Button>
          </>
        }
      />
      <div className="px-4 sm:px-6 lg:px-8 pb-10 max-w-[1400px] mx-auto w-full">
        <div className="grid gap-5 grid-cols-1 lg:grid-cols-3">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-5">
            {/* Supplier & Bill */}
            <Card className="p-6">
              <SectionHeader
                icon={Building2}
                title="Supplier & Invoice"
                description="Link the order to a supplier and reference its bill."
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
                <div className="relative md:col-span-2" ref={supplierBoxRef}>
                  <FieldLabel>Supplier</FieldLabel>
                  <div className="flex gap-2">
                    <Input
                      className="h-10 flex-1"
                      placeholder="Start typing supplier name…"
                      value={supplierName}
                      onFocus={() => setSupplierFocus(true)}
                      onChange={(e) => {
                        setSupplierName(e.target.value);
                        setSupplierId("");
                        setSupplierFocus(true);
                      }}
                    />
                    <Button type="button" variant="outline" size="sm" className="h-10 gap-1" onClick={() => setCreateSupplierOpen(true)}>
                      <Plus className="h-4 w-4" /> New
                    </Button>
                  </div>
                  {supplierFocus &&
                    (supplierMatches.length > 0 || (supplierName.trim() && !exactMatch)) && (
                      <div className="absolute z-20 mt-1 w-full bg-popover border border-border/60 rounded-lg shadow-lg max-h-60 overflow-auto">
                        {supplierMatches.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => pickSupplier(s)}
                            className="w-full text-left px-3 py-2 hover:bg-muted text-sm"
                          >
                            {s.name}
                          </button>
                        ))}
                        {supplierName.trim() && !exactMatch && (
                          <button
                            type="button"
                            disabled={creatingSupplier}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { setSupplierFocus(false); setCreateSupplierOpen(true); }}
                            className="w-full text-left px-3 py-2 hover:bg-muted text-sm font-semibold text-primary border-t border-border/60 flex items-center gap-1"
                          >
                            <Plus className="h-4 w-4" /> Create supplier "{supplierName.trim()}"…
                          </button>
                        )}
                      </div>
                    )}
                </div>
                <div>
                  <FieldLabel icon={FileText}>Invoice number</FieldLabel>
                  <Input
                    className="h-10"
                    placeholder="INV-001"
                    value={billNo}
                    onChange={(e) => setBillNo(e.target.value)}
                  />
                </div>
                <div>
                  <FieldLabel icon={Calendar}>Invoice date</FieldLabel>
                  <Input
                    className="h-10"
                    type="date"
                    value={billDate}
                    onChange={(e) => setBillDate(e.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <FieldLabel icon={Receipt}>Bill type</FieldLabel>
                  <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-lg">
                    {([
                      { v: "gst", label: "GST Bill" },
                      { v: "non_gst", label: "Non-GST Bill" },
                    ] as const).map((o) => (
                      <button
                        key={o.v}
                        type="button"
                        onClick={() => setBillType(o.v)}
                        className={`h-9 rounded-md text-sm font-semibold transition-colors ${
                          billType === o.v
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="md:col-span-2">
                  <FieldLabel icon={Warehouse}>Stock into</FieldLabel>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setStockGodownId("")}
                      className={`h-10 rounded-md text-sm font-semibold border transition-colors ${
                        stockGodownId === ""
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-foreground border-input hover:bg-muted"
                      }`}
                    >
                      Shop floor
                    </button>
                    <select
                      className={`h-10 rounded-md border px-3 text-sm font-medium ${
                        stockGodownId
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-input"
                      }`}
                      value={stockGodownId}
                      onChange={(e) => setStockGodownId(e.target.value)}
                    >
                      <option value="">— Pick a godown —</option>
                      {godowns.map((g) => (
                        <option key={g.id} value={g.id} className="bg-background text-foreground">
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    Newly minted units will be placed in the selected location.
                  </p>
                </div>
              </div>
            </Card>

            {/* Items */}
            <Card className="p-6">
              <div className="flex items-start justify-between gap-3">
                <SectionHeader
                  icon={Package}
                  title="Line Items"
                  description="Pick a sub-category, then choose an item."
                />
              </div>
              <div className="mt-4">
                <SubCategoryThenItemPicker
                  onPickItem={(p) => addProduct(p)}
                  placeholder="Type sub-category (18MM 8*4 LC), then pick item…"
                />
              </div>

              <div className="mt-5 overflow-x-auto">
                {lines.length === 0 ? (
                  <div className="border border-dashed border-border/60 rounded-xl py-14 px-6 text-center">
                    <Package className="h-7 w-7 text-muted-foreground mx-auto mb-2" />
                    <div className="text-sm font-semibold text-foreground">No items added yet</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Use the "Add item" dropdown above to start.
                    </div>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border/60">
                        <th className="text-left font-medium py-2 pr-3">Item</th>
                        <th className="text-left font-medium py-2 px-3 w-40">Quantity</th>
                        <th className="text-left font-medium py-2 px-3 w-24">Unit</th>
                        <th className="text-left font-medium py-2 px-3 w-28">Price</th>
                        {billType === "gst" && (
                          <th className="text-left font-medium py-2 px-3 w-20">GST</th>
                        )}
                        <th className="text-left font-medium py-2 px-3 w-40">Stock into</th>
                        <th className="text-right font-medium py-2 px-3 w-28">Total</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {lines.map((l, i) => (
                        <tr key={i}>
                          <td className="py-3 pr-3 font-medium text-foreground">{l.name}</td>
                          <td className="py-3 px-3">
                            <div className="inline-flex items-center rounded-md border border-input">
                              <button
                                type="button"
                                className="h-8 w-8 grid place-items-center text-muted-foreground hover:text-foreground"
                                onClick={() => upd(i, { qty: Math.max(1, l.qty - 1) })}
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <input
                                className="h-8 w-12 text-center text-sm bg-transparent border-x border-input focus:outline-none tabular-nums"
                                type="number"
                                value={l.qty}
                                onChange={(e) =>
                                  upd(i, { qty: Math.max(1, Number(e.target.value)) })
                                }
                              />
                              <button
                                type="button"
                                className="h-8 w-8 grid place-items-center text-muted-foreground hover:text-foreground"
                                onClick={() => upd(i, { qty: l.qty + 1 })}
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <Input
                              className="h-8"
                              value={l.unit}
                              onChange={(e) => upd(i, { unit: e.target.value })}
                            />
                          </td>
                          <td className="py-3 px-3">
                            <Input
                              className="h-8 tabular-nums"
                              type="number"
                              value={l.rate}
                              onChange={(e) => upd(i, { rate: Number(e.target.value) })}
                            />
                          </td>
                          {billType === "gst" && (
                            <td className="py-3 px-3">
                              <select
                                className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
                                value={l.gst_rate}
                                onChange={(e) => upd(i, { gst_rate: Number(e.target.value) })}
                              >
                                <option value={0}>0%</option>
                                <option value={5}>5%</option>
                                <option value={12}>12%</option>
                                <option value={18}>18%</option>
                                <option value={28}>28%</option>
                              </select>
                            </td>
                          )}
                          <td className="py-3 px-3">
                            <select
                              className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
                              value={l.godown_id ?? ""}
                              onChange={(e) => upd(i, { godown_id: e.target.value || null })}
                            >
                              <option value="">Shop floor</option>
                              {godowns.map((g) => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="py-3 px-3 text-right font-semibold tabular-nums">
                            {inr(l.qty * l.rate)}
                          </td>
                          <td className="py-3 pl-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => rm(i)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </Card>

            {/* Notes & attachment */}
            <Card className="p-6">
              <SectionHeader
                icon={FileText}
                title="Notes & Attachment"
                description="Optional context and a copy of the original bill."
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
                <div>
                  <FieldLabel>Notes</FieldLabel>
                  <textarea
                    className="w-full min-h-[96px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Optional notes about this purchase…"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
                <div>
                  <FieldLabel icon={ImageIcon}>Bill image</FieldLabel>
                  <label
                    className="flex flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border bg-muted/30 hover:bg-muted/50 cursor-pointer text-center px-4 py-6 transition-colors min-h-[96px]"
                  >
                    <Upload className="h-5 w-5 text-muted-foreground" />
                    <div className="text-sm font-medium text-foreground">
                      {billFile ? billFile.name : "Click to upload"}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      PNG, JPG up to 10MB
                    </div>
                    <input
                      ref={billFileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => setBillFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                  {billFile && (
                    <div className="flex justify-end gap-2 mt-2">
                      <Button
                        type="button" size="sm" variant="outline"
                        className="h-7 px-2 text-xs"
                        onClick={() => billFileRef.current?.click()}
                      >
                        Replace
                      </Button>
                      <Button
                        type="button" size="sm" variant="ghost"
                        className="h-7 px-2 text-xs text-destructive"
                        onClick={() => {
                          setBillFile(null);
                          if (billFileRef.current) billFileRef.current.value = "";
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>

          {/* Summary sidebar */}
          <div className="space-y-5">
            <Card className="p-6 lg:sticky lg:top-6">
              <h2 className="text-lg font-semibold tracking-tight mb-1">Order Summary</h2>
              <p className="text-xs text-muted-foreground mb-5">
                Review totals before saving.
              </p>

              <dl className="space-y-3 text-sm">
                <Row label={`Items (${lines.length})`} value={inr(subtotal)} />
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Discount</dt>
                  <Input
                    className="h-8 w-28 text-right tabular-nums"
                    type="number"
                    value={discount}
                    onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))}
                  />
                </div>
                {billType === "gst" && (
                  <Row label="GST" value={inr(tax)} />
                )}
              </dl>

              <div className="border-t border-border/60 mt-5 pt-4 flex items-baseline justify-between">
                <span className="text-sm font-medium text-muted-foreground">Total</span>
                <span className="text-2xl font-semibold tracking-tight tabular-nums">
                  {inr(total)}
                </span>
              </div>

              <Button
                className="w-full mt-5 gap-2"
                size="lg"
                disabled={busy}
                onClick={save}
              >
                <Check className="h-4 w-4" />
                {busy ? "Saving…" : "Save & Mint Labels"}
              </Button>
              <Button
                variant="ghost"
                className="w-full mt-2"
                onClick={() => nav({ to: "/purchases" })}
              >
                Cancel
              </Button>
            </Card>
          </div>
        </div>
      </div>
      <QuickCreatePartyDialog
        open={createSupplierOpen}
        onOpenChange={setCreateSupplierOpen}
        kind="supplier"
        initialName={supplierName}
        onCreated={(s) => {
          setSuppliers((prev) => [...prev, s].sort((a, b) => a.name.localeCompare(b.name)));
          pickSupplier(s);
        }}
      />
    </>
  );
}

function SectionHeader({
  icon: Icon, title, description,
}: { icon: any; title: string; description?: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
    </div>
  );
}

function FieldLabel({
  icon: Icon, children,
}: { icon?: any; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {children}
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}