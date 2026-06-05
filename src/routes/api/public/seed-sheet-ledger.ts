import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import importData from "@/data/sheet-ledger-import.json";

const TOKEN = "sheet-ledger-2026-06-05";

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

export const Route = createFileRoute("/api/public/seed-sheet-ledger")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("token") !== TOKEN) {
          return new Response("Forbidden", { status: 403 });
        }
        const d = importData as Record<string, any>;
        const src = d.source as string;

        // Idempotency: bail if this source already imported
        const { count: existing } = await supabaseAdmin
          .from("cash_transactions")
          .select("id", { count: "exact", head: true })
          .eq("source", src);
        if ((existing ?? 0) > 0) {
          return Response.json({ status: "already_imported", existing_cash: existing });
        }

        const result: Record<string, number> = {};
        try {
          result.sales_ledger = await insertAll("sales_ledger", d.sales);
          result.purchase_ledger = await insertAll("purchase_ledger", d.purchase);
          result.cash_transactions = await insertAll("cash_transactions", d.cash);
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
