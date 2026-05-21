import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type InvoicePdfInput = {
  shop: { shop_name?: string; address?: string | null; gstin?: string | null } | null;
  sale: {
    invoice_no: string | null;
    invoice_date: string;
    subtotal: number; discount: number;
    cgst: number; sgst: number; igst: number; grand_total: number;
    payment_mode: string;
  };
  customer: { name?: string | null; gstin?: string | null; address?: string | null; phone?: string | null } | null;
  items: Array<{ name: string; hsn?: string | null; qty: number; rate: number; gst_rate: number; line_total: number; item_instance_id?: string | null }>;
};

export function buildInvoicePdf(input: InvoicePdfInput): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const shopName = input.shop?.shop_name ?? "National Hardware and Plywood";

  // Brand band
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, W, 90, "F");
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold"); doc.setFontSize(20);
  doc.text(shopName, 40, 38);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  let hy = 54;
  if (input.shop?.address) { doc.text(input.shop.address, 40, hy); hy += 12; }
  if (input.shop?.gstin) { doc.text(`GSTIN: ${input.shop.gstin}`, 40, hy); }

  doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.text("TAX INVOICE", W - 40, 34, { align: "right" });
  doc.setFontSize(16);
  doc.text(input.sale.invoice_no ?? "—", W - 40, 54, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.text(new Date(input.sale.invoice_date).toLocaleDateString(), W - 40, 70, { align: "right" });

  doc.setTextColor(20);
  let y = 118;
  // Bill To panel
  doc.setFillColor(245, 247, 250);
  doc.rect(40, y - 12, (W - 80) / 2 - 8, 90, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(100);
  doc.text("BILL TO", 52, y); y += 14;
  doc.setTextColor(20); doc.setFontSize(11);
  doc.text(input.customer?.name ?? "Walk-in customer", 52, y); y += 13;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  if (input.customer?.phone) { doc.text(`Phone: ${input.customer.phone}`, 52, y); y += 11; }
  if (input.customer?.gstin) { doc.text(`GSTIN: ${input.customer.gstin}`, 52, y); y += 11; }
  if (input.customer?.address) { doc.text(input.customer.address, 52, y, { maxWidth: (W - 80) / 2 - 24 }); }

  // Meta panel
  const mx = W / 2 + 8;
  let my = 118;
  doc.setFillColor(245, 247, 250);
  doc.rect(mx, my - 12, (W - 80) / 2, 90, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(100);
  doc.text("INVOICE DETAILS", mx + 12, my); my += 14;
  doc.setTextColor(20); doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.text(`Date: ${new Date(input.sale.invoice_date).toLocaleDateString()}`, mx + 12, my); my += 12;
  doc.text(`Payment: ${String(input.sale.payment_mode).toUpperCase()}`, mx + 12, my); my += 12;
  doc.text(`Invoice #: ${input.sale.invoice_no ?? "—"}`, mx + 12, my);

  y = 230;
  autoTable(doc, {
    startY: y,
    head: [["Item", "HSN", "Qty", "Rate", "GST%", "Total"]],
    body: input.items.map((it) => [
      it.name + (it.item_instance_id ? `\n${it.item_instance_id}` : ""),
      it.hsn ?? "—",
      String(it.qty),
      Number(it.rate).toFixed(2),
      `${it.gst_rate}%`,
      Number(it.line_total).toFixed(2),
    ]),
    styles: { fontSize: 9, cellPadding: 8, lineColor: [230, 230, 230], lineWidth: 0.5 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 251, 253] },
    columnStyles: { 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
    margin: { left: 40, right: 40 },
  });

  // @ts-expect-error - autotable adds lastAutoTable
  const afterY = (doc.lastAutoTable?.finalY ?? y) + 16;
  // Totals card
  const tw = 260;
  const tx = W - 40 - tw + 14, vx = W - 50;
  doc.setFillColor(248, 250, 252);
  doc.rect(W - 40 - tw, afterY, tw, 130, "F");
  let ty = afterY + 20;
  const row = (label: string, v: number, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setTextColor(bold ? 20 : 80);
    doc.text(label, tx, ty);
    doc.setTextColor(20);
    doc.text(v.toFixed(2), vx, ty, { align: "right" });
    ty += 16;
  };
  doc.setFontSize(10);
  row("Subtotal", Number(input.sale.subtotal));
  if (Number(input.sale.discount) > 0) row("Discount", -Number(input.sale.discount));
  if (Number(input.sale.cgst) > 0) row("CGST", Number(input.sale.cgst));
  if (Number(input.sale.sgst) > 0) row("SGST", Number(input.sale.sgst));
  if (Number(input.sale.igst) > 0) row("IGST", Number(input.sale.igst));
  doc.setDrawColor(200); doc.line(tx, ty - 6, vx, ty - 6); ty += 6;
  doc.setFontSize(12);
  row("Grand Total", Number(input.sale.grand_total), true);

  // Footer
  const ph = doc.internal.pageSize.getHeight();
  doc.setDrawColor(220); doc.line(40, ph - 50, W - 40, ph - 50);
  doc.setFontSize(8); doc.setTextColor(120);
  doc.text(`Thank you for your business — ${shopName}.`, 40, ph - 32);
  doc.text("This is a system-generated tax invoice.", W - 40, ph - 32, { align: "right" });
  return doc;
}

export function invoiceFileName(invoiceNo?: string | null) {
  return `Invoice-${invoiceNo ?? "draft"}.pdf`;
}

export type ReceiptPdfInput = {
  shop: { shop_name?: string; address?: string | null; gstin?: string | null } | null;
  receipt: {
    receipt_no: string; receipt_type: string; amount: number;
    mode: string; notes?: string | null; created_at: string;
  };
  customer: { name?: string | null; phone?: string | null; address?: string | null } | null;
};

export function buildReceiptPdf(input: ReceiptPdfInput): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a5" });
  const W = doc.internal.pageSize.getWidth();
  let y = 36;
  doc.setFont("helvetica", "bold"); doc.setFontSize(16);
  doc.text(input.shop?.shop_name ?? "Receipt", 32, y);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  if (input.shop?.address) { y += 13; doc.text(input.shop.address, 32, y); }
  if (input.shop?.gstin) { y += 11; doc.text(`GSTIN: ${input.shop.gstin}`, 32, y); }

  doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text("PAYMENT RECEIPT", W - 32, 40, { align: "right" });
  doc.setFontSize(14);
  doc.text(`#${input.receipt.receipt_no}`, W - 32, 58, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.text(new Date(input.receipt.created_at).toLocaleDateString(), W - 32, 72, { align: "right" });

  y = Math.max(y, 84) + 18;
  doc.setDrawColor(220); doc.line(32, y, W - 32, y); y += 18;

  doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.text("Received From", 32, y); y += 14;
  doc.setFont("helvetica", "normal");
  doc.text(input.customer?.name ?? "—", 32, y); y += 12;
  if (input.customer?.phone) { doc.text(`Phone: ${input.customer.phone}`, 32, y); y += 12; }
  if (input.customer?.address) { doc.text(input.customer.address, 32, y); y += 12; }

  y += 12;
  autoTable(doc, {
    startY: y,
    head: [["Type", "Mode", "Amount"]],
    body: [[
      input.receipt.receipt_type === "credit" ? "Credit Payment" : "General Entry",
      String(input.receipt.mode).toUpperCase(),
      Number(input.receipt.amount).toFixed(2),
    ]],
    styles: { fontSize: 10, cellPadding: 7 },
    headStyles: { fillColor: [240, 240, 240], textColor: 20 },
    columnStyles: { 2: { halign: "right" } },
    margin: { left: 32, right: 32 },
  });
  // @ts-expect-error - autotable adds lastAutoTable
  let ay = (doc.lastAutoTable?.finalY ?? y) + 18;

  doc.setFont("helvetica", "bold"); doc.setFontSize(12);
  doc.text("Total Received", 32, ay);
  doc.text(`INR ${Number(input.receipt.amount).toFixed(2)}`, W - 32, ay, { align: "right" });

  if (input.receipt.notes) {
    ay += 22;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    doc.text(`Notes: ${input.receipt.notes}`, 32, ay, { maxWidth: W - 64 });
  }

  doc.setFontSize(8); doc.setTextColor(120);
  doc.text("Thank you.", 32, doc.internal.pageSize.getHeight() - 24);
  return doc;
}

export function receiptFileName(no: string) { return `Receipt-${no}.pdf`; }

/**
 * Uploads the PDF to the `invoices` bucket and opens WhatsApp with a deep
 * link. The user taps Send inside WhatsApp.
 */
export async function shareInvoiceOnWhatsApp(opts: {
  pdf: jsPDF;
  invoiceNo: string;
  phone: string;
  shopName?: string | null;
  total?: number;
  publicUrl?: string;
}) {
  const phone = opts.phone.replace(/\D/g, "");
  const msg = [
    `Hi! Your invoice ${opts.invoiceNo}${opts.shopName ? ` from ${opts.shopName}` : ""}.`,
    opts.total != null ? `Total: ₹${opts.total.toFixed(2)}.` : "",
    opts.publicUrl ? `View / download: ${opts.publicUrl}` : "",
  ].filter(Boolean).join("\n");
  const text = encodeURIComponent(msg);
  // wa.me redirects desktop browsers to api.whatsapp.com, which is often
  // blocked (ERR_BLOCKED_BY_RESPONSE in the preview / many networks).
  // Use web.whatsapp.com on desktop and wa.me on mobile devices.
  const isMobile = typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const url = isMobile
    ? `https://wa.me/${phone}?text=${text}`
    : `https://web.whatsapp.com/send?phone=${phone}&text=${text}`;
  const win = window.open(url, "_blank", "noopener");
  if (!win) {
    // Popup blocked — fall back to navigating the top window.
    window.location.href = url;
  }
}