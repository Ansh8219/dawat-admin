import { StatusBadge } from "@/components/app/status-badge";
import type { CampaignStatus } from "@/lib/api/types";
import { STATUS_CLASSES, STATUS_LABELS } from "@/lib/campaigns";
import { cn } from "@/lib/utils";

export function CampaignStatusBadge({
  status,
  className,
}: {
  status: CampaignStatus;
  className?: string;
}) {
  return (
    <StatusBadge
      status={STATUS_LABELS[status] ?? status}
      className={cn(STATUS_CLASSES[status], className)}
    />
  );
}
