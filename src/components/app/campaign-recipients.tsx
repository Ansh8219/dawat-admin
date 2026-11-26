import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Users } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { listCampaignRecipients } from "@/lib/api/campaigns";
import { ApiError } from "@/lib/api/types";
import type { CampaignRecipient, CampaignRecipientStatus } from "@/lib/api/types";
import { withAuthRetry } from "@/lib/api/with-auth";
import { formatDateTime, recipientErrorLabel } from "@/lib/campaigns";

const PAGE_SIZE = 25;

const STATUS_CLASS: Record<CampaignRecipientStatus, string> = {
  sent: "bg-success/15 text-success border-success/30",
  failed: "bg-destructive/15 text-destructive border-destructive/30",
  skipped: "bg-muted text-muted-foreground border-border",
};

export function CampaignRecipients({
  campaignId,
  refreshKey,
}: {
  campaignId: string;
  /** Changes when the campaign counters change, so the log reloads while sending. */
  refreshKey: number;
}) {
  const [rows, setRows] = useState<CampaignRecipient[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<"all" | CampaignRecipientStatus>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(
    async (silent: boolean) => {
      if (!silent) {
        setLoading(true);
        setError("");
      }
      try {
        const data = await withAuthRetry((t) =>
          listCampaignRecipients(t, campaignId, {
            status: status === "all" ? undefined : status,
            page,
            page_size: PAGE_SIZE,
          }),
        );
        setRows(data.results ?? []);
        setCount(data.count ?? 0);
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : "Unable to load recipients.";
        if (silent) toast.error(msg);
        else setError(msg);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [campaignId, status, page],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  // Silent reload when the parent's counters move (polling while sending).
  useEffect(() => {
    if (refreshKey > 0) void load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v as typeof status);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40 rounded-xl" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="skipped">Skipped</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <div className="p-6">
            <EmptyState
              icon={Users}
              title="Couldn't load recipients"
              description={error}
              action={<Button onClick={() => void load(false)}>Try again</Button>}
            />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Users}
              title="No deliveries yet"
              description="Recipients appear here once the campaign starts sending."
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Customer</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Detail</th>
                    <th className="px-4 py-3 font-medium">Sent at</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((r, i) => (
                    <tr key={`${r.user_id}-${r.channel}-${i}`}>
                      <td className="px-4 py-2.5 font-mono text-xs">{String(r.user_id)}</td>
                      <td className="px-4 py-2.5">
                        <StatusBadge
                          status={r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                          className={STATUS_CLASS[r.status]}
                        />
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {recipientErrorLabel(r.error)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5">{formatDateTime(r.sent_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground">
              <span>{count} deliveries</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  aria-label="Previous page"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="tabular-nums">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  aria-label="Next page"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
