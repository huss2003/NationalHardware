import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Boxes, ShoppingCart, Receipt, Factory,
  BarChart3, Users, Bell, Settings, Layers, ScanLine, Wrench,
} from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";

const items = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/inventory", label: "Inventory", icon: Boxes },
  { to: "/inventory/scan", label: "Scan", icon: ScanLine },
  { to: "/purchases", label: "Purchases", icon: ShoppingCart },
  { to: "/sales", label: "Sales", icon: Receipt },
  { to: "/production", label: "Production", icon: Factory },
  { to: "/bom", label: "BOM", icon: Layers },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/employees", label: "Employees", icon: Users },
  { to: "/alerts", label: "Alerts", icon: Bell },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/dev", label: "Dev tools", icon: Wrench },
] as const;

export function AppSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);

  // Pick the single best-matching nav item (longest `to` that matches the
  // current pathname) so nested routes don't highlight two tiles at once.
  const activeTo = items
    .map((it) => it.to)
    .filter((to) => pathname === to || pathname.startsWith(to + "/"))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <aside className="w-64 shrink-0 bg-sidebar text-sidebar-foreground flex flex-col min-h-screen">
      <div className="px-6 py-6 border-b border-sidebar-border">
        <div className="text-xs uppercase tracking-widest opacity-60">Warehouse OS</div>
        <div className="text-2xl font-extrabold mt-1">Hardware ERP</div>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {items.map((it) => {
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
