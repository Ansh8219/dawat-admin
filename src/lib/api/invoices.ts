import { apiRequest } from "./client";
import type {
  BusinessInvoiceDetails,
  BusinessInvoiceDetailsPayload,
  InvoiceDetail,
  InvoiceListData,
  InvoiceListParams,
  OrderInvoicesData,
} from "./types";

/** GET /api/admin/invoices/ — totals cover the whole filter, not just the page. */
export function listInvoices(accessToken: string, params: InvoiceListParams = {}) {
  const qs = new URLSearchParams();
  if (params.source) qs.set("source", params.source);
  if (params.business_public_id) qs.set("business_public_id", params.business_public_id);
  if (params.date_from) qs.set("date_from", params.date_from);
  if (params.date_to) qs.set("date_to", params.date_to);
  if (params.search?.trim()) qs.set("search", params.search.trim());
  if (params.page != null) qs.set("page", String(params.page));
  if (params.page_size != null) qs.set("page_size", String(params.page_size));
  const query = qs.toString();
  return apiRequest<InvoiceListData>(`/api/admin/invoices/${query ? `?${query}` : ""}`, {
    method: "GET",
    accessToken,
  });
}

/** GET /api/admin/invoices/{public_id}/ */
export function getInvoice(accessToken: string, publicId: string) {
  return apiRequest<InvoiceDetail>(`/api/admin/invoices/${publicId}/`, {
    method: "GET",
    accessToken,
  });
}

/** GET /api/admin/orders/{public_id}/invoices/ — one invoice per business on the order. */
export function listOrderInvoices(accessToken: string, orderPublicId: string) {
  return apiRequest<OrderInvoicesData>(`/api/admin/orders/${orderPublicId}/invoices/`, {
    method: "GET",
    accessToken,
  });
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

const IST = "Asia/Kolkata";

/** Invoice timestamp in IST, e.g. "2 Nov 2026, 7:35 pm". */
export function formatInvoiceDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-IN", {
    timeZone: IST,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Invoice date in IST, e.g. "02 Nov 2026". */
export function formatInvoiceDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", {
    timeZone: IST,
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Today's date in IST as YYYY-MM-DD (the API's date filter format). */
export function istToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: IST }).format(new Date());
}

/** Rupees with paise, e.g. "₹1,234.50". */
export function formatInvoiceMoney(amount: number | null | undefined): string {
  const value = Number.isFinite(amount) ? (amount as number) : 0;
  return (
    "₹" + value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}

/** Same as formatInvoiceMoney without the symbol (for dense table cells). */
export function formatInvoiceAmount(amount: number | null | undefined): string {
  const value = Number.isFinite(amount) ? (amount as number) : 0;
  return value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatGstRate(rate: number | null | undefined): string {
  if (rate == null || !Number.isFinite(rate)) return "—";
  return `${Number(rate.toFixed(2))}%`;
}

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function belowHundred(n: number): string {
  if (n < 20) return ONES[n];
  return [TENS[Math.floor(n / 10)], ONES[n % 10]].filter(Boolean).join(" ");
}

function belowThousand(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  return [hundreds ? `${ONES[hundreds]} Hundred` : "", rest ? belowHundred(rest) : ""]
    .filter(Boolean)
    .join(" ");
}

/** Indian numbering (lakh / crore) in words. */
function integerToWords(n: number): string {
  if (n === 0) return "Zero";
  const parts: string[] = [];
  const crore = Math.floor(n / 10_000_000);
  const lakh = Math.floor((n % 10_000_000) / 100_000);
  const thousand = Math.floor((n % 100_000) / 1000);
  const rest = n % 1000;
  if (crore) parts.push(`${integerToWords(crore)} Crore`);
  if (lakh) parts.push(`${belowHundred(lakh)} Lakh`);
  if (thousand) parts.push(`${belowHundred(thousand)} Thousand`);
  if (rest) parts.push(belowThousand(rest));
  return parts.join(" ");
}

/** "Rupees Two Hundred Eighty and Fifty Paise Only" */
export function amountInWords(amount: number): string {
  if (!Number.isFinite(amount) || amount < 0) return "";
  const totalPaise = Math.round(amount * 100);
  const rupees = Math.floor(totalPaise / 100);
  const paise = totalPaise % 100;
  const words = `Rupees ${integerToWords(rupees)}`;
  return paise ? `${words} and ${belowHundred(paise)} Paise Only` : `${words} Only`;
}

// ---------------------------------------------------------------------------
// Business invoice details form
// ---------------------------------------------------------------------------

export type InvoiceDetailsField = keyof BusinessInvoiceDetailsPayload;
export type InvoiceDetailsForm = Record<InvoiceDetailsField, string>;

export const INVOICE_FIELD_LABELS: Record<InvoiceDetailsField, string> = {
  legal_name: "Legal name",
  gst_number: "GSTIN",
  address: "Address",
  state: "State",
  state_code: "State code",
  fssai_number: "FSSAI number",
  invoice_prefix: "Invoice prefix",
};

export function invoiceFieldLabel(field: string): string {
  return (
    INVOICE_FIELD_LABELS[field as InvoiceDetailsField] ??
    field.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())
  );
}

export function invoiceDetailsToForm(details: BusinessInvoiceDetails | null): InvoiceDetailsForm {
  return {
    legal_name: details?.legal_name ?? "",
    gst_number: details?.gst_number ?? "",
    address: details?.address ?? "",
    state: details?.state ?? "",
    state_code: details?.state_code ?? "",
    fssai_number: details?.fssai_number ?? "",
    invoice_prefix: details?.invoice_prefix ?? "",
  };
}

/** Trims and uppercases the way the backend stores it. */
export function invoiceFormToPayload(form: InvoiceDetailsForm): BusinessInvoiceDetailsPayload {
  return {
    legal_name: form.legal_name.trim(),
    gst_number: form.gst_number.trim().toUpperCase(),
    address: form.address.trim(),
    state: form.state.trim(),
    state_code: form.state_code.trim(),
    fssai_number: form.fssai_number.trim(),
    invoice_prefix: form.invoice_prefix.trim().toUpperCase(),
  };
}

/** 2-digit state code, PAN (5 letters + 4 digits + letter), entity no, Z/letter, check char. */
const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z][A-Z][0-9A-Z]$/;

/** Mirrors the backend rules so most mistakes are caught before the PUT. */
export function validateInvoiceDetails(
  payload: BusinessInvoiceDetailsPayload,
): Partial<Record<InvoiceDetailsField, string>> {
  const errors: Partial<Record<InvoiceDetailsField, string>> = {};
  const { legal_name, gst_number, address, state, state_code, fssai_number, invoice_prefix } =
    payload;

  if (legal_name.length < 2 || legal_name.length > 255) {
    errors.legal_name = "Enter the registered legal name (2–255 characters).";
  }
  if (!GSTIN_PATTERN.test(gst_number)) {
    errors.gst_number = "Enter a valid 15-character GSTIN, e.g. 03AAACD1234E1Z5.";
  }
  if (address.length < 5 || address.length > 500) {
    errors.address = "Enter the registered address (5–500 characters).";
  }
  if (state.length < 2 || state.length > 64) {
    errors.state = "Enter the state (2–64 characters).";
  }
  if (!/^\d{2}$/.test(state_code)) {
    errors.state_code = "Enter the 2-digit state code, e.g. 03 for Punjab.";
  } else if (!errors.gst_number && gst_number.slice(0, 2) !== state_code) {
    errors.state_code = `Must match the first 2 digits of the GSTIN (${gst_number.slice(0, 2)}).`;
  }
  if (!/^\d{14}$/.test(fssai_number)) {
    errors.fssai_number = "FSSAI number must be exactly 14 digits.";
  }
  if (!/^[A-Z]{2,6}$/.test(invoice_prefix)) {
    errors.invoice_prefix = "Use 2–6 letters, e.g. RST or BKR.";
  }
  return errors;
}
