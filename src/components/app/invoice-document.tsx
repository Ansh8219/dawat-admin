import type { TdHTMLAttributes, ThHTMLAttributes } from "react";
import {
  amountInWords,
  formatGstRate,
  formatInvoiceAmount,
  formatInvoiceDate,
  formatInvoiceDateTime,
  formatInvoiceMoney,
} from "@/lib/api/invoices";
import { fulfillmentLabel, paymentLabel } from "@/lib/api/orders";
import type { InvoiceDetail } from "@/lib/api/types";
import { cn } from "@/lib/utils";

/**
 * Standard Indian GST tax invoice. Always rendered as a white "paper" sheet so
 * screen and A4 print look the same (see `.invoice-sheet` print rules in styles.css).
 */
export function InvoiceDocument({ invoice }: { invoice: InvoiceDetail }) {
  const { seller, buyer, order } = invoice;
  const showIgst = (invoice.igst_amount ?? 0) > 0;
  const tip = order?.tip_amount ?? 0;

  return (
    <article className="invoice-sheet mx-auto w-full max-w-[210mm] bg-white p-6 text-[12px] leading-snug text-neutral-900 shadow-elevated sm:p-8 print:max-w-none print:p-0 print:shadow-none">
      {/* Title */}
      <div className="flex items-start justify-between gap-4 border-b-2 border-neutral-900 pb-2">
        <h1 className="text-lg font-bold uppercase tracking-wider">
          {invoice.title || "Tax Invoice"}
        </h1>
        <div className="text-right text-[11px] text-neutral-600">
          {invoice.status && invoice.status !== "issued" && (
            <div className="font-semibold uppercase text-red-700">{invoice.status}</div>
          )}
          <div>Original for recipient</div>
        </div>
      </div>

      {/* Seller */}
      <section className="border-b border-neutral-300 py-3">
        <div className="text-base font-bold">{seller.legal_name}</div>
        {seller.name && seller.name !== seller.legal_name && (
          <div className="text-[11px] text-neutral-600">Trade name: {seller.name}</div>
        )}
        <div className="mt-1 whitespace-pre-line">{seller.address}</div>
        <div className="mt-1 grid gap-x-6 gap-y-0.5 sm:grid-cols-3 print:grid-cols-3">
          <Field label="GSTIN" value={seller.gstin} mono />
          <Field label="FSSAI Lic. No." value={seller.fssai_number} mono />
          <Field label="State" value={`${seller.state} (${seller.state_code})`} />
        </div>
      </section>

      {/* Invoice meta + buyer */}
      <section className="grid border-b border-neutral-300 sm:grid-cols-2 print:grid-cols-2">
        <div className="space-y-0.5 py-3 sm:border-r sm:border-neutral-300 sm:pr-4 print:border-r print:border-neutral-300 print:pr-4">
          <Field label="Invoice No." value={invoice.invoice_number} mono strong />
          <Field label="Invoice Date" value={formatInvoiceDate(invoice.invoice_date)} />
          <Field label="Financial Year" value={invoice.financial_year} />
          <Field
            label="Place of Supply"
            value={`${invoice.place_of_supply} (${invoice.place_of_supply_code})`}
          />
          <Field label="Reverse Charge" value="No" />
        </div>
        <div className="space-y-0.5 py-3 sm:pl-4 print:pl-4">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
            Bill to
          </div>
          <div className="font-semibold">{buyer.name?.trim() || "Walk-in customer"}</div>
          {buyer.phone && <div>{buyer.phone}</div>}
          {buyer.address && <div className="whitespace-pre-line">{buyer.address}</div>}
          <div className="pt-1.5">
            <Field label="Order" value={order.public_id} mono />
            <Field
              label="Order type"
              value={`${fulfillmentLabel(order.fulfillment_type)} · ${paymentLabel(order.payment_method)}`}
            />
            {order.ordered_at && (
              <Field label="Ordered" value={formatInvoiceDateTime(order.ordered_at)} />
            )}
          </div>
        </div>
      </section>

      {/* Lines */}
      <div className="mt-3 overflow-x-auto print:overflow-visible">
        <table className="w-full border-collapse text-[11px] tabular-nums print:text-[9.5px]">
          <thead>
            <tr className="bg-neutral-100">
              <Th rowSpan={2} className="w-6 text-left">
                #
              </Th>
              <Th rowSpan={2} className="min-w-40 text-left">
                Description
              </Th>
              <Th rowSpan={2}>SAC</Th>
              <Th rowSpan={2}>Qty</Th>
              <Th rowSpan={2}>Rate</Th>
              <Th rowSpan={2}>Gross</Th>
              <Th rowSpan={2}>Discount</Th>
              <Th rowSpan={2}>Taxable</Th>
              <Th colSpan={2} className="text-center">
                CGST
              </Th>
              <Th colSpan={2} className="text-center">
                SGST
              </Th>
              {showIgst && (
                <Th colSpan={2} className="text-center">
                  IGST
                </Th>
              )}
              <Th rowSpan={2}>Total</Th>
            </tr>
            <tr className="bg-neutral-100">
              <Th>%</Th>
              <Th>Amt</Th>
              <Th>%</Th>
              <Th>Amt</Th>
              {showIgst && (
                <>
                  <Th>%</Th>
                  <Th>Amt</Th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line) => (
              <tr key={line.position} className="break-inside-avoid">
                <Td className="text-left">{line.position}</Td>
                <Td className="text-left">
                  {line.description}
                  {line.line_type === "delivery" && !/deliver/i.test(line.description) && (
                    <span className="ml-1 text-neutral-500">(delivery charge)</span>
                  )}
                </Td>
                <Td className="font-mono">{line.sac_code}</Td>
                <Td>{line.quantity}</Td>
                <Td>{formatInvoiceAmount(line.unit_price)}</Td>
                <Td>{formatInvoiceAmount(line.gross_amount)}</Td>
                <Td>{line.discount_amount ? formatInvoiceAmount(line.discount_amount) : "—"}</Td>
                <Td>{formatInvoiceAmount(line.taxable_amount)}</Td>
                <Td>{formatGstRate(line.cgst_rate)}</Td>
                <Td>{formatInvoiceAmount(line.cgst_amount)}</Td>
                <Td>{formatGstRate(line.sgst_rate)}</Td>
                <Td>{formatInvoiceAmount(line.sgst_amount)}</Td>
                {showIgst && (
                  <>
                    <Td>{line.igst_amount ? formatGstRate(line.gst_rate) : "—"}</Td>
                    <Td>{formatInvoiceAmount(line.igst_amount)}</Td>
                  </>
                )}
                <Td className="font-semibold">{formatInvoiceAmount(line.total_amount)}</Td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-neutral-50 font-semibold">
              <Td className="text-left" colSpan={5}>
                Total
              </Td>
              <Td>{formatInvoiceAmount(invoice.gross_amount)}</Td>
              <Td>
                {invoice.discount_amount ? formatInvoiceAmount(invoice.discount_amount) : "—"}
              </Td>
              <Td>{formatInvoiceAmount(invoice.taxable_amount)}</Td>
              <Td />
              <Td>{formatInvoiceAmount(invoice.cgst_amount)}</Td>
              <Td />
              <Td>{formatInvoiceAmount(invoice.sgst_amount)}</Td>
              {showIgst && (
                <>
                  <Td />
                  <Td>{formatInvoiceAmount(invoice.igst_amount)}</Td>
                </>
              )}
              <Td>{formatInvoiceAmount(invoice.total_amount)}</Td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Totals + notes */}
      <section className="mt-4 grid gap-4 break-inside-avoid sm:grid-cols-[1fr_auto] print:grid-cols-[1fr_auto]">
        <div className="space-y-2 text-[11px]">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
              Amount in words
            </div>
            <div className="font-medium">{amountInWords(invoice.total_amount)}</div>
          </div>
          <p className="text-neutral-600">
            Prices are inclusive of GST. Invoice total = taxable value + total tax.
          </p>
          {tip > 0 && (
            <p className="rounded border border-neutral-300 px-2 py-1.5 text-neutral-700">
              Driver tip {formatInvoiceMoney(tip)} paid separately, not part of this invoice.
            </p>
          )}
        </div>

        <dl className="min-w-60 text-[12px]">
          <TotalRow label="Taxable value" value={invoice.taxable_amount} />
          <TotalRow label="CGST" value={invoice.cgst_amount} />
          <TotalRow label="SGST" value={invoice.sgst_amount} />
          {showIgst && <TotalRow label="IGST" value={invoice.igst_amount} />}
          <TotalRow label="Total tax" value={invoice.total_tax} />
          <div className="mt-1 flex items-center justify-between gap-6 border-t-2 border-neutral-900 pt-1.5 text-sm font-bold">
            <dt>Invoice total</dt>
            <dd className="tabular-nums">{formatInvoiceMoney(invoice.total_amount)}</dd>
          </div>
        </dl>
      </section>

      <footer className="mt-8 flex items-end justify-between gap-4 break-inside-avoid border-t border-neutral-300 pt-3 text-[11px] text-neutral-600">
        <div>This is a computer-generated invoice.</div>
        <div className="text-right">
          <div className="font-semibold text-neutral-900">For {seller.legal_name}</div>
          <div className="mt-6">Authorised signatory</div>
        </div>
      </footer>
    </article>
  );
}

function Field({
  label,
  value,
  mono = false,
  strong = false,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex gap-1.5">
      <span className="shrink-0 text-neutral-500">{label}:</span>
      <span className={cn("min-w-0 break-all", mono && "font-mono", strong && "font-bold")}>
        {value?.toString().trim() || "—"}
      </span>
    </div>
  );
}

function TotalRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-6 py-0.5">
      <dt className="text-neutral-600">{label}</dt>
      <dd className="tabular-nums">{formatInvoiceMoney(value)}</dd>
    </div>
  );
}

function Th({ className, children, ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "border border-neutral-300 px-1.5 py-1 text-right text-[10px] font-semibold uppercase tracking-wide text-neutral-700 print:text-[8.5px]",
        className,
      )}
      {...rest}
    >
      {children}
    </th>
  );
}

function Td({ className, children, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn("border border-neutral-300 px-1.5 py-1 text-right align-top", className)}
      {...rest}
    >
      {children}
    </td>
  );
}
