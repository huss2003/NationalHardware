import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/erp/PageHeader";
import { Plus, Package } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/inventory")({ component: Inventory });

function Inventory() {
  const [products, setProducts] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [q, setQ] = useState("");
  const nav = useNavigate();

  const load = async () => {
    const { data: prods } = await supabase.from("products").select("*").eq("active", true).order("name");
    const { data: items } = await supabase.from("item_instances").select("product_id").eq("status", "available");
    const c: Record<string, number> = {};
    (items ?? []).forEach((i: any) => { c[i.product_id] = (c[i.product_id] ?? 0) + 1; });
    setProducts(prods ?? []);
    setCounts(c);
  };
  useEffect(() => { load(); }, []);

  const filtered = products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()) || (p.sku ?? "").toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <PageHeader
        title="Inventory"
        subtitle={`${products.length} products • tap a card to view units`}
        actions={
          <>
            <Button asChild variant="outline" className="h-12"><Link to="/inventory/scan">Scan unit</Link></Button>
            <NewProductDialog onCreated={load} />
          </>
        }
      />
      <div className="px-8 pb-8 space-y-4">
        <Input placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} className="h-12 max-w-md" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map((p) => {
            const count = counts[p.id] ?? 0;
            const low = count <= p.reorder_level;
            return (
              <Card key={p.id} className="p-5 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => nav({ to: "/inventory/$productId", params: { productId: p.id } })}>
                <div className="aspect-square rounded-xl bg-muted grid place-items-center overflow-hidden mb-4">
                  {p.image_url ? <img src={p.image_url} alt="" className="object-cover w-full h-full" /> : <Package className="h-16 w-16 text-muted-foreground" />}
                </div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-lg leading-tight">{p.name}</div>
                    <div className="text-xs text-muted-foreground uppercase">{p.category} • {p.prefix}</div>
                  </div>
                  <span className={`text-2xl font-extrabold ${low ? "text-destructive" : ""}`}>{count}</span>
                </div>
                {low && <div className="mt-2 text-xs font-bold text-destructive uppercase">Low stock</div>}
              </Card>
            );
          })}
          {filtered.length === 0 && (
            <Card className="p-10 col-span-full text-center text-muted-foreground">No products yet. Tap “New product”.</Card>
          )}
        </div>
      </div>
    </>
  );
}

function NewProductDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", category: "plywood", prefix: "PLY", hsn: "", gst_rate: 18, default_cost: 0, default_price: 0, reorder_level: 5, unit: "pcs" });
  const submit = async () => {
    if (!form.name || !form.prefix) { toast.error("Name and prefix required"); return; }
    const { error } = await supabase.from("products").insert({ ...form, prefix: form.prefix.toUpperCase() } as any);
    if (error) toast.error(error.message); else { toast.success("Product created"); setOpen(false); onCreated(); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="h-12"><Plus className="mr-1 h-5 w-5" />New product</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New product</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <select className="h-10 rounded-md border bg-background px-3" value={form.category} onChange={(e) => {
              const cat = e.target.value as any;
              const pref = cat === "plywood" ? "PLY" : cat === "hardware" ? "HDR" : cat === "door" ? "DOR" : "OTH";
              setForm({ ...form, category: cat, prefix: pref });
            }}>
              <option value="plywood">Plywood</option>
              <option value="hardware">Hardware</option>
              <option value="door">Door</option>
              <option value="other">Other</option>
            </select>
            <Input placeholder="Prefix" value={form.prefix} onChange={(e) => setForm({ ...form, prefix: e.target.value.toUpperCase() })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="HSN" value={form.hsn} onChange={(e) => setForm({ ...form, hsn: e.target.value })} />
            <Input type="number" placeholder="GST %" value={form.gst_rate} onChange={(e) => setForm({ ...form, gst_rate: Number(e.target.value) })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input type="number" placeholder="Default cost" value={form.default_cost} onChange={(e) => setForm({ ...form, default_cost: Number(e.target.value) })} />
            <Input type="number" placeholder="Default price" value={form.default_price} onChange={(e) => setForm({ ...form, default_price: Number(e.target.value) })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input type="number" placeholder="Reorder level" value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: Number(e.target.value) })} />
            <Input placeholder="Unit (pcs, sheet, kg)" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
          </div>
          <Button className="w-full h-12" onClick={submit}>Create</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
