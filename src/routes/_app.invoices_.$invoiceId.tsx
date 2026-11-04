import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { InvoiceDocument } from "@/components/app/invoice-document";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { downloadInvoiceDetailCsv } from "@/lib/invoice-export";
import { getInvoice } from "@/lib/api/invoices";
import { ApiError } from "@/lib/api/types";
import type { InvoiceDetail } from "@/lib/api/types";
import { withAuthRetry } from "@/lib/api/with-auth";
import { useAuth } from "@/lib/auth";
import { z } from "zod";
import { ArrowLeft, Download, ExternalLink, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_app/invoices_/$invoiceId")({
  component: InvoiceDetailPage,
  validateSearch: z.object({ print: z.boolean().optional().catch(undefined) }),
  head: () => ({ meta: [{ title: "Tax Invoice — Daawat Baker's" }] }),
});

function InvoiceDetailPage() {
  const { invoiceId } = Route.useParams();
  const navigate = useNavigate();
  const router = useRouter();
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await withAuthRetry((token) => getInvoice(token, invoiceId));
      setInvoice(data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        useAuth.getState().logout();
        void navigate({ to: "/login" });
        return;
      }
      setError(err instanceof ApiError ? err.message : "Unable to load invoice.");
    } finally {
      setLoading(false);
    }
  }, [invoiceId, navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  // Browser tab title doubles as the default PDF file name when printing.
  useEffect(() => {
    if (!invoice) return;
    const previous = document.title;
    document.title = `Invoice ${invoice.invoice_number.replace(/\//g, "-")}`;
    return () => {
      document.title = previous;
    };
  }, [invoice]);

  // Opened via the list's "PDF" action: open the print dialog once loaded.
  const autoPrint = Route.useSearch().print;
  useEffect(() => {
    if (!autoPrint || !invoice) return;
    const t = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(t);
  }, [autoPrint, invoice]);

  function goBack() {
    if (window.history.length > 1) router.history.back();
    else void navigate({ to: "/invoices" });
  }

  return (
    <div className="min-h-full bg-muted/30 print:bg-white">
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b bg-background/95 px-4 py-3 backdrop-blur sm:px-6 lg:px-8 print:hidden">
        <Button variant="ghost" className="gap-2 rounded-xl" onClick={goBack}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="flex items-center gap-2">
          {invoice && (
            <Button asChild variant="outline" className="gap-2 rounded-xl">
              <Link to="/orders" search={{ order: invoice.order.public_id }}>
                <ExternalLink className="h-4 w-4" /> View order
              </Link>
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="gap-2 rounded-xl" disabled={!invoice}>
                <Download className="h-4 w-4" /> Download
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => invoice && downloadInvoiceDetailCsv(invoice)}>
                CSV
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => window.print()}>PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="p-4 sm:p-6 lg:p-8 print:p-0">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm">Loading invoice…</p>
          </div>
        ) : error || !invoice ? (
          <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
            <div className="max-w-md rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error || "Invoice not found."}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="rounded-xl" onClick={() => void load()}>
                Try again
              </Button>
              <Button asChild variant="ghost" className="rounded-xl">
                <Link to="/invoices">All invoices</Link>
              </Button>
            </div>
          </div>
        ) : (
          <InvoiceDocument invoice={invoice} />
        )}
      </div>
    </div>
  );
}
