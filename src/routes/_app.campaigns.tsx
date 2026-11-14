import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Lock, Plus, Send } from "lucide-react";
import { toast } from "sonner";
import { CampaignStatusBadge, ChannelIcons } from "@/components/app/campaign-badges";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { listCampaigns } from "@/lib/api/campaigns";
import { ApiError } from "@/lib/api/types";
import type { Campaign, CampaignStatus } from "@/lib/api/types";
import { withAuthRetry } from "@/lib/api/with-auth";
import { useAuth } from "@/lib/auth";
import { audienceLabel, formatDateTime, STATUS_LABELS } from "@/lib/campaigns";

export const Route = createFileRoute("/_app/campaigns")({
  component: CampaignsPage,
  head: () => ({ meta: [{ title: "Campaigns — Daawat Baker's" }] }),
});

const PAGE_SIZE = 20;
type StatusFilter = "all" | CampaignStatus;

function CampaignsPage() {
  const navigate = useNavigate();
  const [results, setResults] = useState<Campaign[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const data = await withAuthRetry((t) =>
        listCampaigns(t, {
          status: status === "all" ? undefined : status,
          page,
          page_size: PAGE_SIZE,
        }),
      );
      setResults(data.results ?? []);
      setCount(data.count ?? 0);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        useAuth.getState().logout();
        void navigate({ to: "/login" });
        return;
      }
      if (err instanceof ApiError && err.status === 403) {
        setForbidden(true);
        return;
      }
      const message = err instanceof ApiError ? err.message : "Unable to load campaigns.";
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [status, page, navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const rangeStart = count === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, count);

  const newButton = (
    <Button asChild className="rounded-xl">
      <Link to="/campaigns/new">
        <Plus className="mr-2 h-4 w-4" /> New campaign
      </Link>
    </Button>
  );

  if (forbidden) {
    return (
      <div>
        <PageHeader title="Campaigns" crumbs={["Growth", "Campaigns"]} />
        <div className="p-4 sm:p-6 lg:p-8">
          <EmptyState
            icon={Lock}
            title="Super admin only"
            description="You don't have permission to manage campaigns."
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Campaigns"
        crumbs={["Growth", "Campaigns"]}
        description="Send push and WhatsApp promotions to customer segments."
        action={newButton}
      />
      <div className="space-y-4 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v as StatusFilter);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-44 rounded-xl" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {(Object.keys(STATUS_LABELS) as CampaignStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          ) : loadError ? (
            <div className="p-6">
              <EmptyState
                icon={Send}
                title="Couldn't load campaigns"
                description={loadError}
                action={<Button onClick={() => void load()}>Try again</Button>}
              />
            </div>
          ) : results.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Send}
                title={status === "all" ? "No campaigns yet" : "No campaigns with this status"}
                description="Create a campaign to message your customers with an offer or announcement."
                action={status === "all" ? newButton : undefined}
              />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium">Channels</th>
                      <th className="px-4 py-3 font-medium">Audience</th>
                      <th className="px-4 py-3 font-medium">Scheduled</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 text-right font-medium">Sent</th>
                      <th className="px-4 py-3 text-right font-medium">Failed</th>
                      <th className="px-4 py-3 text-right font-medium">Skipped</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {results.map((c) => (
                      <tr key={c.id} className="hover:bg-muted/30">
                        <td className="max-w-[260px] px-4 py-3">
                          <Link
                            to="/campaigns/$campaignId"
                            params={{ campaignId: c.id }}
                            className="block truncate font-medium hover:underline"
                          >
                            {c.name}
                          </Link>
                          <div className="truncate text-xs text-muted-foreground">{c.title}</div>
                        </td>
                        <td className="px-4 py-3">
                          <ChannelIcons channels={c.channels} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {audienceLabel(c.audience_type, c.audience_days)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {formatDateTime(c.scheduled_at)}
                        </td>
                        <td className="px-4 py-3">
                          <CampaignStatusBadge status={c.status} />
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{c.sent_count}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{c.failed_count}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{c.skipped_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-col gap-3 border-t px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <div>
                  Showing{" "}
                  <span className="font-medium text-foreground">
                    {rangeStart}–{rangeEnd}
                  </span>{" "}
                  of <span className="font-medium text-foreground">{count}</span>
                </div>
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
    </div>
  );
}
