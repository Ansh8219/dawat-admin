import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";
import { listBusinesses } from "@/lib/api/businesses";
import type { BusinessOrderingCard } from "@/lib/api/types";
import { withAuthRetry } from "@/lib/api/with-auth";
import { useAuth } from "@/lib/auth";
import { normalizeOrdering, outletOrderingQueryKey } from "@/lib/order-channels";
import { usePanel } from "@/lib/use-panel";
import { OrderingStatusPill, type OrderingBusiness } from "./ordering-controls";

/** Header pill: ordering status of the selected outlet, with master + channel switches. */
export function OutletToggle() {
  const queryClient = useQueryClient();
  const business = useAuth((s) => s.business);
  const publicId = business?.publicId;
  const pathname = useLocation({ select: (l) => l.pathname });
  const panel = usePanel();
  const queryKey = outletOrderingQueryKey(publicId);

  const { data } = useQuery({
    queryKey,
    enabled: !!publicId,
    refetchInterval: 30_000,
    queryFn: async (): Promise<OrderingBusiness | null> => {
      const list = await withAuthRetry((token) => listBusinesses(token));
      const row = list.find((b) => b.public_id === publicId);
      if (!row) return null;
      return {
        public_id: row.public_id,
        type: String(row.type),
        name: row.name,
        ...normalizeOrdering(row),
      };
    },
  });

  // The food dashboard has its own control group in its header.
  if ((pathname === "/" && panel !== "banquet") || !publicId || !data) return null;

  function onUpdated(card: BusinessOrderingCard) {
    queryClient.setQueryData<OrderingBusiness | null>(queryKey, (prev) =>
      prev ? { ...prev, ...normalizeOrdering(card) } : prev,
    );
  }

  return <OrderingStatusPill business={data} onUpdated={onUpdated} hideLabelOnMobile />;
}
