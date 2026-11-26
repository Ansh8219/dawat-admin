import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2, Lock, Pencil, Send, XCircle } from "lucide-react";
import { toast } from "sonner";
import { CampaignRecipients } from "@/components/app/campaign-recipients";
import { CampaignStatusBadge } from "@/components/app/campaign-badges";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cancelCampaign, getCampaign } from "@/lib/api/campaigns";
import { ApiError } from "@/lib/api/types";
import type { Campaign } from "@/lib/api/types";
import { withAuthRetry } from "@/lib/api/with-auth";
import { useAuth } from "@/lib/auth";
import { audienceLabel, formatDateTime, TERMINAL_STATUSES } from "@/lib/campaigns";

export const Route = createFileRoute("/_app/campaigns_/$campaignId")({
  component: CampaignDetailPage,
  head: () => ({ meta: [{ title: "Campaign — Daawat Baker's" }] }),
});

const POLL_MS = 5000;

function CampaignDetailPage() {
  const { campaignId } = Route.useParams();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [forbidden, setForbidden] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [recipientsKey, setRecipientsKey] = useState(0);
  const lastSent = useRef("");

  const handleAuth = useCallback(
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

  const load = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
        setError("");
      }
      try {
        const c = await withAuthRetry((t) => getCampaign(t, campaignId));
        setCampaign(c);
        const sig = `${c.status}:${c.sent_count}:${c.failed_count}:${c.skipped_count}`;
        if (silent && sig !== lastSent.current) setRecipientsKey((k) => k + 1);
        lastSent.current = sig;
      } catch (err) {
        if (handleAuth(err)) return;
        if (err instanceof ApiError && err.status === 403) {
          setForbidden(true);
          return;
        }
        const msg = err instanceof ApiError ? err.message : "Unable to load campaign.";
        if (silent) toast.error(msg);
        else setError(msg);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [campaignId, handleAuth],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Poll every 5s until the campaign reaches a terminal status. A freshly created
  // "send now" campaign stays `scheduled` briefly, so poll while it is not terminal
  // and its send time has passed (or it is sending).
  const status = campaign?.status;
  const scheduledAt = campaign?.scheduled_at;
  useEffect(() => {
    if (!status || TERMINAL_STATUSES.includes(status)) return;
    const startsSoon =
      status === "sending" ||
      (scheduledAt != null && new Date(scheduledAt).getTime() - Date.now() < 60_000);
    if (!startsSoon) return;
    const id = window.setInterval(() => void load(true), POLL_MS);
    return () => window.clearInterval(id);
  }, [status, scheduledAt, load]);

  async function doCancel() {
    if (!campaign) return;
    setCancelling(true);
    try {
      const updated = await withAuthRetry((t) => cancelCampaign(t, campaign.id));
      setCampaign(updated);
      toast.success("Campaign cancelled");
    } catch (err) {
      if (handleAuth(err)) return;
      if (err instanceof ApiError && err.code === "campaign_not_editable") {
        toast.error(err.message || "This campaign has already started and can't be cancelled.");
        await load(true);
      } else {
        toast.error(err instanceof ApiError ? err.message : "Unable to cancel campaign.");
      }
    } finally {
      setCancelling(false);
      setConfirmCancel(false);
    }
  }

  const isScheduled = campaign?.status === "scheduled";

  return (
    <div>
      <PageHeader
        title={campaign?.name ?? "Campaign"}
        crumbs={["Growth", "Campaigns", "Details"]}
        action={
          campaign && isScheduled ? (
            <div className="flex gap-2">
              <Button asChild variant="outline" className="rounded-xl">
                <Link to="/campaigns/$campaignId/edit" params={{ campaignId: campaign.id }}>
                  <Pencil className="mr-2 h-4 w-4" /> Edit
                </Link>
              </Button>
              <Button
                variant="outline"
                className="rounded-xl text-destructive"
                onClick={() => setConfirmCancel(true)}
              >
                <XCircle className="mr-2 h-4 w-4" /> Cancel
              </Button>
            </div>
          ) : undefined
        }
      />
      <div className="max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/campaigns">
            <ArrowLeft className="mr-1.5 h-4 w-4" /> All campaigns
          </Link>
        </Button>

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-72" />
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
        ) : forbidden ? (
          <EmptyState
            icon={Lock}
            title="Super admin only"
            description="You don't have permission to manage campaigns."
          />
        ) : error || !campaign ? (
          <EmptyState
            icon={Send}
            title="Couldn't load campaign"
            description={error || "Campaign not found."}
            action={<Button onClick={() => void load()}>Try again</Button>}
          />
        ) : (
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="recipients">Recipients</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="mt-4 space-y-6">
              <Overview campaign={campaign} />
            </TabsContent>
            <TabsContent value="recipients" className="mt-4">
              <CampaignRecipients campaignId={campaign.id} refreshKey={recipientsKey} />
            </TabsContent>
          </Tabs>
        )}
      </div>

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this campaign?</AlertDialogTitle>
            <AlertDialogDescription>It won't be sent. This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Keep campaign</AlertDialogCancel>
            <AlertDialogAction
              disabled={cancelling}
              onClick={(e) => {
                e.preventDefault();
                void doCancel();
              }}
            >
              {cancelling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cancel campaign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Overview({ campaign: c }: { campaign: Campaign }) {
  const done = c.sent_count + c.failed_count + c.skipped_count;
  const pct =
    c.total_recipients > 0 ? Math.min(100, Math.round((done / c.total_recipients) * 100)) : 0;
  return (
    <>
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center gap-3">
          <CampaignStatusBadge status={c.status} />
        </div>
        <dl className="mt-4 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
          <Item label="Audience" value={audienceLabel(c.audience_type, c.audience_days)} />
          <Item label="Scheduled for" value={formatDateTime(c.scheduled_at)} />
          <Item label="Started" value={formatDateTime(c.started_at)} />
          <Item label="Completed" value={formatDateTime(c.completed_at)} />
          <Item label="Offer" value={c.offer ? `${c.offer.code} — ${c.offer.title}` : "None"} />
        </dl>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Counter label="Total" value={c.total_recipients} />
          <Counter label="Sent" value={c.sent_count} tone="text-success" />
          <Counter label="Failed" value={c.failed_count} tone="text-destructive" />
          <Counter label="Skipped" value={c.skipped_count} />
        </div>
        {(c.status === "sending" || (c.status === "scheduled" && c.total_recipients > 0)) && (
          <div className="mt-4 space-y-1.5">
            <Progress value={pct} aria-label="Sending progress" />
            <p className="text-xs text-muted-foreground">
              {done} of {c.total_recipients} processed · updating every 5 seconds
            </p>
          </div>
        )}
        {c.status === "scheduled" && c.total_recipients === 0 && (
          <p className="mt-4 text-xs text-muted-foreground">
            Not started yet. Counters appear once sending begins.
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Message
        </div>
        <div className="font-medium">{c.title}</div>
        <div className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{c.body}</div>
        {c.image_url && (
          <img src={c.image_url} alt="" className="mt-3 max-h-48 rounded-xl object-cover" />
        )}
      </div>
    </>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function Counter({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold tabular-nums ${tone ?? ""}`}>{value}</div>
    </div>
  );
}
