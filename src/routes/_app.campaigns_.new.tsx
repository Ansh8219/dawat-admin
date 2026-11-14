import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { CampaignForm } from "@/components/app/campaign-form";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/campaigns_/new")({
  component: NewCampaignPage,
  head: () => ({ meta: [{ title: "New Campaign — Daawat Baker's" }] }),
});

function NewCampaignPage() {
  return (
    <div>
      <PageHeader title="New campaign" crumbs={["Growth", "Campaigns", "New"]} />
      <div className="max-w-6xl space-y-4 p-4 sm:p-6 lg:p-8">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/campaigns">
            <ArrowLeft className="mr-1.5 h-4 w-4" /> All campaigns
          </Link>
        </Button>
        <CampaignForm />
      </div>
    </div>
  );
}
