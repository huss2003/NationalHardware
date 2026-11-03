// GST reporting helpers: aggregate sale items for tax reports and build a
// best-effort GSTR-1 JSON (verify once on the GST portal) + CSV.

export type ItemRec = { sale_id: string; hsn: string; gst_rate: number; line_total: number; intra: boolean };
export type SaleRec = {
  id: string; invoice_no: string | null; invoice_date: string;
  subtotal: number; cgst: number; sgst: number; igst: number; grand_total: number;
  cust_gstin?: string | null; cust_state?: string | null;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

// Minimal Indian state -> GST state code map. Falls back to "97" (other territory).
const STATE_CODES: Record<string, string> = {
  "jammu and kashmir": "01", "himachal pradesh": "02", "punjab": "03", "chandigarh": "04",
  "uttarakhand": "05", "haryana": "06", "delhi": "07", "rajasthan": "08", "uttar pradesh": "09",
  "bihar": "10", "sikkim": "11", "arunachal pradesh": "12", "nagaland": "13", "manipur": "14",
  "mizoram": "15", "tripura": "16", "meghalaya": "17", "assam": "18", "west bengal": "19",
  "jharkhand": "20", "odisha": "21", "chhattisgarh": "22", "madhya pradesh": "23", "gujarat": "24",
  "maharashtra": "27", "karnataka": "29", "goa": "30", "kerala": "32", "tamil nadu": "33",
  "telangana": "36", "andhra pradesh": "37",
};
export function stateCode(state?: string | null): string {
  if (!state) return "97";
  return STATE_CODES[state.trim().toLowerCase()] ?? "97";
}

export type TaxRow = { key: string; taxable: number; cgst: number; sgst: number; igst: number; total: number; rate: number };

function groupTax(items: ItemRec[], keyOf: (i: ItemRec) => string): TaxRow[] {
  const m = new Map<string, TaxRow>();
  for (const it of items) {
    const key = keyOf(it);
    const tax = r2(it.line_total * it.gst_rate / 100);
    const row = m.get(key) ?? { key, taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0, rate: it.gst_rate };
    row.taxable = r2(row.taxable + it.line_total);
    if (it.intra) { row.cgst = r2(row.cgst + tax / 2); row.sgst = r2(row.sgst + tax / 2); }
    else { row.igst = r2(row.igst + tax); }
    row.total = r2(row.taxable + row.cgst + row.sgst + row.igst);
    m.set(key, row);
  }
  return [...m.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export const aggregateHsn = (items: ItemRec[]) =>
  groupTax(items, (i) => `${i.hsn || "—"}|${i.gst_rate}`).map((r) => ({ ...r, hsn: r.key.split("|")[0] }));
export const aggregateRate = (items: ItemRec[]) =>
  groupTax(items, (i) => String(i.gst_rate));

export function splitB2bB2c(sales: SaleRec[]) {
  const acc = { b2b: { count: 0, taxable: 0, tax: 0 }, b2c: { count: 0, taxable: 0, tax: 0 } };
  for (const s of sales) {
    const bucket = s.cust_gstin ? acc.b2b : acc.b2c;
    bucket.count += 1;
    bucket.taxable = r2(bucket.taxable + Number(s.subtotal));
    bucket.tax = r2(bucket.tax + Number(s.cgst) + Number(s.sgst) + Number(s.igst));
  }
  return acc;
}

/** Best-effort GSTR-1 JSON (offline-utility shape). Verify on the portal before filing. */
export function buildGstr1Json(gstin: string, fp: string, sales: SaleRec[], items: ItemRec[]) {
  const bySale = new Map<string, ItemRec[]>();
  for (const it of items) (bySale.get(it.sale_id) ?? bySale.set(it.sale_id, []).get(it.sale_id)!).push(it);

  // B2B: group by customer GSTIN
  const b2bMap = new Map<string, any[]>();
  // B2CS: consolidate by (pos, rate)
  const b2csMap = new Map<string, any>();

  for (const s of sales) {
    const its = bySale.get(s.id) ?? [];
    if (s.cust_gstin) {
      const rateRows = groupTax(its, (i) => String(i.gst_rate));
      const inv = {
        inum: s.invoice_no, idt: fmtIdt(s.invoice_date), val: r2(Number(s.grand_total)),
        pos: stateCode(s.cust_state), rchrg: "N", inv_typ: "R",
        itms: rateRows.map((r, idx) => ({
          num: idx + 1,
          itm_det: { txval: r.taxable, rt: r.rate, camt: r.cgst, samt: r.sgst, iamt: r.igst, csamt: 0 },
        })),
      };
      (b2bMap.get(s.cust_gstin) ?? b2bMap.set(s.cust_gstin, []).get(s.cust_gstin)!).push(inv);
    } else {
      const pos = stateCode(s.cust_state);
      for (const r of groupTax(its, (i) => String(i.gst_rate))) {
        const key = `${pos}|${r.rate}`;
        const intra = r.igst === 0;
        const ex = b2csMap.get(key) ?? { sply_ty: intra ? "INTRA" : "INTER", pos, typ: "OE", rt: r.rate, txval: 0, camt: 0, samt: 0, iamt: 0, csamt: 0 };
        ex.txval = r2(ex.txval + r.taxable);
        ex.camt = r2(ex.camt + r.cgst); ex.samt = r2(ex.samt + r.sgst); ex.iamt = r2(ex.iamt + r.igst);
        b2csMap.set(key, ex);
      }
    }
  }

  const hsn = aggregateHsn(items);
  return {
    gstin, fp, version: "GST3.0.4", hash: "hash",
    b2b: [...b2bMap.entries()].map(([ctin, inv]) => ({ ctin, inv })),
    b2cs: [...b2csMap.values()],
    hsn: {
      data: hsn.map((h, i) => ({
        num: i + 1, hsn_sc: h.hsn === "—" ? "" : h.hsn, uqc: "NOS",
        qty: 0, txval: h.taxable, rt: h.rate, camt: h.cgst, samt: h.sgst, iamt: h.igst, csamt: 0,
      })),
    },
  };
}

function fmtIdt(d: string) {
  // yyyy-mm-dd -> dd-mm-yyyy (GST portal format)
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}-${m}-${y}`;
}

export function toCsv(sections: { title: string; headers: string[]; rows: (string | number)[][] }[]): string {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const out: string[] = [];
  for (const sec of sections) {
    out.push(sec.title);
    out.push(sec.headers.map(esc).join(","));
    for (const row of sec.rows) out.push(row.map(esc).join(","));
    out.push("");
  }
  return out.join("\n");
}

// ponytail: inline self-check, run with `npx tsx src/lib/gst-reports.ts`
if (typeof process !== "undefined" && process.argv?.[1]?.endsWith("gst-reports.ts")) {
  const assert = (c: boolean, m: string) => { if (!c) throw new Error("FAIL: " + m); };
  assert(stateCode("Karnataka") === "29", "karnataka " + stateCode("Karnataka"));
  assert(stateCode("Nowhere") === "97", "unknown");
  const items: ItemRec[] = [
    { sale_id: "s1", hsn: "4412", gst_rate: 18, line_total: 1000, intra: true },
    { sale_id: "s1", hsn: "4412", gst_rate: 18, line_total: 500, intra: true },
    { sale_id: "s2", hsn: "3920", gst_rate: 12, line_total: 200, intra: false },
  ];
  const hsn = aggregateHsn(items);
  assert(hsn.length === 2, "hsn groups " + hsn.length);
  const ply = hsn.find((h) => h.hsn === "4412")!;
  assert(ply.taxable === 1500 && ply.cgst === 135 && ply.sgst === 135, "ply " + JSON.stringify(ply));
  const mica = hsn.find((h) => h.hsn === "3920")!;
  assert(mica.igst === 24 && mica.cgst === 0, "mica igst " + mica.igst);
  console.log("gst-reports self-check OK");
}
