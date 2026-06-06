import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export type ShopRole = "admin" | "employee";
export interface ActiveUser {
  id: string;
  name: string;
  role: ShopRole;
}

interface AuthState {
  user: ActiveUser | null;
  ready: boolean;
  setUser: (u: ActiveUser | null) => void;
  setReady: (r: boolean) => void;
  logout: () => void;
}

const ROLE_KEY = "scanflow_role";

function getStoredRole(): ShopRole {
  if (typeof window === "undefined") return "employee";
  return localStorage.getItem(ROLE_KEY) === "admin" ? "admin" : "employee";
}

/** Persist the chosen role and update the active user immediately. */
export function setStoredRole(role: ShopRole) {
  if (typeof window !== "undefined") localStorage.setItem(ROLE_KEY, role);
  const u = useAuth.getState().user;
  if (u && u.role !== role) {
    useAuth.setState({ user: { ...u, role, name: role === "admin" ? "Admin" : "Employee" } });
  }
}

export const useAuth = create<AuthState>()((set) => ({
  user: null,
  ready: false,
  setUser: (user) => set({ user }),
  setReady: (ready) => set({ ready }),
  logout: () => {
    if (typeof window !== "undefined") localStorage.removeItem(ROLE_KEY);
    void supabase.auth.signOut();
    set({ user: null });
  },
}));

function hydrate(supaUser: User | null) {
  if (!supaUser) {
    useAuth.setState({ user: null, ready: true });
    return;
  }
  // Role is chosen at login time and stored on the device (admin vs employee).
  const role = getStoredRole();
  const name = role === "admin" ? "Admin" : "Employee";
  const prev = useAuth.getState().user;
  if (prev && prev.id === supaUser.id && prev.role === role && prev.name === name) {
    if (!useAuth.getState().ready) useAuth.setState({ ready: true });
    return;
  }
  useAuth.setState({
    user: { id: supaUser.id, name, role },
    ready: true,
  });
}

let listenerInited = false;
export function initAuthListener() {
  if (typeof window === "undefined" || listenerInited) return;
  listenerInited = true;
  supabase.auth.onAuthStateChange((event, session) => {
    if (
      event !== "INITIAL_SESSION" &&
      event !== "SIGNED_IN" &&
      event !== "SIGNED_OUT" &&
      event !== "USER_UPDATED"
    ) {
      return;
    }
    hydrate(session?.user ?? null);
  });
}

export async function ensureDeviceSession() {
  return;
}
