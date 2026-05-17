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

export async function ensureDeviceSession() {
  // No-op: app uses public anon role with permissive RLS policies.
  return;
}
