import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-store";
import { ShieldCheck, User } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const setUser = useAuth((s) => s.setUser);

  const pick = (role: "admin" | "employee") => {
    setUser({
      id: role === "admin" ? "00000000-0000-0000-0000-000000000001" : "00000000-0000-0000-0000-000000000002",
      name: role === "admin" ? "Admin" : "Employee",
      role,
    });
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-[oklch(0.18_0.03_260)] to-[oklch(0.25_0.08_280)] p-6">
      <Card className="w-full max-w-md p-8 space-y-6 shadow-2xl">
        <div className="text-center">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Warehouse OS</div>
          <h1 className="text-3xl font-extrabold mt-1">Who's using the app?</h1>
          <p className="text-sm text-muted-foreground mt-2">Pick a role to continue</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Button
            onClick={() => pick("admin")}
            variant="outline"
            className="h-32 flex flex-col gap-2 text-base"
          >
            <ShieldCheck className="h-8 w-8" />
            Admin
          </Button>
          <Button
            onClick={() => pick("employee")}
            variant="outline"
            className="h-32 flex flex-col gap-2 text-base"
          >
            <User className="h-8 w-8" />
            Employee
          </Button>
        </div>
      </Card>
    </div>
  );
}