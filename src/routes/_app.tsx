import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/lib/auth-store";
import { useEffect, useState } from "react";
import { RoutePending } from "@/components/erp/RoutePending";
import { isPathAllowedForEmployee, EMPLOYEE_HOME } from "@/lib/roles";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Menu } from "lucide-react";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const ready = useAuth((s) => s.ready);
  const user = useAuth((s) => s.user);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => { setMenuOpen(false); }, [pathname]);

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
        <div className="hidden lg:block">
          <AppSidebar />
        </div>
        <main className="flex-1 min-w-0">
          <RoutePending />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop / 9" landscape: persistent sidebar */}
      <div className="hidden lg:block">
        <AppSidebar />
      </div>

      {/* Mobile / tablet portrait: slide-out drawer */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-60 p-0 [&>button]:hidden">
          <AppSidebar onNavigate={() => setMenuOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile / tablet top bar with hamburger */}
        <header className="lg:hidden sticky top-0 z-30 flex items-center gap-3 h-14 px-4 bg-card/95 backdrop-blur border-b border-border">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setMenuOpen(true)}
            className="grid place-items-center h-10 w-10 -ml-2 rounded-lg text-foreground hover:bg-muted"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary grid place-content-center text-primary-foreground text-sm font-bold">
              S
            </div>
            <span className="text-[15px] font-bold tracking-tight text-foreground">ScanFlow</span>
          </div>
        </header>
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
      <Toaster richColors position="top-center" />
    </div>
  );
}
