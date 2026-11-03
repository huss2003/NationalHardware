import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { inr, fmtDate } from "@/lib/codes";

export type StatementRow = {
  date: string;
  ref: string;
  debit: number;
  credit: number;
  balance: number;
};

export type StatementInput = {
  shop: { shop_name?: string; address?: string | null; gstin?: string | null } | null;
  partyName: string;
  partyPhone?: string | null;
  kindLabel: string;        // "Customer" | "Supplier"
  from: string;             // yyyy-mm-dd
  to: string;
  rows: StatementRow[];
  closing: number;          // >0 Dr, <0 Cr
};

const drcr = (n: number) => (Math.abs(n) < 0.01 ? "0.00" : `${inr(Math.abs(n))} ${n > 0 ? "Dr" : "Cr"}`);

export function buildStatementPdf(input: StatementInput): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const shopName = input.shop?.shop_name ?? "National Hardware and Plywood";
  let y = 40;

  doc.setFont("helvetica", "bold").setFontSize(16).text(shopName, 40, y);
  y += 16;
  if (input.shop?.address) { doc.setFont("helvetica", "normal").setFontSize(9).text(String(input.shop.address), 40, y); y += 12; }
  if (input.shop?.gstin) { doc.setFontSize(9).text(`GSTIN: ${input.shop.gstin}`, 40, y); y += 12; }

  y += 8;
  doc.setFont("helvetica", "bold").setFontSize(13).text("Statement of Account", 40, y);
  y += 18;
  doc.setFont("helvetica", "normal").setFontSize(10);
  doc.text(`${input.kindLabel}: ${input.partyName}`, 40, y);
  if (input.partyPhone) doc.text(String(input.partyPhone), 555, y, { align: "right" });
  y += 14;
  doc.text(`Period: ${fmtDate(input.from)} to ${fmtDate(input.to)}`, 40, y);
  y += 10;

  autoTable(doc, {
    startY: y,
    head: [["Date", "Particulars", "Debit", "Credit", "Balance"]],
    body: input.rows.map((r) => [
      fmtDate(r.date),
      r.ref,
      r.debit ? inr(r.debit) : "",
      r.credit ? inr(r.credit) : "",
      drcr(r.balance),
    ]),
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [59, 130, 246], halign: "left" },
    columnStyles: {
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
    },
    margin: { left: 40, right: 40 },
  });

  const endY = (doc as any).lastAutoTable?.finalY ?? y + 20;
  doc.setFont("helvetica", "bold").setFontSize(11);
  doc.text(`Closing Balance: ${drcr(input.closing)}`, 555, endY + 24, { align: "right" });

  return doc;
}

export function statementFileName(party: string) {
  return `Statement-${party.replace(/[^\w]+/g, "_")}.pdf`;
}
