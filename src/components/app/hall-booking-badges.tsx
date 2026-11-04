import { Badge } from "@/components/ui/badge";
import {
  HALL_BOOKING_STATUS_LABELS,
  type HallBookingStatus,
  type HallRefundStatus,
} from "@/lib/api/hall-bookings";
import { cn } from "@/lib/utils";

const STATUS_CLASS: Record<HallBookingStatus, string> = {
  pending_payment: "bg-muted text-muted-foreground border-border",
  pending_approval: "bg-warning/15 text-warning border-warning/40",
  confirmed: "bg-success/15 text-success border-success/30",
  completed: "bg-info/15 text-info border-info/30",
  no_show: "bg-orange-500/15 text-orange-600 border-orange-500/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
  expired: "bg-muted text-muted-foreground border-border",
};

export function HallStatusBadge({ status }: { status: HallBookingStatus }) {
  return (
    <Badge variant="outline" className={cn("whitespace-nowrap", STATUS_CLASS[status])}>
      {HALL_BOOKING_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

const REFUND_CLASS: Record<HallRefundStatus, string> = {
  pending: "bg-warning/15 text-warning border-warning/40",
  processed: "bg-success/15 text-success border-success/30",
  failed: "bg-destructive/15 text-destructive border-destructive/30",
};

export function HallRefundBadge({ status }: { status: HallRefundStatus | null | undefined }) {
  if (!status) return null;
  return (
    <Badge variant="outline" className={cn("whitespace-nowrap", REFUND_CLASS[status])}>
      Refund {status}
    </Badge>
  );
}
