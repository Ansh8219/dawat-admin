import { useQuery, type QueryClient } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  adminNotificationsKeys,
  getAdminNotificationsUnreadCount,
  getPendingSummary,
  pendingSummaryKeys,
} from "@/lib/api/notifications";
import {
  ApiError,
  type AdminNotificationUnreadCountData,
  type BusinessType,
  type PendingSummaryBusiness,
  type PendingSummaryData,
} from "@/lib/api/types";
import { withAuthRetry } from "@/lib/api/with-auth";
import { useAuth } from "@/lib/auth";
import { isOtherBusiness, useGoToBusiness, withBusinessTag } from "@/lib/business-nav";
import { showDesktopAlert } from "@/lib/realtime/attention";
import { playAlertTone } from "@/lib/realtime/new-order-chime";

// ── Unread notification counts (bell + panel switcher) ───────────────────────

const UNREAD_POLL_MS = 60_000;

export function useUnreadCounts() {
  const signedIn = useAuth((s) => Boolean(s.tokens?.access));
  return useQuery({
    queryKey: adminNotificationsKeys.unreadCount(),
    enabled: signedIn,
    refetchInterval: UNREAD_POLL_MS,
    refetchOnWindowFocus: true,
    queryFn: () => withAuthRetry((t) => getAdminNotificationsUnreadCount(t)),
  });
}

/** Write fresh counts from any notification response or socket event into the cache. */
export function setUnreadCounts(
  queryClient: QueryClient,
  data: Pick<AdminNotificationUnreadCountData, "unread_count" | "by_business_type">,
) {
  queryClient.setQueryData<AdminNotificationUnreadCountData>(
    adminNotificationsKeys.unreadCount(),
    (prev) => ({
      unread_count: data.unread_count,
      by_business_type: data.by_business_type ?? prev?.by_business_type,
    }),
  );
}

export function unreadFor(
  data: AdminNotificationUnreadCountData | undefined,
  type: BusinessType,
): number {
  return data?.by_business_type?.[type] ?? 0;
}

// ── Pending work per business (panel switcher, strip, reminders) ─────────────

const SUMMARY_POLL_MS = 60_000;

export function usePendingSummary() {
  const signedIn = useAuth((s) => Boolean(s.tokens?.access));
  return useQuery({
    queryKey: pendingSummaryKeys.all,
    enabled: signedIn,
    refetchInterval: SUMMARY_POLL_MS,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    // An older backend without the endpoint: stay quiet instead of retrying forever.
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 2,
    queryFn: async (): Promise<PendingSummaryData | null> => {
      try {
        return await withAuthRetry((t) => getPendingSummary(t));
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
  });
}

let summaryTimer: ReturnType<typeof setTimeout> | null = null;

/** Socket events arrive in bursts; refetch the summary once they settle. */
export function refreshPendingSummarySoon(queryClient: QueryClient, delayMs = 1_200) {
  if (summaryTimer != null) clearTimeout(summaryTimer);
  summaryTimer = setTimeout(() => {
    summaryTimer = null;
    void queryClient.invalidateQueries({ queryKey: pendingSummaryKeys.all });
  }, delayMs);
}

/** Items someone has to act on (stock is shown separately; it can stay low for days). */
export function actionCount(b: PendingSummaryBusiness): number {
  return b.new_orders + b.counter_payments_pending + b.new_hall_enquiries;
}

export function pendingParts(b: PendingSummaryBusiness): string[] {
  const parts: string[] = [];
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  if (b.new_orders) parts.push(plural(b.new_orders, "new order", "new orders"));
  if (b.counter_payments_pending)
    parts.push(plural(b.counter_payments_pending, "payment pending", "payments pending"));
  if (b.new_hall_enquiries)
    parts.push(plural(b.new_hall_enquiries, "new enquiry", "new enquiries"));
  return parts;
}

/** Best page to open for a business's pending work. */
export function pendingDestination(b: PendingSummaryBusiness): {
  to: string;
  search?: Record<string, string>;
} {
  if (b.new_orders) return { to: "/orders" };
  if (b.counter_payments_pending) return { to: "/pos", search: { tab: "counter" } };
  if (b.new_hall_enquiries) return { to: "/hall-enquiries" };
  return { to: "/" };
}

// ── Repeat ring while work is left waiting ───────────────────────────────────

/** First reminder once something has waited this long. */
const REMIND_AFTER_MS = 2 * 60_000;
/** Then repeat at this interval until it is handled. */
const REPEAT_MS = 2 * 60_000;
const CHECK_MS = 20_000;

type ReminderKind = "orders" | "payments";

function waitedMs(iso: string | null, now: number): number {
  if (!iso) return 0;
  const at = new Date(iso).getTime();
  return Number.isNaN(at) ? 0 : now - at;
}

/**
 * Rings again (with a toast and desktop alert) while new orders stay unaccepted or counter
 * payments stay uncollected, in ANY business, so nothing is missed on another panel.
 */
export function usePendingReminder() {
  const { data } = usePendingSummary();
  const goTo = useGoToBusiness();
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  const dataRef = useRef(data);
  const goToRef = useRef(goTo);
  const pathRef = useRef(pathname);
  useEffect(() => {
    dataRef.current = data;
    goToRef.current = goTo;
    pathRef.current = pathname;
  });

  const lastRung = useRef(new Map<string, number>());

  useEffect(() => {
    const check = () => {
      const summary = dataRef.current;
      if (!summary) return;
      const now = Date.now();
      const live = new Set<string>();

      for (const b of summary.businesses) {
        const items: Array<{
          kind: ReminderKind;
          count: number;
          oldest: string | null;
          title: string;
          to: string;
          search?: Record<string, string>;
        }> = [
          {
            kind: "orders",
            count: b.new_orders,
            oldest: b.oldest_new_order_at,
            title:
              b.new_orders === 1
                ? "1 order waiting to be accepted"
                : `${b.new_orders} orders waiting to be accepted`,
            to: "/orders",
          },
          {
            kind: "payments",
            count: b.counter_payments_pending,
            oldest: b.oldest_counter_payment_at,
            title:
              b.counter_payments_pending === 1
                ? "1 counter payment still pending"
                : `${b.counter_payments_pending} counter payments still pending`,
            to: "/pos",
            search: { tab: "counter" },
          },
        ];

        for (const item of items) {
          if (item.count <= 0 || waitedMs(item.oldest, now) < REMIND_AFTER_MS) continue;
          const key = `${b.business_public_id}:${item.kind}`;
          live.add(key);
          const last = lastRung.current.get(key) ?? 0;
          if (now - last < REPEAT_MS) continue;
          lastRung.current.set(key, now);

          const dest = {
            businessPublicId: b.business_public_id,
            businessType: b.business_type,
            to: item.to,
            search: item.search,
          };
          const title = withBusinessTag(b.business_type, item.title);
          playAlertTone(b.business_type);
          showDesktopAlert({
            title,
            body: "Still waiting. Click to open.",
            tag: `reminder:${key}`,
            sticky: true,
            onClick: () => void goToRef.current(dest),
          });
          const alreadyThere = !isOtherBusiness(dest) && pathRef.current === item.to;
          if (!alreadyThere) {
            toast.warning(title, {
              id: `reminder:${key}`,
              duration: 12_000,
              action: { label: "Open", onClick: () => void goToRef.current(dest) },
            });
          }
        }
      }

      // Handled items start fresh next time they appear.
      for (const key of lastRung.current.keys()) if (!live.has(key)) lastRung.current.delete(key);
    };

    check();
    const timer = window.setInterval(check, CHECK_MS);
    return () => window.clearInterval(timer);
  }, []);
}
