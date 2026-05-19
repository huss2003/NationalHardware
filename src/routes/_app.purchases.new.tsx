import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/erp/PageHeader";
import { useAuth } from "@/lib/auth-store";
import { Trash2, Plus, Minus } from "lucide-react";
import { toast } from "sonner";
import { inr } from "@/lib/codes";

export const Route = createFileRoute("/_app/purchases/new")({ component: NewPurchase });

type Line = {
  product_id: string;
  name: string;
  unit: string;
  qty: number;
  rate: number;
  gst_rate: number;
};

function NewPurchase() {
  const nav = useNavigate();
  const user = useAuth((s) => s.user);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [supplierFocus, setSupplierFocus] = useState(false);
  const [creatingSupplier, setCreatingSupplier] = useState(false);
  const [billNo, setBillNo] = useState("");
  const [billType, setBillType] = useState<"gst" | "non_gst">("gst");
  const [billDate, setBillDate] = useState(new Date().toISOString().slice(0, 10));
  const [discount, setDiscount] = useState(0);
  const [lines, setLines] = useState<Line[]>([]);
  const [productPick, setProductPick] = useState("");
  const [busy, setBusy] = useState(false);
  const supplierBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const [s, p] = await Promise.all([
        supabase.from("suppliers").select("*").order("name"),
        supabase.from("products").select("*").eq("active", true).order("name"),
      ]);
      setSuppliers(s.data ?? []);
      setProducts(p.data ?? []);
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
        name: p.name,
        unit: p.unit || "pcs",
        qty: 1,
        rate: Number(p.default_cost),
        gst_rate: Number(p.gst_rate),
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
      const { data: pur, error: pErr } = await supabase
        .from("purchases")
        .insert({
          supplier_id: supplierId,
          bill_no: billNo,
          bill_date: billDate,
          notes: billType === "gst" ? "GST bill" : "Non-GST bill",
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
      <PageHeader title="New purchase" subtitle="Create a bill and mint individual units" />
      <div className="px-8 pb-8 grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="p-5 space-y-5 lg:col-span-2">
          {/* Header fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="relative" ref={supplierBoxRef}>
              <label className="text-xs font-semibold text-muted-foreground">Supplier name</label>
              <Input
                className="h-12 mt-1"
                placeholder="Start typing supplier name..."
                value={supplierName}
                onFocus={() => setSupplierFocus(true)}
                onChange={(e) => {
                  setSupplierName(e.target.value);
                  setSupplierId("");
                  setSupplierFocus(true);
                }}
              />
              {supplierFocus &&
                (supplierMatches.length > 0 || (supplierName.trim() && !exactMatch)) && (
                  <div className="absolute z-20 mt-1 w-full bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
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
                        onClick={createSupplier}
                        className="w-full text-left px-3 py-2 hover:bg-muted text-sm font-semibold text-primary border-t flex items-center gap-1"
                      >
                        <Plus className="h-4 w-4" /> Create supplier "{supplierName.trim()}"
                      </button>
                    )}
                  </div>
                )}
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Invoice number</label>
              <Input
                className="h-12 mt-1"
                placeholder="INV-001"
                value={billNo}
                onChange={(e) => setBillNo(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Bill type</label>
              <select
                className="h-12 mt-1 w-full rounded-md border bg-background px-3 text-base"
                value={billType}
                onChange={(e) => setBillType(e.target.value as "gst" | "non_gst")}
              >
                <option value="gst">GST bill</option>
                <option value="non_gst">Non-GST bill</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Invoice date</label>
              <Input
                className="h-12 mt-1"
                type="date"
                value={billDate}
                onChange={(e) => setBillDate(e.target.value)}
              />
            </div>
          </div>

          {/* Items table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="font-bold">Items</div>
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={productPick}
                onChange={(e) => {
                  const p = products.find((x) => x.id === e.target.value);
                  if (p) addProduct(p);
                  setProductPick("");
                }}
              >
                <option value="">+ Add item...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-2">Item</th>
                    <th className="text-left p-2 w-36">Quantity</th>
                    <th className="text-left p-2 w-24">Unit</th>
                    <th className="text-left p-2 w-28">Price</th>
                    {billType === "gst" && <th className="text-left p-2 w-20">GST %</th>}
                    <th className="text-right p-2 w-28">Total</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2 font-semibold">{l.name}</td>
                      <td className="p-2">
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8"
                            onClick={() => upd(i, { qty: Math.max(1, l.qty - 1) })}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <Input
                            className="h-8 w-14 text-center"
                            type="number"
                            value={l.qty}
                            onChange={(e) =>
                              upd(i, { qty: Math.max(1, Number(e.target.value)) })
                            }
                          />
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8"
                            onClick={() => upd(i, { qty: l.qty + 1 })}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                      <td className="p-2">
                        <Input
                          className="h-8"
                          value={l.unit}
                          onChange={(e) => upd(i, { unit: e.target.value })}
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          className="h-8"
                          type="number"
                          value={l.rate}
                          onChange={(e) => upd(i, { rate: Number(e.target.value) })}
                        />
                      </td>
                      {billType === "gst" && (
                        <td className="p-2">
                          <Input
                            className="h-8"
                            type="number"
                            value={l.gst_rate}
                            onChange={(e) => upd(i, { gst_rate: Number(e.target.value) })}
                          />
                        </td>
                      )}
                      <td className="p-2 text-right font-bold">{inr(l.qty * l.rate)}</td>
                      <td className="p-2">
                        <Button size="icon" variant="ghost" onClick={() => rm(i)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {lines.length === 0 && (
                    <tr>
                      <td colSpan={itemCols} className="p-6 text-center text-muted-foreground">
                        No items added
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Card>

        <Card className="p-5 space-y-3 h-fit lg:sticky lg:top-4">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span className="font-bold">{inr(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>Discount</span>
            <Input
              className="h-9 w-32 text-right"
              type="number"
              value={discount}
              onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))}
            />
          </div>
          {billType === "gst" && (
            <div className="flex justify-between">
              <span>Total GST</span>
              <span className="font-bold">{inr(tax)}</span>
            </div>
          )}
          <div className="flex justify-between text-xl border-t pt-3">
            <span>Total amount</span>
            <span className="font-extrabold">{inr(total)}</span>
          </div>
          <Button className="w-full h-14 text-lg" disabled={busy} onClick={save}>
            Save & mint labels
          </Button>
        </Card>
      </div>
    </>
  );
}