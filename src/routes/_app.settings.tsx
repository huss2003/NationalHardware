import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/erp/PageHeader";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { useUiConfig, saveUiConfig, type UiConfig } from "@/lib/ui-config";
import { useEffect as useEffectRC, useState as useStateRC } from "react";

export const Route = createFileRoute("/_app/settings")({ component: Settings });
function Settings() {
  const [s, setS] = useState<any>(null);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [sup, setSup] = useState({ name: "", phone: "", gstin: "", address: "", state: "" });
  const [cust, setCust] = useState({ name: "", phone: "", gstin: "", address: "", state: "" });

  const load = async () => {
    const { data } = await supabase.from("app_settings").select("*").eq("id", true).maybeSingle();
    setS(data ?? {
      shop_name: "My Shop", gstin: "", state: "", address: "",
      invoice_prefix: "INV", default_label_format: "thermal_50x25",
    });
    const sup = await supabase.from("suppliers").select("*").order("name"); setSuppliers(sup.data ?? []);
    const c = await supabase.from("customers").select("*").order("name"); setCustomers(c.data ?? []);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    const { error } = await supabase.from("app_settings").update({
      shop_name: s.shop_name, gstin: s.gstin, state: s.state, address: s.address, default_label_format: s.default_label_format, invoice_prefix: s.invoice_prefix,
    }).eq("id", true);
    if (error) toast.error(error.message); else toast.success("Settings saved");
  };

  if (!s) return <div className="p-8">Loading…</div>;
  return (
    <>
      <PageHeader title="Settings" />
      <div className="px-8 pb-8 grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="lg:col-span-2"><AppConfigPanel /></div>
        <Card className="p-5 space-y-3">
          <div className="font-bold text-lg">Shop info</div>
          <Input placeholder="Shop name" value={s.shop_name ?? ""} onChange={(e) => setS({...s, shop_name: e.target.value})} />
          <Input placeholder="GSTIN" value={s.gstin ?? ""} onChange={(e) => setS({...s, gstin: e.target.value})} />
          <Input placeholder="State" value={s.state ?? ""} onChange={(e) => setS({...s, state: e.target.value})} />
          <Input placeholder="Address" value={s.address ?? ""} onChange={(e) => setS({...s, address: e.target.value})} />
          <Input placeholder="Invoice prefix" value={s.invoice_prefix ?? ""} onChange={(e) => setS({...s, invoice_prefix: e.target.value})} />
          <select className="h-11 w-full rounded-md border bg-background px-3" value={s.default_label_format} onChange={(e) => setS({...s, default_label_format: e.target.value})}>
            <option value="thermal_50x25">Thermal 50×25mm</option>
            <option value="a4">A4 sticker sheet</option>
          </select>
          <Button onClick={save}>Save</Button>
        </Card>
        <Card className="p-5 space-y-3">
          <div className="font-bold text-lg">Suppliers</div>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Name" value={sup.name} onChange={(e) => setSup({...sup, name: e.target.value})} />
            <Input placeholder="Phone" value={sup.phone} onChange={(e) => setSup({...sup, phone: e.target.value})} />
            <Input placeholder="GSTIN" value={sup.gstin} onChange={(e) => setSup({...sup, gstin: e.target.value})} />
            <Input placeholder="State" value={sup.state} onChange={(e) => setSup({...sup, state: e.target.value})} />
            <Input className="col-span-2" placeholder="Address" value={sup.address} onChange={(e) => setSup({...sup, address: e.target.value})} />
          </div>
          <Button onClick={async () => { if (!sup.name) return; await supabase.from("suppliers").insert(sup); setSup({ name: "", phone: "", gstin: "", address: "", state: "" }); load(); }}>Add supplier</Button>
          <ul className="text-sm space-y-1 max-h-40 overflow-auto">{suppliers.map(s => <li key={s.id} className="border-b py-1">{s.name} <span className="text-muted-foreground">{s.phone}</span></li>)}</ul>
        </Card>
        <Card className="p-5 space-y-3 lg:col-span-2">
          <div className="font-bold text-lg">Customers</div>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Name" value={cust.name} onChange={(e) => setCust({...cust, name: e.target.value})} />
            <Input placeholder="Phone" value={cust.phone} onChange={(e) => setCust({...cust, phone: e.target.value})} />
            <Input placeholder="GSTIN" value={cust.gstin} onChange={(e) => setCust({...cust, gstin: e.target.value})} />
            <Input placeholder="State" value={cust.state} onChange={(e) => setCust({...cust, state: e.target.value})} />
            <Input className="col-span-2" placeholder="Address" value={cust.address} onChange={(e) => setCust({...cust, address: e.target.value})} />
          </div>
          <Button onClick={async () => { if (!cust.name) return; await supabase.from("customers").insert(cust); setCust({ name: "", phone: "", gstin: "", address: "", state: "" }); load(); }}>Add customer</Button>
          <ul className="text-sm grid grid-cols-2 gap-1 max-h-40 overflow-auto">{customers.map(c => <li key={c.id} className="border-b py-1">{c.name} <span className="text-muted-foreground">{c.phone}</span></li>)}</ul>
        </Card>
      </div>
    </>
  );
}
