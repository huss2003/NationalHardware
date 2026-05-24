import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const USERS: Array<{ email: string; password: string; name: string }> = [
  { email: "Admin@gmail.com", password: "PASS001", name: "Admin" },
  { email: "Altaf@gmail.com", password: "PASS002", name: "Altaf" },
  { email: "Naeem@gmail.com", password: "PASS003", name: "Naeem" },
  { email: "Hussain@gmail.com", password: "PASS004", name: "Hussain" },
  { email: "Ayais@gmail.com", password: "PASS005", name: "Ayais" },
  { email: "Talib@gmail.com", password: "PASS006", name: "Talib" },
  { email: "Taiyeb@gmail.com", password: "PASS007", name: "Taiyeb" },
];

export const seedShopUsers = createServerFn({ method: "POST" }).handler(
  async () => {
    const results: Array<{ email: string; ok: boolean; info: string }> = [];
    for (const u of USERS) {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { display_name: u.name },
      });
      if (error) {
        results.push({ email: u.email, ok: false, info: error.message });
      } else {
        results.push({ email: u.email, ok: true, info: data.user?.id ?? "" });
      }
    }
    // Promote the Admin account to admin role.
    const admin = results.find((r) => r.email === "Admin@gmail.com" && r.ok);
    if (admin) {
      await supabaseAdmin
        .from("user_roles")
        .upsert(
          { user_id: admin.info, role: "admin" as const },
          { onConflict: "user_id,role" },
        );
    }
    return { results };
  },
);