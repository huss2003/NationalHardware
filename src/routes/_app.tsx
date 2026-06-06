import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/lib/auth-store";
import { useEffect } from "react";
import { RoutePending } from "@/components/erp/RoutePending";
import { isPathAllowedForEmployee, EMPLOYEE_HOME } from "@/lib/roles";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const ready = useAuth((s) => s.ready);
  const user = useAuth((s) => s.user);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  useEffect(() => {
    if (ready && !user) navigate({ to: "/login" });
  }, [ready, user, navigate]);

  // Employees may only open allowlisted pages; bounce them home otherwise.
  useEffect(() => {
    if (ready && user && user.role !== "admin" && !isPathAllowedForEmployee(pathname)) {
      navigate({ to: EMPLOYEE_HOME });
    }
  }, [ready, user, pathname, navigate]);

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
