export type HsnRow = {
  hsn: string;
  gstRate: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
};

export function hsnSummary(
  items: Array<{ hsn?: string | null; gst_rate: number; line_total: number }>,
  sameState: boolean,
): HsnRow[] {
  // ponytail: Map keyed by "hsn|rate" — one pass, no libs
  const map = new Map<string, { hsn: string; gstRate: number; taxable: number }>();
  for (const item of items) {
    const hsn = item.hsn || "—";
    const key = `${hsn}|${item.gst_rate}`;
    const existing = map.get(key);
    if (existing) {
      existing.taxable = Math.round((existing.taxable + item.line_total) * 100) / 100;
    } else {
      map.set(key, { hsn, gstRate: item.gst_rate, taxable: item.line_total });
    }
  }

  return [...map.values()]
    .sort((a, b) => a.hsn.localeCompare(b.hsn) || a.gstRate - b.gstRate)
    .map(({ hsn, gstRate, taxable }) => {
      const tax = Math.round(taxable * gstRate) / 100;
      const cgst = sameState ? Math.round(tax / 2 * 100) / 100 : 0;
      const sgst = cgst;
      const igst = sameState ? 0 : tax;
      const total = Math.round((taxable + cgst + sgst + igst) * 100) / 100;
      return { hsn, gstRate, taxable, cgst, sgst, igst, total };
    });
}

// ponytail: inline self-check, run with `npx tsx src/lib/hsn-summary.ts`
if (typeof process !== "undefined" && process.argv?.[1]?.endsWith("hsn-summary.ts")) {
  const assert = (c: boolean, m: string) => { if (!c) throw new Error("FAIL: " + m); };
  const rows = hsnSummary([
    { hsn: "4412", gst_rate: 18, line_total: 1000 },
    { hsn: "4412", gst_rate: 18, line_total: 500 },
    { hsn: "3920", gst_rate: 12, line_total: 200 },
  ], true);
  assert(rows.length === 2, "group count " + rows.length);
  const r = rows.find(x => x.hsn === "4412")!;
  assert(r.taxable === 1500, "taxable " + r.taxable);
  assert(r.cgst === 135 && r.sgst === 135 && r.igst === 0, "cgst/sgst " + r.cgst + "/" + r.sgst);
  assert(r.total === 1770, "total " + r.total);
  const inter = hsnSummary([{ hsn: "4412", gst_rate: 18, line_total: 1000 }], false)[0];
  assert(inter.igst === 180 && inter.cgst === 0, "igst " + inter.igst);
  console.log("hsn-summary self-check OK");
}
