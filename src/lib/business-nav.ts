import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { toast } from "sonner";
import { listBusinesses } from "./api/businesses";
import type { Business, BusinessType } from "./api/types";
import { withAuthRetry } from "./api/with-auth";
import { isRouteVisible } from "./access";
import { useAuth } from "./auth";
import { businessTypeToPanel, isRouteAllowed } from "./panel";

/** Short labels used on toasts, the panel switcher, the strip and the bell. */
export const BUSINESS_TAG: Record<BusinessType, { label: string; emoji: string }> = {
  restaurant: { label: "Restaurant", emoji: "🍽️" },
  bakery: { label: "Bakery", emoji: "🧁" },
  banquet_hall: { label: "Hall", emoji: "🏛️" },
};

export const BUSINESS_TYPE_ORDER: BusinessType[] = ["restaurant", "bakery", "banquet_hall"];

export function isBusinessType(value: unknown): value is BusinessType {
  return value === "restaurant" || value === "bakery" || value === "banquet_hall";
}

/** "🧁 Bakery" — empty string when the type is unknown (older events). */
export function businessTag(type: string | null | undefined): string {
  if (!isBusinessType(type)) return "";
  const tag = BUSINESS_TAG[type];
  return `${tag.emoji} ${tag.label}`;
}

/** "🧁 Bakery · New order" — falls back to the plain title. */
export function withBusinessTag(type: string | null | undefined, title: string): string {
  const tag = businessTag(type);
  return tag ? `${tag} · ${title}` : title;
}

export const businessesListKey = ["businesses", "list"] as const;

function fetchBusinessesList(queryClient: QueryClient) {
  return queryClient.fetchQuery({
    queryKey: businessesListKey,
    queryFn: () => withAuthRetry((t) => listBusinesses(t)),
    staleTime: 5 * 60_000,
  });
}

/** Businesses list (cached for 5 minutes). */
export function useBusinessesList(enabled = true) {
  return useQuery({
    queryKey: businessesListKey,
    queryFn: () => withAuthRetry((t) => listBusinesses(t)),
    staleTime: 5 * 60_000,
    enabled,
  });
}

export type BusinessDestination = {
  businessPublicId?: string | null;
  businessType?: string | null;
  to: string;
  search?: Record<string, string | undefined>;
};

/** True when the destination is another business than the one selected right now. */
export function isOtherBusiness(
  target: Pick<BusinessDestination, "businessPublicId" | "businessType">,
): boolean {
  const current = useAuth.getState().business;
  if (!current) return false;
  if (target.businessPublicId) return target.businessPublicId !== current.publicId;
  if (target.businessType) return target.businessType !== current.type;
  return false;
}

/**
 * Open a page in the right business: switches panel first when the destination belongs to
 * another business, then navigates. Falls back to the dashboard when the page doesn't exist in
 * that panel or the user can't open it.
 */
export function useGoToBusiness() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useCallback(
    async (dest: BusinessDestination) => {
      const go = (to: string) => void navigate({ to, search: dest.search ?? {} } as never);

      if (!isOtherBusiness(dest)) {
        go(dest.to);
        return;
      }

      let biz: Business | undefined;
      try {
        const list = await fetchBusinessesList(queryClient);
        biz =
          list.find((b) => dest.businessPublicId && b.public_id === dest.businessPublicId) ??
          list.find((b) => dest.businessType && b.type === dest.businessType);
      } catch {
        biz = undefined;
      }
      if (!biz) {
        toast.error("Couldn't open that business. Please switch panel manually.");
        return;
      }

      const result = useAuth.getState().selectBusiness(biz);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      const panel = businessTypeToPanel(biz.type);
      const { access, user } = useAuth.getState();
      const allowed =
        panel != null &&
        isRouteAllowed(panel, dest.to) &&
        isRouteVisible(dest.to, panel, { access, role: user?.role });
      go(allowed ? dest.to : "/");
    },
    [navigate, queryClient],
  );
}
