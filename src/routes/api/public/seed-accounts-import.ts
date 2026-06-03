import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import importData from "@/data/accounts-import.json";

const TOKEN = "accounts-import-2026-06-03";
const NOTE = "Opening balance (Accounts import 2026-06-03)";

async function insertAll(table: string, rows: any[]) {
  if (!rows.length) return 0;
  const size = 200;
  let n = 0;
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    const { error } = await (supabaseAdmin.from(table as any) as any).insert(chunk);
    if (error) throw new Error(`${table}: ${error.message}`);
    n += chunk.length;
  }
  return n;
}

export const Route = createFileRoute("/api/public/seed-accounts-import")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("token") !== TOKEN) {
          return new Response("Forbidden", { status: 403 });
        }
        // Idempotency guard
        const { count } = await supabaseAdmin
          .from("sales")
          .select("id", { count: "exact", head: true })
          .eq("notes", NOTE);
        if ((count ?? 0) > 0) {
          return Response.json({ status: "already_imported", existing_opening_sales: count });
        }
        const d = importData as Record<string, any[]>;
        const result: Record<string, number> = {};
        try {
          result.customers = await insertAll("customers", d.customers);
          result.suppliers = await insertAll("suppliers", d.suppliers);
          result.sales = await insertAll("sales", d.sales);
          result.receipts = await insertAll("receipts", d.receipts);
          result.purchases = await insertAll("purchases", d.purchases);
          result.purchase_returns = await insertAll("purchase_returns", d.purchase_returns);
        } catch (e: any) {
          return Response.json(
            { status: "error", message: String(e?.message ?? e), partial: result },
            { status: 500 },
          );
        }
        return Response.json({ status: "ok", inserted: result });
      },
    },
  },
});