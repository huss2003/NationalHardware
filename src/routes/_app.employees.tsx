import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/erp/PageHeader";
import { useAuth } from "@/lib/auth-store";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/employees")({ component: Employees });

function Employees() {
  const me = useAuth(s => s.user);
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", pin: "", role: "billing" });
  const load = () => supabase.from("shop_users").select("*").order("name").then(({ data }) => setRows(data ?? []));
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (me?.role !== "admin") { toast.error("Admin only"); return; }
    if (!form.name || form.pin.length < 4) { toast.error("Name + 4-digit PIN required"); return; }
    const { data: u, error } = await supabase.from("shop_users").insert({ name: form.name, role: form.role as any, pin_hash: "tmp" }).select().single();
    if (error) { toast.error(error.message); return; }
    await supabase.rpc("set_shop_user_pin", { _user_id: u.id, _pin: form.pin });
    setForm({ name: "", pin: "", role: "billing" }); load();
  };

  const resetPin = async (id: string) => {
    const pin = prompt("New PIN (4-6 digits)"); if (!pin) return;
    const { error } = await supabase.rpc("set_shop_user_pin", { _user_id: id, _pin: pin });
    if (error) toast.error(error.message); else toast.success("PIN updated");
  };

  return (
    <>
      <PageHeader title="Employees" subtitle="Admin only — staff PINs and roles" />
      <div className="px-8 pb-8 grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="p-5 space-y-3">
          <div className="font-bold">Add staff</div>
          <Input placeholder="Name" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} />
          <Input placeholder="PIN" value={form.pin} onChange={(e) => setForm({...form, pin: e.target.value})} />
          <select className="h-11 w-full rounded-md border bg-background px-3" value={form.role} onChange={(e) => setForm({...form, role: e.target.value})}>
            <option value="admin">Admin</option><option value="billing">Billing</option><option value="store">Store</option><option value="production">Production</option>
          </select>
          <Button className="w-full" onClick={add}>Add</Button>
        </Card>
        <Card className="p-5 lg:col-span-2 overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted text-left text-sm"><tr><th className="p-3">Name</th><th className="p-3">Role</th><th className="p-3">Last login</th><th></th></tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t">
                  <td className="p-3 font-bold">{r.name}</td>
                  <td className="p-3 uppercase text-xs font-bold">{r.role}</td>
                  <td className="p-3 text-sm">{r.last_login_at ? new Date(r.last_login_at).toLocaleString() : "—"}</td>
                  <td className="p-3 text-right"><Button size="sm" variant="outline" onClick={() => resetPin(r.id)}>Reset PIN</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}
