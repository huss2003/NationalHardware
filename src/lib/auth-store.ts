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
    return;
  }
  // Look up admin role; everyone else is treated as employee in this UI.
  let role: ShopRole = "employee";
  try {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", supaUser.id);
    if (data?.some((r) => r.role === "admin")) role = "admin";
  } catch {}
  const name =
    (supaUser.user_metadata?.display_name as string | undefined) ||
    supaUser.email?.split("@")[0] ||
    "User";
  useAuth.setState({
    user: { id: supaUser.id, name, role },
    ready: true,
  });
}

let listenerInited = false;
export function initAuthListener() {
  if (typeof window === "undefined" || listenerInited) return;
  listenerInited = true;
  // Listener FIRST so we don't miss the initial event.
  supabase.auth.onAuthStateChange((_event, session) => {
    void hydrate(session?.user ?? null);
  });
  supabase.auth.getSession().then(({ data }) => {
    void hydrate(data.session?.user ?? null);
  });
}

export async function ensureDeviceSession() {
  return;
}
