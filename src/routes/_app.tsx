import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { useAuth } from "@/lib/auth-store";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);

  useEffect(() => {
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!user || !uuidRe.test(user.id)) {
      setUser({ id: "00000000-0000-0000-0000-000000000001", name: "Guest", role: "admin" });
    }
  }, [user, setUser]);

  return (
    <div className="min-h-screen flex bg-background">
      <AppSidebar />
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
      <Toaster richColors position="top-center" />
    </div>
  );
}
