import { create } from "zustand";
import { persist } from "zustand/middleware";
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
  logout: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      ready: false,
      setUser: (user) => set({ user }),
      setReady: (ready) => set({ ready }),
      logout: () => set({ user: null }),
    }),
    { name: "erp-active-user", partialize: (s) => ({ user: s.user }) }
  )
);

let bootstrapping: Promise<void> | null = null;
export async function ensureDeviceSession() {
  if (typeof window === "undefined") return;
  if (bootstrapping) return bootstrapping;
  bootstrapping = (async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) console.error("device session error", error);
    }
  })();
  return bootstrapping;
}
