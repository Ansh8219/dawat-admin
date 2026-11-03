import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { formatInvoiceDate, formatInvoiceMoney, listOrderInvoices } from "@/lib/api/invoices";
import { ApiError } from "@/lib/api/types";
import type { InvoiceDetail } from "@/lib/api/types";
import { withAuthRetry } from "@/lib/api/with-auth";
import { AlertTriangle, ChevronRight, FileText, Loader2 } from "lucide-react";

/**
 * Invoices for a completed order: one per business (a mixed restaurant + bakery
 * order has two; the delivery charge sits on the restaurant invoice).
 */
export function OrderInvoices({ orderPublicId }: { orderPublicId: string }) {
  const [invoices, setInvoices] = useState<InvoiceDetail[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(
    async (signal?: { cancelled: boolean }) => {
      setLoading(true);
      setError("");
      try {
        const data = await withAuthRetry((token) => listOrderInvoices(token, orderPublicId));
        if (!signal?.cancelled) setInvoices(data.results ?? []);
      } catch (err) {
        if (!signal?.cancelled) {
          setError(err instanceof ApiError ? err.message : "Unable to load invoices.");
        }
      } finally {
        if (!signal?.cancelled) setLoading(false);
      }
    },
    [orderPublicId],
  );

  useEffect(() => {
    const signal = { cancelled: false };
    setInvoices(null);
    void load(signal);
    return () => {
      signal.cancelled = true;
    };
  }, [load]);

  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Invoices</div>
      {loading ? (
        <div className="flex items-center gap-2 rounded-xl border p-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading invoices…
        </div>
      ) : error ? (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <span>{error}</span>
          <button
            type="button"
            className="text-xs font-semibold underline"
            onClick={() => void load()}
          >
            Retry
          </button>
        </div>
      ) : !invoices || invoices.length === 0 ? (
        <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <div>
              <div className="font-semibold">Invoice pending: fill business invoice details</div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                No invoice was issued because the business's GST details were missing when this
                order completed. Fill them in, then ask the backend team to run the invoice
                backfill.
              </p>
              <Link
                to="/settings"
                search={{ tab: "businesses" }}
                className="mt-1.5 inline-block text-xs font-semibold text-primary hover:underline"
              >
                Open business invoice details →
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {invoices.map((inv) => (
            <Link
              key={inv.public_id}
              to="/invoices/$invoiceId"
              params={{ invoiceId: inv.public_id }}
              className="flex items-center gap-3 rounded-xl border p-3 text-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <FileText className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-mono text-xs font-semibold">
                  {inv.invoice_number}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {inv.business.name} · {formatInvoiceDate(inv.invoice_date)}
                </span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums">
                {formatInvoiceMoney(inv.total_amount)}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
