import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/lib/auth-store";
import { useEffect } from "react";
import { RoutePending } from "@/components/erp/RoutePending";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const ready = useAuth((s) => s.ready);
  const user = useAuth((s) => s.user);
  const navigate = useNavigate();

  useEffect(() => {
    if (ready && !user) navigate({ to: "/login" });
  }, [ready, user, navigate]);

  // While auth resolves, render the full app shell with a skeleton page so the
  // first paint looks like the app (no blank white flash).
  if (!ready || !user) {
    return (
      <div className="min-h-screen flex bg-background">
        <AppSidebar />
        <main className="flex-1 min-w-0">
          <RoutePending />
        </main>
      </div>
    );
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
