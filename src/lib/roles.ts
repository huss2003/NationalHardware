import type { ShopRole } from "@/lib/auth-store";

// Sidebar nav keys an employee is allowed to see. Everything else (dashboard,
// ledger, settings) is admin-only.
export const EMPLOYEE_NAV_KEYS = [
  "inventory",
  "inventory2",
  "subcategories",
  "scan",
  "purchases",
  "purchase_returns",
  "sales",
  "sales2",
  "sales_returns",
  "godowns",
  "door",
  "alerts",
] as const;

// Route prefixes an employee is allowed to open directly. Anything outside
// these (e.g. /dashboard, /ledger, /settings) redirects to /inventory.
export const EMPLOYEE_ALLOWED_PREFIXES = [
  "/inventory",
  "/inventory2",
  "/purchases",
  "/purchase-returns",
  "/sales",
  "/sales2",
  "/sales-returns",
  "/godowns",
  "/door",
  "/alerts",
] as const;

// Where each role lands after login / when blocked.
export const EMPLOYEE_HOME = "/inventory";

export function isPathAllowedForEmployee(pathname: string): boolean {
  return EMPLOYEE_ALLOWED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

export function isAdmin(role: ShopRole | undefined | null): boolean {
  return role === "admin";
}
