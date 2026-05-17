import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { ensureDeviceSession, useAuth } from "@/lib/auth-store";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const [ready, setReady] = useState(false);
  const user = useAuth((s) => s.user);

  useEffect(() => {
    ensureDeviceSession().then(() => setReady(true));
  }, []);

  if (!ready) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  }
  if (!user) {
    // Soft client-side gate (route guard happens via redirect on child loaders too)
    if (typeof window !== "undefined") {
      window.location.replace("/login");
    }
    return null;
  }

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
