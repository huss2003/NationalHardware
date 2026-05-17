import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Delete } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ensureDeviceSession, useAuth } from "@/lib/auth-store";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const setUser = useAuth((s) => s.setUser);
  const [name, setName] = useState("Admin");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [staff, setStaff] = useState<{ name: string }[]>([]);

  useEffect(() => {
    ensureDeviceSession().then(async () => {
      const { data } = await supabase
        .from("shop_users")
        .select("name")
        .eq("active", true)
        .order("name");
      if (data) setStaff(data);
    });
  }, []);

  const press = (d: string) => setPin((p) => (p.length >= 6 ? p : p + d));
  const back = () => setPin((p) => p.slice(0, -1));

  const submit = async () => {
    if (!name || pin.length < 4) {
      toast.error("Enter name and at least 4-digit PIN");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.rpc("verify_pin", { _name: name, _pin: pin });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) { toast.error("Wrong PIN"); setPin(""); return; }
    setUser({ id: row.user_id, name: row.name, role: row.role });
    toast.success(`Welcome ${row.name}`);
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-[oklch(0.18_0.03_260)] to-[oklch(0.25_0.08_280)] p-6">
      <Card className="w-full max-w-md p-8 space-y-6 shadow-2xl">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Warehouse OS</div>
          <h1 className="text-3xl font-extrabold">Sign in with PIN</h1>
        </div>

        {staff.length > 0 ? (
          <div className="space-y-2">
            <label className="text-sm font-semibold">Staff</label>
            <select
              className="w-full h-14 rounded-xl border bg-background px-3 text-lg font-semibold"
              value={name}
              onChange={(e) => setName(e.target.value)}
            >
              {staff.map((s) => (<option key={s.name} value={s.name}>{s.name}</option>))}
            </select>
          </div>
        ) : (
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="h-14 text-lg"
          />
        )}

        <div className="h-16 rounded-xl border-2 grid place-items-center text-3xl font-mono tracking-widest">
          {pin.replace(/./g, "•") || <span className="text-muted-foreground text-base">Enter PIN</span>}
        </div>

        <div className="grid grid-cols-3 gap-3">
          {["1","2","3","4","5","6","7","8","9"].map((d) => (
            <Button key={d} variant="outline" className="h-16 text-2xl font-bold" onClick={() => press(d)}>{d}</Button>
          ))}
          <Button variant="outline" className="h-16" onClick={back}><Delete className="h-6 w-6" /></Button>
          <Button variant="outline" className="h-16 text-2xl font-bold" onClick={() => press("0")}>0</Button>
          <Button className="h-16 text-lg font-bold" disabled={busy} onClick={submit}>Enter</Button>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Default: <span className="font-mono font-semibold">Admin / 1234</span> — change in Employees.
        </p>
      </Card>
    </div>
  );
}
