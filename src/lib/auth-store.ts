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

export const useAuth = create<AuthState>()((set) => ({
  user: null,
  ready: false,
  setUser: (user) => set({ user }),
  setReady: (ready) => set({ ready }),
  logout: () => {
    void supabase.auth.signOut();
    set({ user: null });
  },
}));

async function hydrate(supaUser: User | null) {
  if (!supaUser) {
    useAuth.setState({ user: null, ready: true });
    cachedRoleUserId = null;
    cachedRole = "employee";
    return;
  }
  // Look up admin role once per user; everyone else is treated as employee.
  let role: ShopRole = cachedRole;
  if (cachedRoleUserId !== supaUser.id) {
    role = await loadRole(supaUser.id);
  }
  const name =
    (supaUser.user_metadata?.display_name as string | undefined) ||
    supaUser.email?.split("@")[0] ||
    "User";
  const prev = useAuth.getState().user;
  // Skip the state update (and the app-wide re-render) when nothing changed.
  if (prev && prev.id === supaUser.id && prev.name === name && prev.role === role) {
    if (!useAuth.getState().ready) useAuth.setState({ ready: true });
    return;
  }
  useAuth.setState({
    user: { id: supaUser.id, name, role },
    ready: true,
  });
}

let cachedRoleUserId: string | null = null;
let cachedRole: ShopRole = "employee";
let rolePromiseUserId: string | null = null;
let rolePromise: Promise<ShopRole> | null = null;

async function loadRole(userId: string): Promise<ShopRole> {
  if (cachedRoleUserId === userId) return cachedRole;
  if (rolePromise && rolePromiseUserId === userId) return rolePromise;
  rolePromiseUserId = userId;
  rolePromise = (async () => {
    let role: ShopRole = "employee";
    try {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      if (data?.some((r) => r.role === "admin")) role = "admin";
    } catch {}
    cachedRoleUserId = userId;
    cachedRole = role;
    return role;
  })();
  try {
    return await rolePromise;
  } finally {
    rolePromise = null;
    rolePromiseUserId = null;
  }
}

let listenerInited = false;
export function initAuthListener() {
  if (typeof window === "undefined" || listenerInited) return;
  listenerInited = true;
  // Listener FIRST so we don't miss the initial event. Only react to real
  // identity changes — TOKEN_REFRESHED (hourly + on tab focus) keeps the same
  // user and would otherwise re-query roles and re-render the whole app.
  supabase.auth.onAuthStateChange((event, session) => {
    if (
      event !== "INITIAL_SESSION" &&
      event !== "SIGNED_IN" &&
      event !== "SIGNED_OUT" &&
      event !== "USER_UPDATED"
    ) {
      return;
    }
    void hydrate(session?.user ?? null);
  });
}

export async function ensureDeviceSession() {
  return;
}
