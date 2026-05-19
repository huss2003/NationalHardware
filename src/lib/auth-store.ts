import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";

export type ShopRole = "admin" | "billing" | "store" | "production";
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
  logout: () => Promise<void>;
}

export const useAuth = create<AuthState>()((set) => ({
  user: null,
  ready: false,
  setUser: (user) => set({ user }),
  setReady: (ready) => set({ ready }),
  logout: async () => {
    await supabase.auth.signOut();
    set({ user: null });
  },
}));

async function hydrateFromSession(userId: string, email: string | null) {
  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
  ]);
  const roleList = (roles ?? []).map((r: any) => r.role as ShopRole);
  const role: ShopRole =
    roleList.includes("admin") ? "admin" :
    roleList[0] ?? "billing";
  useAuth.setState({
    user: {
      id: userId,
      name: profile?.display_name ?? email?.split("@")[0] ?? "User",
      role,
    },
    ready: true,
  });
}

let initialized = false;
export function initAuthListener() {
  if (initialized) return;
  initialized = true;
  supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      void hydrateFromSession(session.user.id, session.user.email ?? null);
    } else {
      useAuth.setState({ user: null, ready: true });
    }
  });
  supabase.auth.getSession().then(({ data }) => {
    if (data.session?.user) {
      void hydrateFromSession(data.session.user.id, data.session.user.email ?? null);
    } else {
      useAuth.setState({ ready: true });
    }
  });
}

// Back-compat shim — no longer needed but kept so old call sites don't crash.
export async function ensureDeviceSession() {
  return;
}
