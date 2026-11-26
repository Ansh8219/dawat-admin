import { AlertCircle, ArrowRight, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  actionCount,
  pendingDestination,
  pendingParts,
  usePendingSummary,
} from "@/hooks/use-cross-business";
import type { PendingSummaryBusiness } from "@/lib/api/types";
import { useAuth } from "@/lib/auth";
import { BUSINESS_TAG, isBusinessType, useGoToBusiness } from "@/lib/business-nav";

/** Changes whenever any count changes, so a dismissed line comes back when something new arrives. */
function signature(b: PendingSummaryBusiness) {
  return `${b.business_public_id}:${b.new_orders}:${b.counter_payments_pending}:${b.new_hall_enquiries}`;
}

/**
 * Banner under the top bar listing waiting work in the OTHER businesses (the current one has
 * its own pages). Stays until the work is handled or dismissed; returns when counts change.
 */
export function CrossBusinessStrip() {
  const currentId = useAuth((s) => s.business?.publicId ?? null);
  const { data } = usePendingSummary();
  const goTo = useGoToBusiness();
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());

  const rows = (data?.businesses ?? []).filter(
    (b) => b.business_public_id !== currentId && actionCount(b) > 0 && !dismissed.has(signature(b)),
  );
  if (rows.length === 0) return null;

  return (
    <div className="space-y-px border-b border-destructive/20 bg-destructive/[0.06] print:hidden">
      {rows.map((b) => {
        const tag = isBusinessType(b.business_type) ? BUSINESS_TAG[b.business_type] : null;
        const dest = pendingDestination(b);
        return (
          <div
            key={b.business_public_id}
            className="flex items-center gap-2 px-4 py-1.5 text-xs sm:px-6"
            role="status"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
            <span className="min-w-0 flex-1 truncate">
              <span className="font-semibold">
                {tag ? `${tag.emoji} ${b.business_name || tag.label}` : b.business_name}:
              </span>{" "}
              <span className="text-foreground/80">{pendingParts(b).join(" · ")}</span>
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 shrink-0 gap-1 rounded-lg border-destructive/30 bg-background px-2.5 text-xs"
              onClick={() =>
                void goTo({
                  businessPublicId: b.business_public_id,
                  businessType: b.business_type,
                  ...dest,
                })
              }
            >
              Go to {tag?.label ?? "panel"} <ArrowRight className="h-3 w-3" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 shrink-0"
              aria-label="Hide until something new arrives"
              title="Hide until something new arrives"
              onClick={() => setDismissed((prev) => new Set(prev).add(signature(b)))}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}
