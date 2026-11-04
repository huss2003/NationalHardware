import { createLazyFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { inr } from "@/lib/codes";
import { aggregateHsn, buildGstr1Json, toCsv, b2bInvoices, b2cRows, type ItemRec, type SaleRec } from "@/lib/gst-reports";
import { FileJson, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

export const Route = createLazyFileRoute("/_app/tax-reports")({ component: TaxReports });

const thisMonth = () => new Date().toISOString().slice(0, 7); // yyyy-mm
const nextMonthStart = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m, 1); // m is 1-based -> this is first of next month
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};

function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

function TaxReports() {
  const [month, setMonth] = useState(thisMonth());
  const [gstOnly, setGstOnly] = useState(true);
  const [tab, setTab] = useState<"r1" | "3b">("r1");

  const { data, isFetching } = useQuery({
    queryKey: ["tax-reports", month, gstOnly],
    queryFn: async () => {
      const from = `${month}-01`;
      const to = nextMonthStart(month);
      let sq = supabase.from("sales")
        .select("id, invoice_no, invoice_date, customer_id, subtotal, cgst, sgst, igst, grand_total, bill_type")
        .is("deleted_at", null).gte("invoice_date", from).lt("invoice_date", to);
      if (gstOnly) sq = sq.eq("bill_type", "gst");
      const { data: salesRaw, error } = await sq;
      if (error) throw error;
      const sales = salesRaw ?? [];
      const ids = sales.map((s) => s.id);
      const custIds = [...new Set(sales.map((s) => s.customer_id).filter(Boolean))] as string[];

      const [itemsRes, custRes, shopRes, purRes] = await Promise.all([
        ids.length
          ? supabase.from("sales_items").select("sale_id, gst_rate, line_total, products(hsn)").in("sale_id", ids)
          : Promise.resolve({ data: [] as any[] }),
        custIds.length
          ? supabase.from("customers").select("id, gstin, state").in("id", custIds)
          : Promise.resolve({ data: [] as any[] }),
        supabase.from("app_settings").select("gstin").eq("id", true).maybeSingle(),
        // Purchases in the month → input tax credit (ITC) for GSTR-3B.
        supabase.from("purchases").select("subtotal, tax_total").is("deleted_at", null).gte("bill_date", from).lt("bill_date", to),
      ]);
      const itc = (purRes.data ?? []).reduce(
        (a: { taxable: number; tax: number }, p: any) => {
          a.taxable += Number(p.subtotal ?? 0); a.tax += Number(p.tax_total ?? 0); return a;
        }, { taxable: 0, tax: 0 });

      const custMap = new Map((custRes.data ?? []).map((c: any) => [c.id, c]));
      const saleMap = new Map(sales.map((s) => [s.id, s]));
      const saleRecs: SaleRec[] = sales.map((s) => {
        const c = s.customer_id ? custMap.get(s.customer_id) : null;
        return { ...s, cust_gstin: c?.gstin ?? null, cust_state: c?.state ?? null } as SaleRec;
      });
      const items: ItemRec[] = (itemsRes.data ?? []).map((it: any) => {
        const s = saleMap.get(it.sale_id);
        return {
          sale_id: it.sale_id,
          hsn: it.products?.hsn ?? "—",
          gst_rate: Number(it.gst_rate),
          line_total: Number(it.line_total),
          intra: Number(s?.igst ?? 0) <= 0,
        };
      });

      return { saleRecs, items, shopGstin: (shopRes.data as any)?.gstin ?? "", itc };
    },
  });

  const saleRecs = data?.saleRecs ?? [];
  const items = data?.items ?? [];
  const shopGstin = data?.shopGstin ?? "";

  const summary = useMemo(() => {
    const s = { taxable: 0, cgst: 0, sgst: 0, igst: 0, grand: 0, count: saleRecs.length };
    for (const r of saleRecs) {
      s.taxable += Number(r.subtotal); s.cgst += Number(r.cgst); s.sgst += Number(r.sgst);
      s.igst += Number(r.igst); s.grand += Number(r.grand_total);
    }
    return s;
  }, [saleRecs]);
  const hsn = useMemo(() => aggregateHsn(items), [items]);
  const b2b = useMemo(() => b2bInvoices(saleRecs, items), [saleRecs, items]);
  const b2c = useMemo(() => b2cRows(saleRecs, items), [saleRecs, items]);

  // GSTR-3B: output tax (from sales) minus ITC (from purchases) = net payable.
  // Purchases store only a tax_total, so ITC is split as intra-state (half CGST / half SGST).
  const itc = data?.itc ?? { taxable: 0, tax: 0 };
  const gstr3b = useMemo(() => {
    const outTax = summary.cgst + summary.sgst + summary.igst;
    const itcCgst = itc.tax / 2, itcSgst = itc.tax / 2;
    return {
      out: { taxable: summary.taxable, cgst: summary.cgst, sgst: summary.sgst, igst: summary.igst, tax: outTax },
      itc: { taxable: itc.taxable, cgst: itcCgst, sgst: itcSgst, igst: 0, tax: itc.tax },
      net: {
        cgst: Math.max(0, summary.cgst - itcCgst),
        sgst: Math.max(0, summary.sgst - itcSgst),
        igst: Math.max(0, summary.igst - 0),
        tax: Math.max(0, outTax - itc.tax),
      },
    };
  }, [summary, itc]);

  // Flatten B2B invoices into filing rows (invoice value shown once per invoice).
  const b2bView = useMemo(() => {
    const rows: (string | number)[][] = [];
    let t = { taxable: 0, igst: 0, cgst: 0, sgst: 0, val: 0 };
    for (const inv of b2b) {
      inv.lines.forEach((ln, i) => {
        rows.push([
          i === 0 ? inv.gstin : "", i === 0 ? inv.inum : "", i === 0 ? inv.idt : "",
          inv.pos, `${ln.rate}%`, inr(ln.taxable), inr(ln.iamt), inr(ln.camt), inr(ln.samt),
          i === 0 ? inr(inv.val) : "",
        ]);
        t.taxable += ln.taxable; t.igst += ln.iamt; t.cgst += ln.camt; t.sgst += ln.samt;
      });
      t.val += inv.val;
    }
    const totals = ["Total", "", "", "", "", inr(t.taxable), inr(t.igst), inr(t.cgst), inr(t.sgst), inr(t.val)];
    return { rows, totals };
  }, [b2b]);

  const fp = month.split("-").reverse().join(""); // yyyy-mm -> mmyyyy

  const dlJson = () => {
    if (!shopGstin) { toast.error("Set your shop GSTIN in Settings first"); return; }
    const json = buildGstr1Json(shopGstin, fp, saleRecs, items);
    download(`GSTR1-${fp}.json`, JSON.stringify(json, null, 2), "application/json");
  };
  const dlCsv = () => {
    const csv = toCsv([
      { title: "Monthly Summary", headers: ["Bills", "Taxable", "CGST", "SGST", "IGST", "Grand"], rows: [[summary.count, summary.taxable.toFixed(2), summary.cgst.toFixed(2), summary.sgst.toFixed(2), summary.igst.toFixed(2), summary.grand.toFixed(2)]] },
      { title: "HSN-wise", headers: ["HSN", "Rate%", "Taxable", "CGST", "SGST", "IGST", "Total"], rows: hsn.map((h) => [h.hsn, h.rate, h.taxable.toFixed(2), h.cgst.toFixed(2), h.sgst.toFixed(2), h.igst.toFixed(2), h.total.toFixed(2)]) },
      { title: "Rate-wise", headers: ["Rate%", "Taxable", "CGST", "SGST", "IGST", "Total"], rows: rate.map((r) => [r.rate, r.taxable.toFixed(2), r.cgst.toFixed(2), r.sgst.toFixed(2), r.igst.toFixed(2), r.total.toFixed(2)]) },
      { title: "B2B vs B2C", headers: ["Type", "Bills", "Taxable", "Tax"], rows: [["B2B", bx.b2b.count, bx.b2b.taxable.toFixed(2), bx.b2b.tax.toFixed(2)], ["B2C", bx.b2c.count, bx.b2c.taxable.toFixed(2), bx.b2c.tax.toFixed(2)]] },
    ]);
    download(`Tax-Report-${fp}.csv`, csv, "text/csv");
  };

  return (
    <>
      <PageHeader title="GST / Tax Reports" />
      <div className="mx-auto max-w-5xl px-4 sm:px-6 pb-12 space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-auto" />
          <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
            <Switch checked={gstOnly} onCheckedChange={setGstOnly} /> GST invoices only
          </label>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" className="gap-2" onClick={dlCsv} disabled={!saleRecs.length}><FileSpreadsheet className="h-4 w-4" /> CSV</Button>
            <Button className="gap-2" onClick={dlJson} disabled={!saleRecs.length}><FileJson className="h-4 w-4" /> GSTR-1 JSON</Button>
          </div>
        </div>

        {/* Return filing tabs */}
        <div className="flex rounded-lg border border-input bg-card p-1 w-fit">
          {([["r1", "GSTR-1 (Outward)"], ["3b", "GSTR-3B"]] as const).map(([v, lbl]) => (
            <button key={v} onClick={() => setTab(v)}
              className={`h-9 px-4 rounded-md text-sm font-semibold transition-colors ${tab === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {lbl}
            </button>
          ))}
        </div>

        {isFetching ? <div className="py-16 text-center text-muted-foreground">Loading…</div> : tab === "r1" ? (
          <>
            <p className="text-xs text-muted-foreground">
              Return period {fp} · {summary.count} invoice(s). Amounts in ₹. GSTR-1 JSON is best-effort — verify on the GST portal before filing.
            </p>

            <TTable
              title="4A, 4B, 4C, 6B, 6C — B2B Invoices"
              cols={[L("GSTIN/UIN of Recipient"), L("Invoice No."), L("Date"), R("POS"), R("Rate"), R("Taxable"), R("IGST"), R("CGST"), R("SGST"), R("Invoice Value")]}
              rows={b2bView.rows}
              totals={b2bView.totals}
            />

            <TTable
              title="7 — B2C (Others)"
              cols={[L("Place of Supply"), R("Rate"), R("Taxable"), R("IGST"), R("CGST"), R("SGST")]}
              rows={b2c.map((r) => [r.pos, `${r.rate}%`, inr(r.taxable), inr(r.iamt), inr(r.camt), inr(r.samt)])}
              totals={["Total", "", inr(sum(b2c, "taxable")), inr(sum(b2c, "iamt")), inr(sum(b2c, "camt")), inr(sum(b2c, "samt"))]}
            />

            <TTable
              title="12 — HSN Summary of Outward Supplies"
              cols={[L("HSN"), R("Rate"), R("UQC"), R("Qty"), R("Taxable"), R("IGST"), R("CGST"), R("SGST"), R("Total")]}
              rows={hsn.map((h) => [h.hsn, `${h.rate}%`, "NOS", 0, inr(h.taxable), inr(h.igst), inr(h.cgst), inr(h.sgst), inr(h.total)])}
              totals={["Total", "", "", "", inr(summary.taxable), inr(summary.igst), inr(summary.cgst), inr(summary.sgst), inr(summary.grand)]}
            />
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">Return period {fp}. Amounts in ₹. ITC is taken from purchase bills in the month.</p>

            <TTable
              title="3.1 — Details of Outward Supplies"
              cols={[L("Nature of Supply"), R("Taxable"), R("IGST"), R("CGST"), R("SGST")]}
              rows={[
                ["(a) Outward taxable (other than zero-rated, nil, exempt)", inr(gstr3b.out.taxable), inr(gstr3b.out.igst), inr(gstr3b.out.cgst), inr(gstr3b.out.sgst)],
                ["(b) Outward zero-rated", "—", "—", "—", "—"],
                ["(c) Other outward (nil / exempt)", "—", "—", "—", "—"],
                ["(d) Inward liable to reverse charge", "—", "—", "—", "—"],
                ["(e) Non-GST outward", "—", "—", "—", "—"],
              ]}
            />

            <TTable
              title="4 — Eligible ITC"
              cols={[L("Details"), R("IGST"), R("CGST"), R("SGST")]}
              rows={[
                ["(A)(5) All other ITC", inr(gstr3b.itc.igst), inr(gstr3b.itc.cgst), inr(gstr3b.itc.sgst)],
                ["(B) ITC Reversed", "—", "—", "—"],
                ["(C) Net ITC Available (A − B)", inr(gstr3b.itc.igst), inr(gstr3b.itc.cgst), inr(gstr3b.itc.sgst)],
              ]}
            />

            <TTable
              title="6.1 — Payment of Tax"
              cols={[L("Head"), R("Tax Payable"), R("ITC Utilised"), R("Tax Paid in Cash")]}
              rows={[
                ["IGST", inr(gstr3b.out.igst), inr(Math.min(gstr3b.out.igst, gstr3b.itc.igst)), inr(gstr3b.net.igst)],
                ["CGST", inr(gstr3b.out.cgst), inr(Math.min(gstr3b.out.cgst, gstr3b.itc.cgst)), inr(gstr3b.net.cgst)],
                ["SGST", inr(gstr3b.out.sgst), inr(Math.min(gstr3b.out.sgst, gstr3b.itc.sgst)), inr(gstr3b.net.sgst)],
              ]}
              totals={["Total", inr(gstr3b.out.tax), inr(gstr3b.out.tax - gstr3b.net.tax), inr(gstr3b.net.tax)]}
            />
          </>
        )}
      </div>
    </>
  );
}

type Col = { label: string; align: "l" | "r" };
const L = (label: string): Col => ({ label, align: "l" });
const R = (label: string): Col => ({ label, align: "r" });
const sum = <T,>(arr: T[], k: keyof T) => arr.reduce((s, x) => s + Number(x[k] as any), 0);

// Tally / GST-portal style section table: titled, bordered, right-aligned numbers, bold totals.
function TTable({ title, cols, rows, totals }: { title: string; cols: Col[]; rows: (string | number)[][]; totals?: (string | number)[] }) {
  return (
    <Card className="overflow-hidden border-slate-300">
      <div className="border-b border-slate-300 bg-slate-100 px-4 py-2 text-sm font-bold text-slate-800">{title}</div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              {cols.map((c, i) => (
                <th key={i} className={`border-b border-slate-200 px-3 py-2 ${c.align === "r" ? "text-right" : "text-left"}`}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={cols.length} className="px-3 py-6 text-center text-muted-foreground">No data for this period.</td></tr>
            ) : rows.map((r, ri) => (
              <tr key={ri} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                {r.map((cell, ci) => (
                  <td key={ci} className={`px-3 py-1.5 tabular-nums ${cols[ci]?.align === "r" ? "text-right" : "text-left"} ${ci === 0 ? "font-medium text-slate-700" : "text-slate-600"}`}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
          {totals && rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold text-slate-800">
                {totals.map((cell, ci) => (
                  <td key={ci} className={`px-3 py-2 tabular-nums ${cols[ci]?.align === "r" ? "text-right" : "text-left"}`}>{cell}</td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </Card>
  );
}
