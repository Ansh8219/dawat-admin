import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { InvoiceDocument } from "@/components/app/invoice-document";
import { InvoiceEditHistory } from "@/components/app/invoice-edit-history";
import { InvoiceEditor } from "@/components/app/invoice-editor";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { downloadInvoiceDetailCsv } from "@/lib/invoice-export";
import { toast } from "sonner";
import { formatInvoiceDateTime, getInvoice } from "@/lib/api/invoices";
import { useAccess } from "@/lib/access";
import { invoiceSettingsQueryKey, useInvoiceEditingEnabled } from "@/lib/invoice-settings";
import { useQueryClient } from "@tanstack/react-query";
import { BUSINESS_ACCESS_DENIED_MESSAGE } from "@/lib/api/client";
import { isBusinessAccessDenied } from "@/lib/business-scope";
import { ApiError } from "@/lib/api/types";
import type { InvoiceDetail } from "@/lib/api/types";
import { withAuthRetry } from "@/lib/api/with-auth";
import { useAuth } from "@/lib/auth";
import { z } from "zod";
import { ArrowLeft, Download, ExternalLink, History, Pencil } from "lucide-react";

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
  const [editing, setEditing] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const superAdmin = useAccess().isSuperAdmin;
  const editingEnabled = useInvoiceEditingEnabled();
  const queryClient = useQueryClient();
  // Super admin + cash invoice + global switch on. The Edit button is hidden (not disabled)
  // when the switch is off. Backend enforces all three; this only hides the action.
  const canEdit = superAdmin && invoice?.is_editable === true && editingEnabled === true;
  // History ("Edited on …") is also hidden while the switch is off.
  const canSeeHistory = superAdmin && editingEnabled === true;

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
      if (isBusinessAccessDenied(err)) {
        toast.error(BUSINESS_ACCESS_DENIED_MESSAGE);
        void navigate({ to: "/invoices", replace: true });
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

  function handleUnauthorized() {
    useAuth.getState().logout();
    void navigate({ to: "/login" });
  }

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
        <div className="flex flex-wrap items-center gap-2">
          {invoice && canSeeHistory && invoice.last_edited_at && (
            <Button
              variant="ghost"
              className="gap-2 rounded-xl text-muted-foreground"
              onClick={() => setHistoryOpen(true)}
            >
              <History className="h-4 w-4" />
              Edited on {formatInvoiceDateTime(invoice.last_edited_at)}
            </Button>
          )}
          {canEdit && !editing && (
            <Button variant="outline" className="gap-2 rounded-xl" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" /> Edit
            </Button>
          )}
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
            <p className="animate-pulse text-sm">Loading invoice…</p>
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
          <>
            {editing && canEdit && (
              <InvoiceEditor
                // Remount after each save: positions are renumbered by the backend.
                key={invoice.last_edited_at ?? invoice.public_id}
                invoice={invoice}
                onCancel={() => setEditing(false)}
                onUnauthorized={handleUnauthorized}
                onEditingDisabled={() => {
                  setEditing(false);
                  void queryClient.invalidateQueries({ queryKey: invoiceSettingsQueryKey });
                }}
                onSaved={(updated) => {
                  setInvoice(updated);
                  setEditing(false);
                }}
              />
            )}
            {/* Printing always uses the saved invoice, even while editing. */}
            <div className={editing && canEdit ? "hidden print:block" : undefined}>
              <InvoiceDocument invoice={invoice} />
            </div>
            {canSeeHistory && (
              <InvoiceEditHistory
                invoicePublicId={invoice.public_id}
                invoiceNumber={invoice.invoice_number}
                open={historyOpen}
                onOpenChange={setHistoryOpen}
                refreshKey={invoice.last_edited_at}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
