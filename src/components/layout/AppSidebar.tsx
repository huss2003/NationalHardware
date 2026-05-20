import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Boxes, ShoppingCart, Receipt, Factory,
  BarChart3, Users, Bell, Settings, Layers, ScanLine, Wrench,
} from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { useUiConfig } from "@/lib/ui-config";

const items = [
  { key: "dashboard",  to: "/dashboard",       label: "Dashboard",  icon: LayoutDashboard },
  { key: "inventory",  to: "/inventory",       label: "Inventory",  icon: Boxes },
  { key: "scan",       to: "/inventory/scan",  label: "Scan",       icon: ScanLine },
  { key: "purchases",  to: "/purchases",       label: "Purchases",  icon: ShoppingCart },
  { key: "sales",      to: "/sales",           label: "Sales",      icon: Receipt },
  { key: "production", to: "/production",      label: "Production", icon: Factory },
  { key: "bom",        to: "/bom",             label: "BOM",        icon: Layers },
  { key: "reports",    to: "/reports",         label: "Reports",    icon: BarChart3 },
  { key: "employees",  to: "/employees",       label: "Employees",  icon: Users },
  { key: "alerts",     to: "/alerts",          label: "Alerts",     icon: Bell },
  { key: "settings",   to: "/settings",        label: "Settings",   icon: Settings },
  { key: "dev",        to: "/dev",             label: "Dev tools",  icon: Wrench },
] as const;

export function AppSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const cfg = useUiConfig();

  // Settings tile is always visible so users can re-enable hidden modules.
  const visible = items.filter((it) => it.key === "settings" || cfg.nav[it.key] !== false);

  // Pick the single best-matching nav item (longest `to` that matches the
  // current pathname) so nested routes don't highlight two tiles at once.
  const activeTo = visible
    .map((it) => it.to)
    .filter((to) => pathname === to || pathname.startsWith(to + "/"))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <aside className="w-60 shrink-0 bg-sidebar text-sidebar-foreground flex flex-col min-h-screen border-r border-sidebar-border sticky top-0 h-screen">
      <div className="px-5 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-primary grid place-content-center text-primary-foreground text-sm font-semibold">
            S
          </div>
          <div>
            <div className="text-[15px] font-semibold tracking-tight leading-tight text-foreground">ScanFlow</div>
            <div className="text-[11px] text-muted-foreground leading-tight">ERP</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {visible.map((it) => {
          const active = it.to === activeTo;
          return (
            <Link key={it.to} to={it.to} className="sidebar-link" data-active={active}>
              <it.icon className="h-5 w-5" />
              <span>{it.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-sidebar-border">
        {user && (
          <div className="mb-3">
            <div className="text-xs opacity-60">Signed in as</div>
            <div className="font-bold text-lg">{user.name}</div>
            <div className="text-xs uppercase opacity-70">{user.role}</div>
          </div>
        )}
        <Button variant="secondary" className="w-full" onClick={logout}>Switch user</Button>
      </div>
    </aside>
  );
}
