import { Bell, MessageCircle } from "lucide-react";
import { StatusBadge } from "@/components/app/status-badge";
import type { CampaignChannel, CampaignStatus } from "@/lib/api/types";
import { CHANNEL_LABELS, STATUS_CLASSES, STATUS_LABELS } from "@/lib/campaigns";
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

export function ChannelIcons({ channels }: { channels: CampaignChannel[] }) {
  return (
    <div className="flex items-center gap-1.5">
      {channels.map((c) => {
        const Icon = c === "push" ? Bell : MessageCircle;
        return (
          <span
            key={c}
            title={CHANNEL_LABELS[c]}
            className="grid h-7 w-7 place-items-center rounded-lg bg-muted text-muted-foreground"
          >
            <Icon className="h-4 w-4" aria-label={CHANNEL_LABELS[c]} />
          </span>
        );
      })}
    </div>
  );
}
