import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getInvoice } from "@/lib/api/invoices";
import { listBusinesses } from "@/lib/api/businesses";
import {
  formatInvoiceAmount,
  formatInvoiceDateTime,
  formatInvoiceMoney,
  istToday,
  listInvoices,
} from "@/lib/api/invoices";
import { fulfillmentLabel, paymentLabel } from "@/lib/api/orders";
import { ApiError } from "@/lib/api/types";
import type { Business, InvoiceListData } from "@/lib/api/types";
import { withAuthRetry } from "@/lib/api/with-auth";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import {
  downloadInvoiceDetailCsv,
  downloadInvoicesCsv,
  fetchAllInvoices,
  printInvoicePdf,
  printInvoicesPdf,
} from "@/lib/invoice-export";
import { toast } from "sonner";
import { z } from "zod";

const ymd = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .catch(undefined);

const invoicesSearchSchema = z.object({
  business: z.string().min(1).optional().catch(undefined),
  from: ymd,
  to: ymd,
  q: z.string().optional().catch(undefined),
  page: z.number().int().min(1).optional().catch(undefined),
});

type InvoicesSearch = z.infer<typeof invoicesSearchSchema>;

export const Route = createFileRoute("/_app/invoices")({
  component: InvoicesPage,
  validateSearch: invoicesSearchSchema,
  head: () => ({ meta: [{ title: "Invoices — Daawat Baker's" }] }),
});

const PAGE_SIZE = 20;
const INVOICE_BUSINESS_TYPES = new Set(["restaurant", "bakery"]);
const ALL = "all";

/** Quick IST date ranges, handy for monthly GST returns. */
function presetRange(preset: "today" | "this_month" | "last_month"): { from: string; to: string } {
  const today = istToday();
  if (preset === "today") return { from: today, to: today };
  const [y, m] = today.split("-").map(Number);
  if (preset === "this_month") return { from: `${today.slice(0, 8)}01`, to: today };
  const lastMonthEnd = new Date(Date.UTC(y, m - 1, 0)); // day 0 = last day of previous month
  const iso = lastMonthEnd.toISOString().slice(0, 10);
  return { from: `${iso.slice(0, 8)}01`, to: iso };
}

function InvoicesPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const page = search.page ?? 1;
  const [qInput, setQInput] = useState(search.q ?? "");
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [data, setData] = useState<InvoiceListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);

  const rangeError =
    search.from && search.to && search.from > search.to
      ? "The start date must be on or before the end date."
      : "";

  const setSearch = useCallback(
    (patch: Partial<InvoicesSearch>, options?: { keepPage?: boolean }) => {
      void navigate({
        search: (prev: InvoicesSearch) => {
          const next: InvoicesSearch = { ...prev, ...patch };
          if (!options?.keepPage) next.page = undefined;
          // Drop empty values so the URL stays clean.
          (Object.keys(next) as (keyof InvoicesSearch)[]).forEach((key) => {
            if (next[key] === "" || next[key] == null) delete next[key];
          });
          return next;
        },
        replace: true,
      });
    },
    [navigate],
  );

  const handleAuthError = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.status === 401) {
        useAuth.getState().logout();
        void navigate({ to: "/login" });
        return true;
      }
      return false;
    },
    [navigate],
  );

  // Debounce the search box into the URL.
  useEffect(() => {
    const trimmed = qInput.trim();
    if (trimmed === (search.q ?? "")) return;
    const timer = window.setTimeout(() => setSearch({ q: trimmed || undefined }), 350);
    return () => window.clearTimeout(timer);
  }, [qInput, search.q, setSearch]);

  useEffect(() => {
    let cancelled = false;
    withAuthRetry((token) => listBusinesses(token))
      .then((list) => {
        if (cancelled) return;
        setBusinesses(list.filter((b) => INVOICE_BUSINESS_TYPES.has(b.type)));
      })
      .catch((err) => {
        if (!cancelled) handleAuthError(err);
      });
    return () => {
      cancelled = true;
    };
  }, [handleAuthError]);

  const load = useCallback(async () => {
    if (rangeError) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError("");
    try {
      const result = await withAuthRetry((token) =>
        listInvoices(token, {
          business_public_id: search.business,
          date_from: search.from,
          date_to: search.to,
          search: search.q,
          page,
          page_size: PAGE_SIZE,
        }),
      );
      setData(result);
      const maxPage = Math.max(1, Math.ceil((result.count ?? 0) / (result.page_size || PAGE_SIZE)));
      if (page > maxPage)
        setSearch({ page: maxPage === 1 ? undefined : maxPage }, { keepPage: true });
    } catch (err) {
      if (handleAuthError(err)) return;
      setLoadError(err instanceof ApiError ? err.message : "Unable to load invoices.");
    } finally {
      setLoading(false);
    }
  }, [
    search.business,
    search.from,
    search.to,
    search.q,
    page,
    rangeError,
    handleAuthError,
    setSearch,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const downloadOne = async (publicId: string) => {
    try {
      const inv = await withAuthRetry((token) => getInvoice(token, publicId));
      downloadInvoiceDetailCsv(inv);
    } catch (err) {
      if (handleAuthError(err)) return;
      toast.error(err instanceof ApiError ? err.message : "Download failed.");
    }
  };

  const exportInvoices = async (kind: "csv" | "pdf") => {
    setExporting(kind);
    try {
      const { rows, totals: allTotals } = await withAuthRetry((token) =>
        fetchAllInvoices(token, {
          business_public_id: search.business,
          date_from: search.from,
          date_to: search.to,
          search: search.q,
        }),
      );
      if (rows.length === 0) {
        toast.error("No invoices to export.");
        return;
      }
      if (kind === "csv") downloadInvoicesCsv(rows);
      else {
        const biz =
          businesses.find((b) => b.public_id === search.business)?.name ?? "All businesses";
        const range =
          search.from || search.to ? `${search.from ?? "…"} to ${search.to ?? "…"}` : "All dates";
        printInvoicesPdf(rows, allTotals, `${biz} · ${range}`);
      }
    } catch (err) {
      if (handleAuthError(err)) return;
      toast.error(err instanceof ApiError ? err.message : "Export failed.");
    } finally {
      setExporting(null);
    }
  };

  const count = data?.count ?? 0;
  const totals = data?.totals;
  const results = data?.results ?? [];
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const rangeStart = count === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, count);
  const hasFilters = !!(search.business || search.from || search.to || search.q);

  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <PageHeader
        title="Invoices"
        crumbs={["Admin", "Invoices"]}
        description="GST tax invoices issued automatically when food orders are completed. Invoices can't be edited once issued."
        action={
          <div className="flex flex-wrap gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="gap-2 rounded-xl"
                  disabled={!!exporting || !!rangeError}
                >
                  {exporting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}{" "}
                  Download
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => void exportInvoices("csv")}>CSV</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void exportInvoices("pdf")}>PDF</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="outline"
              className="gap-2 rounded-xl"
              disabled={loading}
              onClick={() => void load()}
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
          </div>
        }
      />

      <div className="space-y-5 p-4 sm:p-6 lg:p-8">
        {/* Filters */}
        <div className="card-elevated space-y-3 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_auto]">
            <div>
              <Label className="text-xs text-muted-foreground">Search</Label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={qInput}
                  onChange={(e) => setQInput(e.target.value)}
                  placeholder="Invoice no, customer phone or order id"
                  className="rounded-xl pl-9"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Business</Label>
              <Select
                value={search.business ?? ALL}
                onValueChange={(value) =>
                  setSearch({ business: value === ALL ? undefined : value })
                }
              >
                <SelectTrigger className="mt-1 h-10 rounded-xl">
                  <SelectValue placeholder="All businesses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All businesses</SelectItem>
                  {businesses.map((b) => (
                    <SelectItem key={b.public_id} value={b.public_id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">From (IST)</Label>
              <Input
                type="date"
                value={search.from ?? ""}
                max={search.to || undefined}
                onChange={(e) => setSearch({ from: e.target.value || undefined })}
                className="mt-1 rounded-xl"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">To (IST)</Label>
              <Input
                type="date"
                value={search.to ?? ""}
                min={search.from || undefined}
                onChange={(e) => setSearch({ to: e.target.value || undefined })}
                className="mt-1 rounded-xl"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ["today", "Today"],
                ["this_month", "This month"],
                ["last_month", "Last month"],
              ] as const
            ).map(([preset, label]) => {
              const range = presetRange(preset);
              const active = search.from === range.from && search.to === range.to;
              return (
                <Button
                  key={preset}
                  type="button"
                  size="sm"
                  variant={active ? "default" : "outline"}
                  className="h-7 rounded-lg text-xs"
                  onClick={() => setSearch(range)}
                >
                  {label}
                </Button>
              );
            })}
            {hasFilters && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 gap-1 rounded-lg text-xs"
                onClick={() => {
                  setQInput("");
                  void navigate({ search: {}, replace: true });
                }}
              >
                <X className="h-3.5 w-3.5" /> Clear filters
              </Button>
            )}
          </div>
          {rangeError && (
            <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {rangeError}
            </p>
          )}
        </div>

        {/* Summary for the whole filter */}
        {totals && !rangeError && !loadError && (
          <div className="card-elevated p-4">
            <div className="mb-3 text-xs text-muted-foreground">
              Totals for all <b className="text-foreground">{count}</b>{" "}
              {count === 1 ? "invoice" : "invoices"}
              {hasFilters ? " matching these filters" : ""}
            </div>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <SummaryStat label="Taxable value" value={totals.taxable_amount} />
              <SummaryStat label="CGST" value={totals.cgst_amount} />
              <SummaryStat label="SGST" value={totals.sgst_amount} />
              {totals.igst_amount > 0 && <SummaryStat label="IGST" value={totals.igst_amount} />}
              <SummaryStat label="Invoice total" value={totals.total_amount} strong />
            </dl>
          </div>
        )}

        {/* Table */}
        <div className="card-elevated overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm">Loading invoices…</p>
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
              <div className="max-w-md rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {loadError}
              </div>
              <Button variant="outline" className="rounded-xl" onClick={() => void load()}>
                Try again
              </Button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Invoice no</th>
                      <th className="px-4 py-3 text-left font-medium">Date (IST)</th>
                      <th className="px-4 py-3 text-left font-medium">Business</th>
                      <th className="px-4 py-3 text-left font-medium">Customer</th>
                      <th className="px-4 py-3 text-left font-medium">Order type</th>
                      <th className="px-4 py-3 text-left font-medium">Payment</th>
                      <th className="px-4 py-3 text-right font-medium">Taxable</th>
                      <th className="px-4 py-3 text-right font-medium">GST</th>
                      <th className="px-4 py-3 text-right font-medium">Total</th>
                      <th className="px-4 py-3 text-left font-medium">Order</th>
                      <th className="px-4 py-3 text-right font-medium">Download</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="px-4 py-16 text-center text-muted-foreground">
                          <FileText className="mx-auto mb-2 h-7 w-7" />
                          {rangeError
                            ? "Fix the date range to see invoices."
                            : hasFilters
                              ? "No invoices match these filters."
                              : "No invoices yet. They appear here when orders are completed."}
                        </td>
                      </tr>
                    ) : (
                      results.map((inv) => (
                        <tr
                          key={inv.public_id}
                          tabIndex={0}
                          role="link"
                          onClick={() =>
                            void navigate({
                              to: "/invoices/$invoiceId",
                              params: { invoiceId: inv.public_id },
                            })
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter")
                              void navigate({
                                to: "/invoices/$invoiceId",
                                params: { invoiceId: inv.public_id },
                              });
                          }}
                          className="cursor-pointer border-b outline-none hover:bg-muted/40 focus-visible:bg-muted/50"
                        >
                          <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold">
                            {inv.invoice_number}
                            {inv.status && inv.status !== "issued" && (
                              <span className="ml-2 rounded bg-destructive/10 px-1.5 py-0.5 font-sans text-[10px] uppercase text-destructive">
                                {inv.status}
                              </span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                            {formatInvoiceDateTime(inv.invoice_date)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                "rounded-md px-2 py-0.5 text-xs font-medium",
                                inv.business.type === "bakery"
                                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                                  : "bg-primary/10 text-primary",
                              )}
                            >
                              {inv.business.name}
                            </span>
                          </td>
                          <td className="px-4 py-3">{inv.buyer_name?.trim() || "—"}</td>
                          <td className="px-4 py-3 text-xs">
                            {fulfillmentLabel(inv.fulfillment_type)}
                          </td>
                          <td className="px-4 py-3 text-xs">{paymentLabel(inv.payment_method)}</td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {formatInvoiceAmount(inv.taxable_amount)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                            {formatInvoiceAmount(inv.total_tax)}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold tabular-nums">
                            {formatInvoiceMoney(inv.total_amount)}
                          </td>
                          <td className="px-4 py-3">
                            <Link
                              to="/orders"
                              search={{ order: inv.order_public_id }}
                              onClick={(e) => e.stopPropagation()}
                              className="font-mono text-xs text-primary hover:underline"
                              title={inv.order_public_id}
                            >
                              {inv.order_public_id.slice(0, 8)}
                            </Link>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0"
                                  title="Download invoice"
                                  aria-label="Download invoice"
                                  onClick={(e) => e.stopPropagation()}
                                  onKeyDown={(e) => e.stopPropagation()}
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                <DropdownMenuItem onSelect={() => void downloadOne(inv.public_id)}>
                                  CSV
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => printInvoicePdf(inv.public_id)}>
                                  PDF
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {count > 0 && (
                <div className="flex flex-col gap-2 border-t bg-muted/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs text-muted-foreground">
                    Showing <b className="text-foreground">{rangeStart}</b>–
                    <b className="text-foreground">{rangeEnd}</b> of{" "}
                    <b className="text-foreground">{count}</b>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-xl"
                      disabled={safePage === 1}
                      onClick={() =>
                        setSearch(
                          { page: safePage - 1 === 1 ? undefined : safePage - 1 },
                          { keepPage: true },
                        )
                      }
                    >
                      <ChevronLeft className="h-4 w-4" /> Prev
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      Page {safePage} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-xl"
                      disabled={safePage === totalPages}
                      onClick={() => setSearch({ page: safePage + 1 }, { keepPage: true })}
                    >
                      Next <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-muted/20 px-3 py-2",
        strong && "border-primary/30 bg-primary/5",
      )}
    >
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 font-semibold tabular-nums",
          strong ? "text-lg text-primary" : "text-base",
        )}
      >
        {formatInvoiceMoney(value)}
      </dd>
    </div>
  );
}
