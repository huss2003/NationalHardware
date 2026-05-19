import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/erp/PageHeader";
import { useAuth } from "@/lib/auth-store";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/employees")({ component: Employees });

type Role = "admin" | "billing" | "store" | "production";

function Employees() {
  const me = useAuth(s => s.user);
  const [rows, setRows] = useState<Array<{ id: string; display_name: string | null; roles: Role[] }>>([]);

  const load = async () => {
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("id, display_name").order("display_name"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    const byUser: Record<string, Role[]> = {};
    (roles ?? []).forEach((r: any) => {
      (byUser[r.user_id] = byUser[r.user_id] ?? []).push(r.role);
    });
    setRows((profiles ?? []).map((p: any) => ({ id: p.id, display_name: p.display_name, roles: byUser[p.id] ?? [] })));
  };
  useEffect(() => { load(); }, []);

  const setRole = async (userId: string, role: Role) => {
    if (me?.role !== "admin") { toast.error("Admin only"); return; }
    const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", userId);
    if (delErr) { toast.error(delErr.message); return; }
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
    if (error) { toast.error(error.message); return; }
    toast.success("Role updated");
    load();
  };

  return (
    <>
      <PageHeader title="Employees" subtitle="Admin only — manage user roles. New users sign up via the login page." />
      <div className="px-8 pb-8">
        <Card className="p-5 overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted text-left text-sm"><tr><th className="p-3">Name</th><th className="p-3">Current role</th><th className="p-3 text-right">Change role</th></tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t">
                  <td className="p-3 font-bold">{r.display_name ?? r.id.slice(0,8)}</td>
                  <td className="p-3 uppercase text-xs font-bold">{r.roles.join(", ") || "—"}</td>
                  <td className="p-3 text-right">
                    <select
                      className="h-9 rounded-md border bg-background px-2 text-sm"
                      value={r.roles[0] ?? "billing"}
                      onChange={(e) => setRole(r.id, e.target.value as Role)}
                      disabled={me?.role !== "admin"}
                    >
                      <option value="admin">Admin</option>
                      <option value="billing">Billing</option>
                      <option value="store">Store</option>
                      <option value="production">Production</option>
                    </select>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">No users yet — invite someone to sign up.</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}
