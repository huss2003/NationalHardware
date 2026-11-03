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
import { aggregateHsn, aggregateRate, splitB2bB2c, buildGstr1Json, toCsv, type ItemRec, type SaleRec } from "@/lib/gst-reports";
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

      const [itemsRes, custRes, shopRes] = await Promise.all([
        ids.length
          ? supabase.from("sales_items").select("sale_id, gst_rate, line_total, products(hsn)").in("sale_id", ids)
          : Promise.resolve({ data: [] as any[] }),
        custIds.length
          ? supabase.from("customers").select("id, gstin, state").in("id", custIds)
          : Promise.resolve({ data: [] as any[] }),
        supabase.from("app_settings").select("gstin").eq("id", true).maybeSingle(),
      ]);

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

      return { saleRecs, items, shopGstin: (shopRes.data as any)?.gstin ?? "" };
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
  const rate = useMemo(() => aggregateRate(items), [items]);
  const bx = useMemo(() => splitB2bB2c(saleRecs), [saleRecs]);

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

        {isFetching ? <div className="py-16 text-center text-muted-foreground">Loading…</div> : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <Stat label="Taxable" value={summary.taxable} />
              <Stat label="CGST" value={summary.cgst} />
              <Stat label="SGST" value={summary.sgst} />
              <Stat label="IGST" value={summary.igst} />
              <Stat label="Grand" value={summary.grand} accent />
            </div>
            <p className="text-xs text-muted-foreground">{summary.count} bill(s) in {month}. GSTR-1 JSON is best-effort — verify once on the GST portal before filing.</p>

            <Section title="HSN-wise" cols={["HSN", "Rate%", "Taxable", "CGST", "SGST", "IGST", "Total"]}
              rows={hsn.map((h) => [h.hsn, `${h.rate}%`, inr(h.taxable), inr(h.cgst), inr(h.sgst), inr(h.igst), inr(h.total)])} />
            <Section title="Rate-wise" cols={["Rate%", "Taxable", "CGST", "SGST", "IGST", "Total"]}
              rows={rate.map((r) => [`${r.rate}%`, inr(r.taxable), inr(r.cgst), inr(r.sgst), inr(r.igst), inr(r.total)])} />
            <Section title="B2B vs B2C" cols={["Type", "Bills", "Taxable", "Tax"]}
              rows={[["B2B (GSTIN)", bx.b2b.count, inr(bx.b2b.taxable), inr(bx.b2b.tax)], ["B2C", bx.b2c.count, inr(bx.b2c.taxable), inr(bx.b2c.tax)]]} />
          </>
        )}
      </div>
    </>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-[#e8ecf1] bg-white p-3 shadow-sm">
      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</div>
      <p className={`mt-1 text-lg font-extrabold tabular-nums ${accent ? "text-[#3b82f6]" : "text-slate-800"}`}>{inr(value)}</p>
    </div>
  );
}

function Section({ title, cols, rows }: { title: string; cols: string[]; rows: (string | number)[][] }) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b bg-slate-50 px-4 py-2 text-sm font-bold text-slate-700">{title}</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>{cols.map((c, i) => <th key={c} className={`p-2.5 ${i === 0 ? "text-left pl-4" : "text-right"}`}>{c}</th>)}</tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={cols.length} className="p-6 text-center text-muted-foreground">No data.</td></tr>
            ) : rows.map((r, ri) => (
              <tr key={ri} className="border-t">
                {r.map((cell, ci) => <td key={ci} className={`p-2.5 tabular-nums ${ci === 0 ? "text-left pl-4 font-medium text-slate-700" : "text-right"}`}>{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
