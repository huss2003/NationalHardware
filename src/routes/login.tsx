import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, setStoredRole, type ShopRole } from "@/lib/auth-store";
import { startDeviceSession } from "@/lib/device-session.functions";
import { EMPLOYEE_HOME } from "@/lib/roles";
import { toast } from "sonner";
import { UserRound, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

const ADMIN_CODE = "515253";

function LoginPage() {
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);
  const startSession = useServerFn(startDeviceSession);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<null | "employee" | "admin">(null);

  useEffect(() => {
    if (user) navigate({ to: user.role === "admin" ? "/dashboard" : EMPLOYEE_HOME });
  }, [user, navigate]);

  const signIn = async (role: ShopRole) => {
    // Set the role first so the auth listener hydrates with the right identity.
    setStoredRole(role);
    const { access_token, refresh_token } = await startSession();
    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
    if (error) throw error;
  };

  const loginEmployee = async () => {
    setBusy("employee");
    try {
      await signIn("employee");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setBusy(null);
    }
  };

  const loginAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim() !== ADMIN_CODE) {
      toast.error("Incorrect admin code");
      return;
    }
    setBusy("admin");
    try {
      await signIn("admin");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-[oklch(0.18_0.03_260)] to-[oklch(0.25_0.08_280)] p-6">
      <Card className="w-full max-w-md p-8 space-y-7 shadow-2xl">
        <div className="text-center">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">ScanFlow</div>
          <h1 className="text-3xl font-extrabold mt-1">Welcome</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Choose how you want to sign in.
          </p>
        </div>

        <div className="space-y-2">
          <Button
            type="button"
            className="w-full h-12 gap-2 text-base"
            disabled={busy !== null}
            onClick={loginEmployee}
          >
            <UserRound className="h-5 w-5" />
            {busy === "employee" ? "Signing in…" : "Continue as Employee"}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            No password needed — view and create entries.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs uppercase tracking-wide text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={loginAdmin} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="admin-code" className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4" /> Admin code
            </Label>
            <Input
              id="admin-code"
              type="password"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter admin code"
              autoComplete="off"
            />
          </div>
          <Button
            type="submit"
            variant="secondary"
            className="w-full h-11"
            disabled={busy !== null}
          >
            {busy === "admin" ? "Signing in…" : "Login as Admin"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
