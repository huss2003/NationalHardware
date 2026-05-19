import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || password.length < 6) {
      toast.error("Email and 6+ character password required");
      return;
    }
    setBusy(true);
    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: { display_name: displayName || email.split("@")[0] },
        },
      });
      setBusy(false);
      if (error) { toast.error(error.message); return; }
      toast.success("Account created — check your email if confirmation is required.");
      navigate({ to: "/dashboard" });
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) { toast.error(error.message); return; }
      toast.success("Welcome back");
      navigate({ to: "/dashboard" });
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-[oklch(0.18_0.03_260)] to-[oklch(0.25_0.08_280)] p-6">
      <Card className="w-full max-w-md p-8 space-y-6 shadow-2xl">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Warehouse OS</div>
          <h1 className="text-3xl font-extrabold">{mode === "signup" ? "Create account" : "Sign in"}</h1>
        </div>
        <form onSubmit={submit} className="space-y-4">
          {mode === "signup" && (
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name" className="h-12" />
          )}
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="h-12" autoComplete="email" />
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="h-12" autoComplete={mode === "signup" ? "new-password" : "current-password"} />
          <Button type="submit" className="w-full h-12 text-lg font-bold" disabled={busy}>
            {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
          </Button>
        </form>
        <button
          type="button"
          className="w-full text-sm text-muted-foreground hover:text-foreground"
          onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
        >
          {mode === "signup" ? "Already have an account? Sign in" : "Need an account? Sign up"}
        </button>
        <p className="text-xs text-muted-foreground text-center">
          The first account created becomes the admin.
        </p>
      </Card>
    </div>
  );
}
