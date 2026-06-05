import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const TOKEN = "ledger-fy2526-import-9f3a";
const SHEET = "1o0rDqfEhwYNnDxTCQdplJttw96psfjJwQ8PUc4a7Mag";
const SOURCE = "gsheet_fy2526";
const FY_START = "2025-04-01";
const FY_END = "2026-03-31";

const TYPEMAP: Record<string, string> = {
  OpBal: "opening", Sale: "sale", Rcpt: "receipt", SlRt: "sales_return",
  Purc: "purchase", Pymt: "payment", Jrnl: "journal", CrNt: "credit_note", DrNt: "debit_note",
};

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}
function num(s: any): number {
  if (s === null || s === undefined) return 0;
  const t = String(s).replace(/,/g, "").replace(/Rs\.?/g, "").trim();
  if (t === "" || t === "-") return 0;
  const v = parseFloat(t);
  return isNaN(v) ? 0 : v;
}
function parseDate(s: any): string | null {
  const m = String(s).trim().match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  return `${y.padStart(4, "0")}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

type Entry = { d: string; t: string; vch: string; acct: string; debit: number; credit: number };
type Block = { name: string; ents: Entry[] };

async function fetchTab(tab: string): Promise<any[][]> {
  const url = `https://connector-gateway.lovable.dev/google_sheets/v4/spreadsheets/${SHEET}/values/${tab}!A1:H3000?valueRenderOption=FORMATTED_VALUE`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": `${process.env.GOOGLE_SHEETS_API_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`sheet ${tab}: ${res.status} ${await res.text()}`);
  const j = (await res.json()) as { values?: any[][] };
  return j.values ?? [];
}

function parseBlocks(rows: any[][]): Block[] {
  const blocks: Block[] = [];
  let cur: Block | null = null;
  for (const raw of rows) {
    const r = [...raw, "", "", "", "", "", "", "", ""].slice(0, 8);
    const [date, typ, vch, acct, deb, cred, bal] = r;
    const acctS = String(acct ?? "");
    if (acctS.startsWith("***")) {
      if (cur) blocks.push(cur);
      cur = { name: acctS.replace(/\*/g, "").trim(), ents: [] };
      continue;
    }
    if (!cur) continue;
    if (typ === "OpBal") {
      const bs = String(bal ?? "").trim();
      const amt = num(bs.replace(/Dr|Cr|-+/g, "").trim());
      const side = bs.includes("Cr") ? "Cr" : "Dr";
      cur.ents.push({
        d: parseDate(date) || FY_START, t: "opening", vch: "", acct: "Opening Balance",
        debit: side === "Dr" ? amt : 0, credit: side === "Cr" ? amt : 0,
      });
      continue;
    }
    if (TYPEMAP[typ as string]) {
      const d = parseDate(date);
      if (!d || d < FY_START || d > FY_END) continue;
      cur.ents.push({
        d, t: TYPEMAP[typ as string], vch: String(vch ?? ""), acct: acctS,
        debit: num(deb), credit: num(cred),
      });
    }
  }
  if (cur) blocks.push(cur);
  return blocks;
}

async function fetchPartyMap(table: "customers" | "suppliers"): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let from = 0;
  for (;;) {
    const { data, error } = await supabaseAdmin.from(table).select("id,name").range(from, from + 999);
    if (error) throw new Error(`${table} read: ${error.message}`);
    for (const r of data ?? []) {
      const n = norm(r.name as string);
      if (n && !map.has(n)) map.set(n, r.id as string);
    }
    if (!data || data.length < 1000) break;
    from += 1000;
  }
  return map;
}

async function ensureParties(table: "customers" | "suppliers", blocks: Block[]) {
  const map = await fetchPartyMap(table);
  const missing = new Map<string, string>();
  for (const b of blocks) {
    const n = norm(b.name);
    if (n && !map.has(n) && !missing.has(n)) missing.set(n, b.name);
  }
  if (missing.size) {
    const rows = [...missing.values()].map((name) => ({ name }));
    const { error } = await supabaseAdmin.from(table).insert(rows);
    if (error) throw new Error(`${table} insert: ${error.message}`);
    return await fetchPartyMap(table);
  }
  return map;
}

async function insertAll(table: string, rows: any[]) {
  if (!rows.length) return 0;
  const size = 500;
  let n = 0;
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    const { error } = await (supabaseAdmin.from(table as any) as any).insert(chunk);
    if (error) throw new Error(`${table}: ${error.message}`);
    n += chunk.length;
  }
  return n;
}

export const Route = createFileRoute("/api/public/import-ledger-fy2526")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("token") !== TOKEN) {
          return new Response("Forbidden", { status: 403 });
        }
        try {
          const [debRows, credRows] = await Promise.all([fetchTab("Debtors"), fetchTab("Creditors")]);
          const custBlocks = parseBlocks(debRows);
          const suppBlocks = parseBlocks(credRows);

          const custMap = await ensureParties("customers", custBlocks);
          const suppMap = await ensureParties("suppliers", suppBlocks);

          // Clear previously-imported sheet rows so this is re-runnable
          await supabaseAdmin.from("sales_ledger").delete().eq("source", SOURCE);
          await supabaseAdmin.from("purchase_ledger").delete().eq("source", SOURCE);
          await supabaseAdmin.from("cash_transactions").delete().eq("source", SOURCE);

          let seq = 0;
          const buildLedger = (blocks: Block[], map: Map<string, string>) =>
            blocks.flatMap((b) => {
              const pid = map.get(norm(b.name)) ?? null;
              return b.ents.map((e) => ({
                party_id: pid, party_name: b.name, txn_date: e.d, txn_type: e.t,
                vch_no: e.vch, account_name: e.acct, debit: e.debit, credit: e.credit,
                seq: ++seq, source: SOURCE,
              }));
            });

          const salesLedger = buildLedger(custBlocks, custMap);
          const purchaseLedger = buildLedger(suppBlocks, suppMap);

          // Cash / Bank ledger from any row hitting Cash or Hdfc Bank
          const cash: any[] = [];
          for (const b of [...custBlocks, ...suppBlocks]) {
            for (const e of b.ents) {
              if (e.t === "opening") continue;
              const a = e.acct.trim().toLowerCase();
              const la = a === "cash" ? "cash" : a.includes("hdfc") ? "bank" : null;
              if (!la) continue;
              cash.push({
                txn_date: e.d, txn_type: e.t, vch_no: e.vch, account_name: b.name,
                debit: e.credit, credit: e.debit, ledger_account: la, source: SOURCE,
              });
            }
          }

          const result = {
            customers_total: custMap.size,
            suppliers_total: suppMap.size,
            sales_ledger: await insertAll("sales_ledger", salesLedger),
            purchase_ledger: await insertAll("purchase_ledger", purchaseLedger),
            cash_transactions: await insertAll("cash_transactions", cash),
          };
          return Response.json({ status: "ok", ...result });
        } catch (e: any) {
          return new Response(`Import failed: ${e?.message ?? e}`, { status: 500 });
        }
      },
    },
  },
});