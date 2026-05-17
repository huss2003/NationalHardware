import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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

type Line = { product_id: string; name: string; qty: number; rate: number; gst_rate: number };

function NewPurchase() {
  const nav = useNavigate();
  const user = useAuth(s => s.user);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [billNo, setBillNo] = useState("");
  const [billDate, setBillDate] = useState(new Date().toISOString().slice(0,10));
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [billFile, setBillFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const [s, p] = await Promise.all([
        supabase.from("suppliers").select("*").order("name"),
        supabase.from("products").select("*").eq("active", true).order("name"),
      ]);
      setSuppliers(s.data ?? []); setProducts(p.data ?? []);
    })();
  }, []);

  const addProduct = (p: any) => {
    if (lines.find(l => l.product_id === p.id)) return;
    setLines([...lines, { product_id: p.id, name: p.name, qty: 1, rate: Number(p.default_cost), gst_rate: Number(p.gst_rate) }]);
  };
  const upd = (i: number, patch: Partial<Line>) => setLines(lines.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  const rm = (i: number) => setLines(lines.filter((_, idx) => idx !== i));

  const subtotal = lines.reduce((a, l) => a + l.qty * l.rate, 0);
  const tax = lines.reduce((a, l) => a + (l.qty * l.rate * l.gst_rate / 100), 0);
  const total = subtotal + tax;

  const save = async () => {
    if (lines.length === 0) { toast.error("Add at least one product"); return; }
    setBusy(true);
    try {
      let billUrl: string | null = null;
      if (billFile) {
        const path = `${Date.now()}-${billFile.name}`;
        const { error: upErr } = await supabase.storage.from("bill-images").upload(path, billFile);
        if (upErr) throw upErr;
        billUrl = path;
      }
      const { data: pur, error: pErr } = await supabase.from("purchases").insert({
        supplier_id: supplierId || null, bill_no: billNo, bill_date: billDate,
        bill_image_url: billUrl, notes, subtotal, tax_total: tax, grand_total: total,
        created_by: user?.id,
      }).select().single();
      if (pErr) throw pErr;

      for (const l of lines) {
        const { data: pi, error: piErr } = await supabase.from("purchase_items").insert({
          purchase_id: pur.id, product_id: l.product_id, qty: l.qty, rate: l.rate,
          gst_rate: l.gst_rate, line_total: l.qty * l.rate,
        }).select().single();
        if (piErr) throw piErr;
        const { error: mErr } = await supabase.rpc("mint_item_instances", { _purchase_item_id: pi.id, _actor_user_id: user?.id });
        if (mErr) throw mErr;
      }
      toast.success("Purchase saved & units minted");
      nav({ to: "/purchases/$id", params: { id: pur.id } });
    } catch (e: any) {
      toast.error(e.message);
    } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title="New purchase" subtitle="Create a bill and mint individual units" />
      <div className="px-8 pb-8 grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="p-5 space-y-3 lg:col-span-2">
          <div className="grid grid-cols-2 gap-3">
            <select className="h-12 rounded-md border bg-background px-3 text-base" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">-- Supplier --</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <Input className="h-12" placeholder="Bill number" value={billNo} onChange={(e) => setBillNo(e.target.value)} />
            <Input className="h-12" type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} />
            <Input className="h-12" type="file" accept="image/*" onChange={(e) => setBillFile(e.target.files?.[0] ?? null)} />
          </div>

          <div>
            <div className="font-bold mb-2">Add products</div>
            <div className="flex flex-wrap gap-2 max-h-40 overflow-auto p-2 border rounded-lg">
              {products.map(p => (
                <button key={p.id} type="button" onClick={() => addProduct(p)} className="px-3 py-2 rounded-lg border hover:bg-muted text-sm font-semibold">
                  {p.name} <span className="text-muted-foreground">({p.prefix})</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="flex items-center gap-2 p-3 border rounded-xl">
                <div className="flex-1 font-bold">{l.name}</div>
                <Button size="icon" variant="outline" onClick={() => upd(i, { qty: Math.max(1, l.qty - 1) })}><Minus className="h-4 w-4" /></Button>
                <Input className="w-20 h-10 text-center" type="number" value={l.qty} onChange={(e) => upd(i, { qty: Math.max(1, Number(e.target.value)) })} />
                <Button size="icon" variant="outline" onClick={() => upd(i, { qty: l.qty + 1 })}><Plus className="h-4 w-4" /></Button>
                <Input className="w-28 h-10" type="number" value={l.rate} onChange={(e) => upd(i, { rate: Number(e.target.value) })} placeholder="Rate" />
                <Input className="w-20 h-10" type="number" value={l.gst_rate} onChange={(e) => upd(i, { gst_rate: Number(e.target.value) })} placeholder="GST" />
                <div className="w-28 text-right font-bold">{inr(l.qty * l.rate)}</div>
                <Button size="icon" variant="ghost" onClick={() => rm(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            ))}
          </div>

          <Input placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Card>

        <Card className="p-5 space-y-3 h-fit sticky top-4">
          <div className="flex justify-between"><span>Subtotal</span><span className="font-bold">{inr(subtotal)}</span></div>
          <div className="flex justify-between"><span>GST</span><span className="font-bold">{inr(tax)}</span></div>
          <div className="flex justify-between text-xl"><span>Total</span><span className="font-extrabold">{inr(total)}</span></div>
          <Button className="w-full h-14 text-lg" disabled={busy} onClick={save}>Save & mint labels</Button>
        </Card>
      </div>
    </>
  );
}
