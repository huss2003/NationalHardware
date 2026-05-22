import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/erp/PageHeader";
import { DetailSkeleton } from "@/components/erp/Skeletons";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { useUiConfig, saveUiConfig, type UiConfig } from "@/lib/ui-config";

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

  if (!s) return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <DetailSkeleton rows={6} />
    </div>
  );
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
        <div className="lg:col-span-2"><DoorTypesPanel /></div>
      </div>
    </>
  );
}

/* ---------- Door types management ---------- */

function DoorTypesPanel() {
  const [rows, setRows] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [rate, setRate] = useState<number>(0);

  const load = async () => {
    const { data } = await supabase.from("door_types").select("*").order("name");
    setRows(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!name.trim()) { toast.error("Name required"); return; }
    const { error } = await supabase.from("door_types").insert({ name: name.trim(), rate });
    if (error) { toast.error(error.message); return; }
    setName(""); setRate(0); load();
  };

  const updateRate = async (id: string, newRate: number) => {
    const { error } = await supabase.from("door_types").update({ rate: newRate }).eq("id", id);
    if (error) toast.error(error.message);
    else load();
  };

  const toggle = async (id: string, active: boolean) => {
    await supabase.from("door_types").update({ active }).eq("id", id);
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("door_types").delete().eq("id", id);
    load();
  };

  return (
    <Card className="p-5 space-y-3">
      <div className="font-bold text-lg">Door types & rates</div>
      <div className="text-sm text-muted-foreground">
        Used by the Door module. Vypaari orders auto-fill their price from the rate set here.
      </div>
      <div className="grid grid-cols-[1fr_160px_auto] gap-2">
        <Input placeholder="Door type name (e.g. Flush 32mm)" value={name} onChange={(e) => setName(e.target.value)} />
        <Input type="number" placeholder="Rate" value={rate} onChange={(e) => setRate(Number(e.target.value || 0))} />
        <Button onClick={add}>Add</Button>
      </div>
      <ul className="text-sm divide-y">
        {rows.map((r) => (
          <li key={r.id} className="py-2 grid grid-cols-[1fr_160px_auto_auto] gap-2 items-center">
            <span className={r.active ? "" : "text-muted-foreground line-through"}>{r.name}</span>
            <Input
              type="number"
              defaultValue={r.rate}
              onBlur={(e) => {
                const v = Number(e.target.value || 0);
                if (v !== Number(r.rate)) updateRate(r.id, v);
              }}
            />
            <Switch checked={r.active} onCheckedChange={(v) => toggle(r.id, v)} />
            <Button variant="ghost" size="sm" onClick={() => remove(r.id)}>Delete</Button>
          </li>
        ))}
        {rows.length === 0 && (
          <li className="py-3 text-muted-foreground">No door types yet. Add one above.</li>
        )}
      </ul>
    </Card>
  );
}

/* ---------- Master UI configuration panel ---------- */

function AppConfigPanel() {
  const live = useUiConfig();
  const [draft, setDraft] = useState<UiConfig | null>(null);
  const [saving, setSaving] = useState(false);
  // Re-sync draft when the live config changes (initial load).
  useEffect(() => { setDraft(JSON.parse(JSON.stringify(live))); }, [live]);

  if (!draft) return null;

  const setPath = (mutator: (d: UiConfig) => void) => {
    const next = JSON.parse(JSON.stringify(draft)) as UiConfig;
    mutator(next);
    setDraft(next);
  };

  const save = async () => {
    setSaving(true);
    try { await saveUiConfig(draft); toast.success("App configuration saved"); }
    catch (e: any) { toast.error(e.message ?? "Save failed"); }
    finally { setSaving(false); }
  };

  return (
    <Card className="p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-bold text-lg">App configuration</div>
          <div className="text-sm text-muted-foreground">
            Control which tiles, columns and form fields appear across the app. Shared by all users.
          </div>
        </div>
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save configuration"}</Button>
      </div>

      <ToggleGroup
        title="Sidebar navigation"
        entries={Object.keys(draft.nav).map((k) => ({ key: k, label: k }))}
        get={(k) => draft.nav[k] !== false}
        set={(k, v) => setPath((d) => { d.nav[k] = v; })}
      />

      <ToggleGroup
        title="Dashboard tiles"
        entries={Object.keys(draft.dashboard.tiles).map((k) => ({ key: k, label: humanize(k) }))}
        get={(k) => draft.dashboard.tiles[k] !== false}
        set={(k, v) => setPath((d) => { d.dashboard.tiles[k] = v; })}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {(["purchases","sales","production"] as const).map((list) => (
          <ToggleGroup
            key={list}
            title={`${capitalize(list)} list columns`}
            entries={Object.keys(draft.lists[list].columns).map((k) => ({ key: k, label: humanize(k) }))}
            get={(k) => draft.lists[list].columns[k] !== false}
            set={(k, v) => setPath((d) => { d.lists[list].columns[k] = v; })}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {(["new_purchase","new_sale","new_production"] as const).map((form) => (
          <FieldGroup
            key={form}
            title={`Form: ${humanize(form)}`}
            fields={draft.forms[form].fields}
            onChange={(k, patch) => setPath((d) => {
              d.forms[form].fields[k] = { ...d.forms[form].fields[k], ...patch };
            })}
          />
        ))}
      </div>
    </Card>
  );
}

function ToggleGroup({ title, entries, get, set }: {
  title: string;
  entries: { key: string; label: string }[];
  get: (k: string) => boolean;
  set: (k: string, v: boolean) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="font-semibold">{title}</div>
      <div className="grid grid-cols-2 gap-y-2 gap-x-4">
        {entries.map((e) => (
          <label key={e.key} className="flex items-center justify-between gap-3 text-sm">
            <span className="capitalize">{e.label}</span>
            <Switch checked={get(e.key)} onCheckedChange={(v) => set(e.key, v)} />
          </label>
        ))}
      </div>
    </div>
  );
}

function FieldGroup({ title, fields, onChange }: {
  title: string;
  fields: Record<string, { visible: boolean; required: boolean }>;
  onChange: (k: string, patch: Partial<{ visible: boolean; required: boolean }>) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="font-semibold">{title}</div>
      <div className="space-y-1">
        <div className="grid grid-cols-[1fr_auto_auto] gap-3 text-xs text-muted-foreground px-1">
          <span>Field</span><span>Visible</span><span>Required</span>
        </div>
        {Object.entries(fields).map(([k, v]) => (
          <div key={k} className="grid grid-cols-[1fr_auto_auto] gap-3 items-center text-sm">
            <span className="capitalize">{humanize(k)}</span>
            <Switch checked={v.visible} onCheckedChange={(val) => onChange(k, { visible: val })} />
            <Switch checked={v.required} disabled={!v.visible} onCheckedChange={(val) => onChange(k, { required: val })} />
          </div>
        ))}
      </div>
    </div>
  );
}

const humanize = (s: string) => s.replace(/_/g, " ");
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
