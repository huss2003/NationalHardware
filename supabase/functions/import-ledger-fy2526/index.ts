import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SHEET = "1o0rDqfEhwYNnDxTCQdplJttw96psfjJwQ8PUc4a7Mag";
const SOURCE = "gsheet_fy2526";
const FY_START = "2025-04-01";
const FY_END = "2026-03-31";
const TOKEN = "ledger-fy2526-import-9f3a";

const TYPEMAP: Record<string, string> = {
  OpBal: "opening", Sale: "sale", Rcpt: "receipt", SlRt: "sales_return",
  Purc: "purchase", Pymt: "payment", Jrnl: "journal", CrNt: "credit_note", DrNt: "debit_note",
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
function num(s: unknown): number {
  if (s === null || s === undefined) return 0;
  const t = String(s).replace(/,/g, "").replace(/Rs\.?/g, "").trim();
  if (t === "" || t === "-") return 0;
  const v = parseFloat(t);
  return isNaN(v) ? 0 : v;
}
function parseDate(s: unknown): string | null {
  const m = String(s).trim().match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  return `${y.padStart(4, "0")}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

type Entry = { d: string; t: string; vch: string; acct: string; debit: number; credit: number };
type Block = { name: string; ents: Entry[] };

async function fetchTab(tab: string): Promise<unknown[][]> {
  const url = `https://connector-gateway.lovable.dev/google_sheets/v4/spreadsheets/${SHEET}/values/${tab}!A1:H3000?valueRenderOption=FORMATTED_VALUE`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
      "X-Connection-Api-Key": `${Deno.env.get("GOOGLE_SHEETS_API_KEY")}`,
    },
  });
  if (!res.ok) throw new Error(`sheet ${tab}: ${res.status} ${await res.text()}`);
  const j = await res.json();
  return (j.values ?? []) as unknown[][];
}

function parseBlocks(rows: unknown[][]): Block[] {
  const blocks: Block[] = [];
  let cur: Block | null = null;
  for (const raw of rows) {
    const r = [...raw, "", "", "", "", "", "", "", ""].slice(0, 8);
    const [date, typ, vch, acct, deb, cred, bal] = r as string[];
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
    if (TYPEMAP[typ]) {
      const d = parseDate(date);
      if (!d || d < FY_START || d > FY_END) continue;
      cur.ents.push({ d, t: TYPEMAP[typ], vch: String(vch ?? ""), acct: acctS, debit: num(deb), credit: num(cred) });
    }
  }
  if (cur) blocks.push(cur);
  return blocks;
}

// deno-lint-ignore no-explicit-any
async function fetchPartyMap(supabase: any, table: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let from = 0;
  for (;;) {
    const { data, error } = await supabase.from(table).select("id,name").range(from, from + 999);
    if (error) throw new Error(`${table} read: ${error.message}`);
    for (const r of data ?? []) {
      const n = norm(r.name);
      if (n && !map.has(n)) map.set(n, r.id);
    }
    if (!data || data.length < 1000) break;
    from += 1000;
  }
  return map;
}

// deno-lint-ignore no-explicit-any
async function ensureParties(supabase: any, table: string, blocks: Block[]) {
  const map = await fetchPartyMap(supabase, table);
  const missing = new Map<string, string>();
  for (const b of blocks) {
    const n = norm(b.name);
    if (n && !map.has(n) && !missing.has(n)) missing.set(n, b.name);
  }
  if (missing.size) {
    const rows = [...missing.values()].map((name) => ({ name }));
    const { error } = await supabase.from(table).insert(rows);
    if (error) throw new Error(`${table} insert: ${error.message}`);
    return await fetchPartyMap(supabase, table);
  }
  return map;
}

// deno-lint-ignore no-explicit-any
async function insertAll(supabase: any, table: string, rows: unknown[]) {
  if (!rows.length) return 0;
  const size = 500;
  let n = 0;
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    const { error } = await supabase.from(table).insert(chunk);
    if (error) throw new Error(`${table}: ${error.message}`);
    n += chunk.length;
  }
  return n;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (url.searchParams.get("token") !== TOKEN) {
    return new Response("Forbidden", { status: 403 });
  }
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const [debRows, credRows] = await Promise.all([fetchTab("Debtors"), fetchTab("Creditors")]);
    const custBlocks = parseBlocks(debRows);
    const suppBlocks = parseBlocks(credRows);

    const custMap = await ensureParties(supabase, "customers", custBlocks);
    const suppMap = await ensureParties(supabase, "suppliers", suppBlocks);

    await supabase.from("sales_ledger").delete().eq("source", SOURCE);
    await supabase.from("purchase_ledger").delete().eq("source", SOURCE);
    await supabase.from("cash_transactions").delete().eq("source", SOURCE);

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

    const cash: unknown[] = [];
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
      sales_ledger: await insertAll(supabase, "sales_ledger", salesLedger),
      purchase_ledger: await insertAll(supabase, "purchase_ledger", purchaseLedger),
      cash_transactions: await insertAll(supabase, "cash_transactions", cash),
    };
    return Response.json({ status: "ok", ...result });
  } catch (e) {
    return new Response(`Import failed: ${(e as Error)?.message ?? e}`, { status: 500 });
  }
});