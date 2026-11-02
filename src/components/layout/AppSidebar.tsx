import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Boxes, ShoppingCart, Receipt,
  BarChart3, Bell, Settings, ScanLine,
  Undo2, RotateCcw, Warehouse,
  DoorOpen,
  BookOpen,
  Layers,
  PackagePlus,
} from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { useUiConfig } from "@/lib/ui-config";
import { EMPLOYEE_NAV_KEYS } from "@/lib/roles";

const items = [
  { key: "dashboard",  to: "/dashboard",       label: "Dashboard",  icon: LayoutDashboard },
  { key: "inventory",  to: "/inventory",       label: "Inventory",  icon: Boxes },
  { key: "inventory2", to: "/inventory2",      label: "Inventory 2", icon: Layers },
  { key: "subcategories", to: "/inventory/subcategories", label: "Sub-Categories", icon: Layers },
  { key: "scan",       to: "/inventory/scan",  label: "Scan",       icon: ScanLine },
  { key: "stock_entry", to: "/inventory/stock-entry", label: "Stock Entry", icon: PackagePlus },
  { key: "purchases",  to: "/purchases",       label: "Purchases",  icon: ShoppingCart },
  { key: "purchase_returns", to: "/purchase-returns", label: "Purchase Returns", icon: RotateCcw },
  { key: "sales",      to: "/sales",           label: "Sales",      icon: Receipt },
  { key: "sales2",     to: "/sales2",          label: "Sales 2",    icon: Receipt },
  { key: "sales_returns",    to: "/sales-returns",    label: "Sales Returns",    icon: Undo2 },
  { key: "ledger",           to: "/ledger",           label: "Ledger",           icon: BookOpen },
  { key: "godowns",          to: "/godowns",          label: "Godowns",          icon: Warehouse },
  { key: "door",             to: "/door",             label: "Door",             icon: DoorOpen },
  { key: "reports",    to: "/reports",         label: "Reports",    icon: BarChart3 },
  { key: "alerts",     to: "/alerts",          label: "Alerts",     icon: Bell },
  { key: "settings",   to: "/settings",        label: "Settings",   icon: Settings },
] as const;

export function AppSidebar({ onNavigate }: { onNavigate?: () => void } = {}) {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const cfg = useUiConfig();

  const isEmployee = user?.role !== "admin";
  const employeeKeys = new Set<string>(EMPLOYEE_NAV_KEYS);

  // Employees only see an allowlisted set of pages. Admins see everything that
  // isn't disabled in UI config (Settings stays visible so modules can be re-enabled).
  const visible = items.filter((it) => {
    if (isEmployee) return employeeKeys.has(it.key);
    return it.key === "settings" || cfg.nav[it.key] !== false;
  });

  // Pick the single best-matching nav item (longest `to` that matches the
  // current pathname) so nested routes don't highlight two tiles at once.
  const activeTo = visible
    .map((it) => it.to)
    .filter((to) => pathname === to || pathname.startsWith(to + "/"))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <aside className="w-60 shrink-0 bg-sidebar text-sidebar-foreground flex flex-col h-full min-h-screen border-r border-sidebar-border lg:sticky lg:top-0 lg:h-screen">
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
            <Link key={it.to} to={it.to} className="sidebar-link" data-active={active} onClick={onNavigate}>
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
        <Button variant="secondary" className="w-full" onClick={() => { onNavigate?.(); logout(); }}>Sign out</Button>
      </div>
    </aside>
  );
}
