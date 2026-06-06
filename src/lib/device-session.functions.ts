import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

// Shared "device" account used behind both login modes. Every screen reads data
// that requires an authenticated Supabase session, so employee (passwordless)
// and admin logins both sign into this single account. The employee/admin
// distinction is handled on the client (see auth-store + login page).
//
// The account itself is provisioned by a migration. These credentials live only
// in the server bundle (this handler is replaced by an RPC stub in the browser),
// so the password never ships to the client.
const DEVICE_EMAIL = "device@scanflow.app";
const DEVICE_PASSWORD = "ScanFlow!Device!2026#shared";

export const startDeviceSession = createServerFn({ method: "POST" }).handler(
  async () => {
    const url = process.env.SUPABASE_URL;
    const anon = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !anon) {
      throw new Error("Supabase is not configured on the server.");
    }

    const authClient = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await authClient.auth.signInWithPassword({
      email: DEVICE_EMAIL,
      password: DEVICE_PASSWORD,
    });

    if (error || !data?.session) {
      throw new Error(error?.message || "Could not start a session.");
    }

    return {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    };
  },
);
