import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const USERS = [
  { email: "Admin@gmail.com", password: "PASS001", name: "Admin", admin: true },
  { email: "Altaf@gmail.com", password: "PASS002", name: "Altaf" },
  { email: "Naeem@gmail.com", password: "PASS003", name: "Naeem" },
  { email: "Hussain@gmail.com", password: "PASS004", name: "Hussain" },
  { email: "Ayais@gmail.com", password: "PASS005", name: "Ayais" },
  { email: "Talib@gmail.com", password: "PASS006", name: "Talib" },
  { email: "Taiyeb@gmail.com", password: "PASS007", name: "Taiyeb" },
] as const;

export const Route = createFileRoute("/api/public/seed-users")({
  server: {
    handlers: {
      POST: async () => {
        const results: Array<Record<string, unknown>> = [];
        for (const u of USERS) {
          const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email: u.email,
            password: u.password,
            email_confirm: true,
            user_metadata: { display_name: u.name },
          });
          if (error) {
            results.push({ email: u.email, ok: false, error: error.message });
            continue;
          }
          const userId = data.user?.id;
          results.push({ email: u.email, ok: true, id: userId });
          if (u.admin && userId) {
            await supabaseAdmin
              .from("user_roles")
              .upsert(
                { user_id: userId, role: "admin" },
                { onConflict: "user_id,role" },
              );
          }
        }
        return new Response(JSON.stringify({ results }, null, 2), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});