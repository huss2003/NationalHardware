import { create } from "zustand";

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

const STORAGE_KEY = "selected_role_user";

const DEFAULT_USER: ActiveUser = {
  id: "00000000-0000-0000-0000-000000000002",
  name: "Employee",
  role: "employee",
};

function loadFromStorage(): ActiveUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const u = JSON.parse(raw);
    if (u && (u.role === "admin" || u.role === "employee")) return u;
  } catch {}
  return null;
}

export const useAuth = create<AuthState>()((set) => ({
  user: null,
  ready: false,
  setUser: (user) => {
    if (typeof window !== "undefined") {
      if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      else localStorage.removeItem(STORAGE_KEY);
    }
    set({ user });
  },
  setReady: (ready) => set({ ready }),
  logout: () => {
    if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
    set({ user: null });
  },
}));

export function initAuthListener() {
  if (typeof window === "undefined") return;
  let u = loadFromStorage();
  if (!u) {
    u = DEFAULT_USER;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    } catch {}
  }
  useAuth.setState({ user: u, ready: true });
}

export async function ensureDeviceSession() {
  return;
}
