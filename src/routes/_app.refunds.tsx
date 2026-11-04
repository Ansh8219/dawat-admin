import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAccess } from "@/lib/access";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCustomerPhone } from "@/lib/api/customers";
import { formatOrderMoney } from "@/lib/api/orders";
import {
  canRetryRefund,
  listAdminRefunds,
  refundDestinationLabel,
  refundErrorMessage,
  refundReasonLabel,
  refundStatusLabel,
  retryAdminRefund,
} from "@/lib/api/refunds";
import { ApiError } from "@/lib/api/types";
import type { AdminRefund, AdminRefundStatus } from "@/lib/api/types";
import { withAuthRetry } from "@/lib/api/with-auth";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Loader2, RefreshCw, RotateCcw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/refunds")({
  component: RefundsPage,
  head: () => ({ meta: [{ title: "Refunds — Daawat Baker's" }] }),
});

const PAGE_SIZE = 20;

type StatusFilter = "all" | AdminRefundStatus;

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "processed", label: "Processed" },
  { value: "failed", label: "Failed" },
];

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function refundOrderCode(refund: AdminRefund): string {
  return refund.order?.order_code?.trim() || refund.order?.public_id.slice(0, 8) || "—";
}

function RefundsPage() {
  const manageRefunds = useAccess().canManage("refunds");
  const navigate = useNavigate();
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [results, setResults] = useState<AdminRefund[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [retryingId, setRetryingId] = useState<string | null>(null);

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

  const refresh = useCallback(
    async (options?: { showLoading?: boolean }) => {
      const showLoading = options?.showLoading ?? false;
      if (showLoading) {
        setLoading(true);
        setLoadError("");
      }
      try {
        const data = await withAuthRetry((token) =>
          listAdminRefunds(token, {
            status: status === "all" ? undefined : status,
            page,
            page_size: PAGE_SIZE,
          }),
        );
        setResults(data.results ?? []);
        setCount(data.count ?? 0);
        const maxPage = Math.max(1, Math.ceil((data.count ?? 0) / (data.page_size || PAGE_SIZE)));
        if (page > maxPage) setPage(maxPage);
      } catch (err) {
        if (handleAuthError(err)) return;
        const message = refundErrorMessage(err, "Unable to load refunds.");
        if (showLoading) setLoadError(message);
        else toast.error(message);
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [status, page, handleAuthError],
  );

  useEffect(() => {
    void refresh({ showLoading: true });
  }, [refresh]);

  async function retry(refund: AdminRefund) {
    setRetryingId(refund.public_id);
    try {
      const updated = await withAuthRetry((token) => retryAdminRefund(token, refund.public_id));
      setResults((prev) =>
        prev.map((r) => (r.public_id === refund.public_id ? { ...r, ...updated } : r)),
      );
      if (updated.status === "failed") {
        toast.error(`Refund for ${refundOrderCode(refund)} failed again. Razorpay refused it.`);
      } else {
        toast.success(`Refund for ${refundOrderCode(refund)} retried`);
      }
    } catch (err) {
      if (handleAuthError(err)) return;
      toast.error(refundErrorMessage(err, "Unable to retry refund"));
    } finally {
      setRetryingId(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const rangeStart = count === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, count);

  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <PageHeader
        title="Refunds"
        crumbs={["Admin", "Refunds"]}
        description="Automatic refunds for customer-cancelled and rejected orders. Wallet refunds are instant; online refunds take 5–7 working days."
        action={
          <Button
            variant="outline"
            className="rounded-xl gap-2"
            disabled={loading}
            onClick={() => void refresh({ showLoading: true })}
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        }
      />

      <div className="space-y-5 p-4 sm:p-6 lg:p-8">
        <div className="card-elevated overflow-hidden">
          <div className="border-b p-3">
            <Tabs
              value={status}
              onValueChange={(value) => {
                setStatus(value as StatusFilter);
                setPage(1);
              }}
            >
              <TabsList className="rounded-xl">
                {FILTERS.map((f) => (
                  <TabsTrigger key={f.value} value={f.value}>
                    {f.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm">Loading refunds…</p>
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
              <div className="max-w-md rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {loadError}
              </div>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => void refresh({ showLoading: true })}
              >
                Try again
              </Button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Order code</th>
                      <th className="px-4 py-3 text-left font-medium">Customer</th>
                      <th className="px-4 py-3 text-right font-medium">Amount</th>
                      <th className="px-4 py-3 text-left font-medium">Method</th>
                      <th className="px-4 py-3 text-left font-medium">Reason</th>
                      <th className="px-4 py-3 text-left font-medium">Status</th>
                      <th className="px-4 py-3 text-left font-medium">Initiated</th>
                      <th className="px-4 py-3 text-left font-medium">Refunded / Failed</th>
                      <th className="px-4 py-3 text-left font-medium">Razorpay refund ID</th>
                      <th className="px-4 py-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.length === 0 ? (
                      <tr>
                        <td
                          colSpan={10}
                          className="px-4 py-16 text-center text-sm text-muted-foreground"
                        >
                          No refunds found.
                        </td>
                      </tr>
                    ) : (
                      results.map((r) => {
                        const failed = r.status === "failed";
                        return (
                          <tr
                            key={r.public_id}
                            className={cn(
                              "border-b hover:bg-muted/40",
                              failed && "bg-destructive/5 hover:bg-destructive/10",
                            )}
                          >
                            <td className="px-4 py-3">
                              <div className="font-medium">{refundOrderCode(r)}</div>
                              <div className="text-xs text-muted-foreground">
                                {formatDateTime(r.order?.ordered_at)}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-medium">
                                {r.customer?.full_name?.trim() || "—"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {r.customer ? formatCustomerPhone(r.customer) || "—" : "—"}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right font-semibold">
                              {formatOrderMoney(r.amount)}
                            </td>
                            <td className="px-4 py-3 text-xs">
                              {refundDestinationLabel(r.destination)}
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">
                              {refundReasonLabel(r.reason)}
                            </td>
                            <td className="px-4 py-3">
                              <StatusBadge status={refundStatusLabel(r.status)} />
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">
                              {formatDateTime(r.initiated_at)}
                            </td>
                            <td
                              className={cn(
                                "px-4 py-3 text-xs",
                                failed ? "text-destructive" : "text-muted-foreground",
                              )}
                            >
                              {formatDateTime(failed ? r.failed_at : r.refunded_at)}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                              {r.razorpay_refund_id || "—"}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {manageRefunds && canRetryRefund(r) && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 gap-1 rounded-lg text-xs"
                                  disabled={retryingId === r.public_id}
                                  onClick={() => void retry(r)}
                                >
                                  {retryingId === r.public_id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <RotateCcw className="h-3.5 w-3.5" />
                                  )}
                                  Retry
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })
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
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
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
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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
