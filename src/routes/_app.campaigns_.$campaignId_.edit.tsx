import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Lock, Send } from "lucide-react";
import { CampaignForm } from "@/components/app/campaign-form";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getCampaign } from "@/lib/api/campaigns";
import { ApiError } from "@/lib/api/types";
import type { Campaign } from "@/lib/api/types";
import { withAuthRetry } from "@/lib/api/with-auth";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/campaigns_/$campaignId_/edit")({
  component: EditCampaignPage,
  head: () => ({ meta: [{ title: "Edit Campaign — Daawat Baker's" }] }),
});

function EditCampaignPage() {
  const { campaignId } = Route.useParams();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setCampaign(await withAuthRetry((t) => getCampaign(t, campaignId)));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        useAuth.getState().logout();
        void navigate({ to: "/login" });
        return;
      }
      if (err instanceof ApiError && err.status === 403) setForbidden(true);
      else setError(err instanceof ApiError ? err.message : "Unable to load campaign.");
    } finally {
      setLoading(false);
    }
  }, [campaignId, navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  const back = (
    <Button asChild variant="ghost" size="sm" className="-ml-2">
      <Link to="/campaigns/$campaignId" params={{ campaignId }}>
        <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to campaign
      </Link>
    </Button>
  );

  return (
    <div>
      <PageHeader
        title={campaign ? `Edit: ${campaign.name}` : "Edit campaign"}
        crumbs={["Growth", "Campaigns", "Edit"]}
      />
      <div className="max-w-6xl space-y-4 p-4 sm:p-6 lg:p-8">
        {back}
        {loading ? (
          <Skeleton className="h-96 w-full rounded-2xl" />
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
        ) : campaign.status !== "scheduled" ? (
          <EmptyState
            icon={Lock}
            title="This campaign can no longer be edited"
            description="Only scheduled campaigns can be edited. This one has already started, finished or been cancelled."
            action={
              <Button asChild>
                <Link to="/campaigns/$campaignId" params={{ campaignId }}>
                  View campaign
                </Link>
              </Button>
            }
          />
        ) : (
          <CampaignForm
            campaign={campaign}
            onStale={() => void navigate({ to: "/campaigns/$campaignId", params: { campaignId } })}
          />
        )}
      </div>
    </div>
  );
}
