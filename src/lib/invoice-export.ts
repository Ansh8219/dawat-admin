import { fulfillmentLabel, paymentLabel } from "./api/orders";
import { getInvoice } from "./api/invoices";
import { formatInvoiceDateTime, formatInvoiceAmount, listInvoices } from "./api/invoices";
import type { InvoiceDetail, InvoiceListItem, InvoiceListParams, InvoiceTotals } from "./api/types";

/** Fetches every invoice matching the filter (all pages). */
export async function fetchAllInvoices(
  accessToken: string,
  params: InvoiceListParams,
): Promise<{ rows: InvoiceListItem[]; totals: InvoiceTotals }> {
  const rows: InvoiceListItem[] = [];
  let totals: InvoiceTotals | undefined;
  for (let page = 1; page <= 500; page++) {
    const res = await listInvoices(accessToken, { ...params, page, page_size: 100 });
    totals = res.totals;
    rows.push(...res.results);
    if (res.results.length === 0 || rows.length >= res.count) break;
  }
  return { rows, totals: totals as InvoiceTotals };
}

const HEADERS = [
  "Invoice no",
  "Date (IST)",
  "Business",
  "Customer",
  "Order type",
  "Payment",
  "Taxable",
  "GST",
  "Total",
  "Status",
  "Order ID",
];

function toCells(inv: InvoiceListItem): string[] {
  return [
    inv.invoice_number,
    formatInvoiceDateTime(inv.invoice_date),
    inv.business.name,
    inv.buyer_name?.trim() || "",
    fulfillmentLabel(inv.fulfillment_type),
    paymentLabel(inv.payment_method),
    inv.taxable_amount.toFixed(2),
    inv.total_tax.toFixed(2),
    inv.total_amount.toFixed(2),
    inv.status,
    inv.order_public_id,
  ];
}

function csvCell(value: string): string {
  // Neutralise spreadsheet formula injection, then quote.
  const safe = /^[=+\-@\t\r]/.test(value) && Number.isNaN(Number(value)) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

function stamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export function downloadInvoicesCsv(rows: InvoiceListItem[]) {
  const lines = [HEADERS, ...rows.map(toCells)].map((r) => r.map(csvCell).join(","));
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `invoices-${stamp()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Opens a print-ready report; choose "Save as PDF" in the print dialog. */
export function printInvoicesPdf(
  rows: InvoiceListItem[],
  totals: InvoiceTotals | undefined,
  subtitle: string,
) {
  const body = rows
    .map((inv) => {
      const c = toCells(inv);
      return `<tr>${[0, 1, 2, 3, 4, 5].map((i) => `<td>${esc(c[i])}</td>`).join("")}${[6, 7, 8]
        .map((i) => `<td class="r">${esc(c[i])}</td>`)
        .join("")}</tr>`;
    })
    .join("");
  const totalRow = totals
    ? `<tr class="t"><td colspan="6">Total (${rows.length} invoices)</td><td class="r">${esc(
        formatInvoiceAmount(totals.taxable_amount),
      )}</td><td class="r">${esc(
        formatInvoiceAmount(totals.cgst_amount + totals.sgst_amount + totals.igst_amount),
      )}</td><td class="r">${esc(formatInvoiceAmount(totals.total_amount))}</td></tr>`
    : "";
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>invoices-${stamp()}</title>
<style>
@page{size:A4 landscape;margin:12mm}
body{font:11px/1.35 system-ui,sans-serif;color:#111}
h1{font-size:16px;margin:0 0 2px}p{margin:0 0 10px;color:#555}
table{width:100%;border-collapse:collapse}
th,td{border-bottom:1px solid #ddd;padding:4px 6px;text-align:left}
th{background:#f3f3f3;font-size:10px;text-transform:uppercase}
.r{text-align:right;font-variant-numeric:tabular-nums}
.t td{font-weight:700;border-top:2px solid #111}
thead{display:table-header-group}tr{page-break-inside:avoid}
</style></head><body>
<h1>Invoices</h1><p>${esc(subtitle)}</p>
<table><thead><tr><th>Invoice no</th><th>Date (IST)</th><th>Business</th><th>Customer</th><th>Order type</th><th>Payment</th><th class="r">Taxable</th><th class="r">GST</th><th class="r">Total</th></tr></thead>
<tbody>${body}${totalRow}</tbody></table></body></html>`;

  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(html);
  doc.close();
  const cleanup = () => window.setTimeout(() => frame.remove(), 500);
  frame.contentWindow!.addEventListener("afterprint", cleanup);
  window.setTimeout(() => {
    frame.contentWindow!.focus();
    frame.contentWindow!.print();
  }, 150);
}

/** One invoice as CSV: a header block plus one row per line item. */
export function downloadInvoiceDetailCsv(inv: InvoiceDetail) {
  const n = (v: number) => v.toFixed(2);
  const rows: string[][] = [
    ["Invoice no", inv.invoice_number],
    ["Date (IST)", formatInvoiceDateTime(inv.invoice_date)],
    ["Business", inv.business.name],
    ["Seller GSTIN", inv.seller.gstin],
    ["Customer", inv.buyer.name ?? ""],
    ["Phone", inv.buyer.phone ?? ""],
    ["Place of supply", inv.place_of_supply],
    [],
    [
      "#",
      "Description",
      "SAC",
      "Qty",
      "Unit price",
      "Discount",
      "Taxable",
      "GST %",
      "CGST",
      "SGST",
      "IGST",
      "Total",
    ],
    ...inv.lines.map((l) => [
      String(l.position),
      l.description,
      l.sac_code,
      String(l.quantity),
      n(l.unit_price),
      n(l.discount_amount),
      n(l.taxable_amount),
      String(l.gst_rate),
      n(l.cgst_amount),
      n(l.sgst_amount),
      n(l.igst_amount),
      n(l.total_amount),
    ]),
    [],
    [
      "",
      "Total",
      "",
      "",
      "",
      n(inv.discount_amount),
      n(inv.taxable_amount),
      "",
      n(inv.cgst_amount),
      n(inv.sgst_amount),
      n(inv.igst_amount),
      n(inv.total_amount),
    ],
  ];
  const text = rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `invoice-${inv.invoice_number.replace(/[^\w.-]+/g, "-")}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Prints the invoice page in a hidden frame so the admin never leaves the list. */
export function printInvoicePdf(publicId: string) {
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  frame.src = `/invoices/${publicId}?print=true`;
  document.body.appendChild(frame);
  window.setTimeout(() => frame.remove(), 120_000);
}
