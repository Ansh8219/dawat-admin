import { useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { adminOrdersKeys } from "@/lib/api/admin-orders-keys";
import {
  formatOrderMoney,
  isCancelledStatus,
  orderDisplayCode,
  tableLabel,
} from "@/lib/api/orders";
import { can } from "@/lib/access";
import { useCounterPaymentAlerts } from "@/lib/counter-payment-alerts";
import type { AdminOrderListData } from "@/lib/api/types";
import { useAuth } from "@/lib/auth";
import { adminNotificationsKeys } from "@/lib/api/notifications";
import {
  isOtherBusiness,
  useGoToBusiness,
  withBusinessTag,
  type BusinessDestination,
} from "@/lib/business-nav";
import { refreshPendingSummarySoon, setUnreadCounts } from "@/hooks/use-cross-business";
import { showDesktopAlert } from "@/lib/realtime/attention";
import { useInventoryAlerts } from "@/lib/inventory-alerts";
import { useHallEnquiryAlerts } from "@/lib/hall-enquiry-alerts";
import { useKitchenAlerts } from "@/lib/kitchen-alerts";
import {
  ADMIN_ORDERS_WS_CLOSE,
  AdminOrdersSocket,
  type AdminOrderWsEvent,
  type InventoryStockAlertEvent,
  type WsBusinessFields,
} from "@/lib/realtime/admin-orders-socket";
import {
  installAudioUnlock,
  playAlertTone,
  playNewOrderChime,
} from "@/lib/realtime/new-order-chime";
import { toast } from "sonner";

export type UseAdminOrdersSocketOptions = {
  /** Keep connected while authenticated admin shell is mounted. */
  enabled?: boolean;
  playSoundOnCreate?: boolean;
};

function shortId(publicId: string): string {
  return publicId.slice(0, 8);
}

function isOrdersPath(pathname: string): boolean {
  return pathname === "/orders" || pathname.startsWith("/orders/");
}

/** Where an event's toast / desktop alert should take the admin. */
function destFor(
  event: WsBusinessFields,
  to: string,
  search?: Record<string, string>,
): BusinessDestination {
  return {
    businessPublicId: event.business_public_id ?? null,
    businessType: event.business_type ?? null,
    to,
    search,
  };
}

/**
 * Global kitchen WebSocket (Zomato-style). Mount in authenticated `_app` layout.
 * New orders alert from any page; Orders board soft-refreshes via kitchen-alerts store.
 */
export function useAdminOrdersSocket(options: UseAdminOrdersSocketOptions = {}) {
  const { enabled = true, playSoundOnCreate = true } = options;

  const queryClient = useQueryClient();
  const goTo = useGoToBusiness();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const accessToken = useAuth((s) => s.tokens?.access ?? null);
  const refreshSession = useAuth((s) => s.refreshSession);
  const bumpNewOrder = useKitchenAlerts((s) => s.bumpNewOrder);
  const tickBoard = useKitchenAlerts((s) => s.tickBoard);
  const markCancelled = useKitchenAlerts((s) => s.markCancelled);
  const resetAlerts = useKitchenAlerts((s) => s.reset);
  const bumpInventory = useInventoryAlerts((s) => s.bump);
  const bumpHallEnquiry = useHallEnquiryAlerts((s) => s.bump);
  const resetInventoryAlerts = useInventoryAlerts((s) => s.reset);
  const counterPaymentPending = useCounterPaymentAlerts((s) => s.paymentPending);
  const counterPaymentReceived = useCounterPaymentAlerts((s) => s.paymentReceived);
  const resetCounterAlerts = useCounterPaymentAlerts((s) => s.reset);

  const playSoundRef = useRef(playSoundOnCreate);
  const pathnameRef = useRef(pathname);
  const goToRef = useRef(goTo);

  useEffect(() => {
    playSoundRef.current = playSoundOnCreate;
  }, [playSoundOnCreate]);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);
  useEffect(() => {
    goToRef.current = goTo;
  }, [goTo]);

  // Unlock audio on first user gesture so rings work on every page (incl. Orders).
  useEffect(() => installAudioUnlock(), []);

  // Drop alert state when auth is gone (logout).
  useEffect(() => {
    if (!accessToken) {
      resetAlerts();
      resetInventoryAlerts();
      resetCounterAlerts();
    }
  }, [accessToken, resetAlerts, resetInventoryAlerts, resetCounterAlerts]);

  useEffect(() => {
    if (!enabled || !accessToken || typeof window === "undefined") return;

    let stopped = false;
    let socket: AdminOrdersSocket | null = null;
    /** De-dupe identical WS payloads (type + order + at) within a short window. */
    const seenEvents = new Map<string, number>();
    const DEDUP_TTL_MS = 15_000;

    const invalidateQueries = async (event: AdminOrderWsEvent | null) => {
      await queryClient.invalidateQueries({ queryKey: adminOrdersKeys.all });
      if (event?.tab) {
        await queryClient.invalidateQueries({ queryKey: adminOrdersKeys.tab(event.tab) });
      }
    };

    const refreshBoardIfActive = () => {
      if (isOrdersPath(pathnameRef.current)) {
        tickBoard();
      }
    };

    const cachedOrderCode = (publicId: string): string => {
      const boards = queryClient.getQueriesData<AdminOrderListData>({
        queryKey: [...adminOrdersKeys.all, "board"],
      });
      for (const [, data] of boards) {
        const order = data?.results?.find((o) => o.public_id === publicId);
        if (order) return orderDisplayCode(order);
      }
      return shortId(publicId);
    };

    const orderCode = (event: { order_public_id: string; order_code?: string }) =>
      event.order_code || cachedOrderCode(event.order_public_id);

    const isDuplicateEvent = (event: AdminOrderWsEvent): boolean => {
      const key = `${event.type}:${event.order_public_id}:${event.at}`;
      const now = Date.now();
      for (const [seenKey, seenAt] of seenEvents) {
        if (now - seenAt > DEDUP_TTL_MS) seenEvents.delete(seenKey);
      }
      if (seenEvents.has(key)) return true;
      seenEvents.set(key, now);
      return false;
    };

    /** True when the admin is already looking at this page of this business. */
    const isViewing = (dest: BusinessDestination) =>
      !isOtherBusiness(dest) && pathnameRef.current === dest.to;

    // The server only sends events for businesses this user can access (mixed orders arrive
    // once), so every event here is in scope.
    const handleEvent = (event: AdminOrderWsEvent) => {
      if (isDuplicateEvent(event)) return;

      void invalidateQueries(event);
      refreshPendingSummarySoon(queryClient);

      if (event.type === "order.updated" && isCancelledStatus(event.status)) {
        const code = orderCode(event);
        const title = withBusinessTag(event.business_type, `Order ${code} cancelled by customer`);
        const dest = destFor(event, "/orders");
        if (playSoundRef.current) playAlertTone(event.business_type);
        toast.warning(title, {
          duration: 8_000,
          action: isViewing(dest)
            ? undefined
            : { label: "Open Orders", onClick: () => void goToRef.current(dest) },
        });
        showDesktopAlert({
          title,
          tag: `cancel:${event.order_public_id}`,
          onClick: () => void goToRef.current(dest),
        });
        if (isOrdersPath(pathnameRef.current)) markCancelled(event.order_public_id);
        return;
      }

      if (event.type === "order.created") {
        announceNewOrder(event);
        return;
      }

      // order.updated — board catch-up when on Orders; quiet elsewhere.
      refreshBoardIfActive();
    };

    const announceNewOrder = (event: AdminOrderWsEvent) => {
      if (playSoundRef.current) playNewOrderChime(event.business_type);
      // Bumps badge + boardTick + pending highlight for a mounted Orders page.
      bumpNewOrder(event.order_public_id);
      const code = event.order_code || shortId(event.order_public_id);
      const title = withBusinessTag(event.business_type, `New order #${code}`);
      const dest = destFor(event, "/orders");
      const other = isOtherBusiness(dest);
      toast.message(title, {
        description: other
          ? `From ${event.business_name ?? "another business"} · tap to switch and open`
          : "Tap to open kitchen board",
        duration: 10_000,
        action: {
          label: other ? "Switch & open" : "Open Orders",
          onClick: () => void goToRef.current(dest),
        },
      });
      showDesktopAlert({
        title,
        body: "Waiting to be accepted",
        tag: `order:${event.order_public_id}`,
        sticky: true,
        onClick: () => void goToRef.current(dest),
      });
    };

    /** De-dupe identical stock-alert toasts within a few seconds. */
    const seenStockAlerts = new Map<string, number>();
    const STOCK_DEDUP_TTL_MS = 5_000;

    const handleStockAlert = (event: InventoryStockAlertEvent) => {
      const key = `${event.inventory_item_public_id}:${event.stock_status}:${event.at}`;
      const now = Date.now();
      for (const [k, t] of seenStockAlerts) {
        if (now - t > STOCK_DEDUP_TTL_MS) seenStockAlerts.delete(k);
      }
      if (seenStockAlerts.has(key)) return;
      seenStockAlerts.set(key, now);

      if (playSoundRef.current) playAlertTone(event.business_type);
      const show = event.stock_status === "out_of_stock" ? toast.error : toast.warning;
      const title = withBusinessTag(event.business_type, event.title);
      const dest = destFor(event, "/inventory", { item: event.inventory_item_public_id });
      show(title, {
        description: event.message,
        duration: 10_000,
        action: {
          label: isOtherBusiness(dest) ? "Switch & view" : "View item",
          onClick: () => void goToRef.current(dest),
        },
      });
      showDesktopAlert({
        title,
        body: event.message,
        tag: `stock:${event.inventory_item_public_id}`,
        onClick: () => void goToRef.current(dest),
      });
      refreshPendingSummarySoon(queryClient);

      // Bell badge + list (stored as in-app notification type "stock").
      void queryClient.invalidateQueries({ queryKey: adminNotificationsKeys.all });
      // Open Inventory page / item detail refetches stock_status + available.
      bumpInventory(event.inventory_item_public_id);
    };

    const handleAuthFailure = async (code: number) => {
      if (stopped) return;
      if (code === ADMIN_ORDERS_WS_CLOSE.forbidden) {
        socket?.dispose();
        socket = null;
        return;
      }
      if (code === ADMIN_ORDERS_WS_CLOSE.unauthorized) {
        const ok = await refreshSession();
        const next = useAuth.getState().getAccessToken();
        if (!ok || !next || stopped) {
          socket?.dispose();
          socket = null;
          return;
        }
        socket?.updateToken(next);
      }
    };

    socket = new AdminOrdersSocket(accessToken, {
      onEvent: handleEvent,
      onStockAlert: handleStockAlert,
      onCounterPayment: (event) => {
        const key = `${event.type}:${event.order_public_id}:${event.at}`;
        if (seenEvents.has(key)) return;
        seenEvents.set(key, Date.now());
        refreshPendingSummarySoon(queryClient);

        if (event.type === "order.payment_received") {
          counterPaymentReceived(event.order_public_id);
          return;
        }
        // Repeats (extras added/changed/removed) only update the total; no toast.
        if (!counterPaymentPending(event.order_public_id, event.total)) return;
        if (playSoundRef.current) playAlertTone(event.business_type);
        const amount = Number(event.total);
        const total = Number.isFinite(amount) ? formatOrderMoney(amount) : `₹${event.total}`;
        const title = withBusinessTag(
          event.business_type,
          `${tableLabel(event.table_number)} – ${total} payment pending at counter`,
        );
        const dest = destFor(event, "/pos", { tab: "counter" });
        const canOpenPos = can("pos:view");
        toast.warning(title, {
          duration: 10_000,
          action:
            canOpenPos && !isViewing(dest)
              ? {
                  label: isOtherBusiness(dest) ? "Switch & open POS" : "Open POS",
                  onClick: () => void goToRef.current(dest),
                }
              : undefined,
        });
        showDesktopAlert({
          title,
          body: "Collect the payment at the counter",
          tag: `counter:${event.order_public_id}`,
          sticky: true,
          onClick: canOpenPos ? () => void goToRef.current(dest) : undefined,
        });
      },
      onHallEnquiryCreated: (event) => {
        if (playSoundRef.current) playAlertTone(event.business_type ?? "banquet_hall");
        // Hall Enquiries page (if mounted) refetches and bumps its New badge.
        bumpHallEnquiry();
        refreshPendingSummarySoon(queryClient);
        const type = event.business_type ?? "banquet_hall";
        const title = withBusinessTag(type, "New hall enquiry");
        const details = [
          event.customer_name,
          event.hall_name,
          event.event_date,
          event.guests ? `${event.guests} guests` : null,
        ]
          .filter(Boolean)
          .join(" · ");
        const dest: BusinessDestination = {
          ...destFor(event, "/hall-enquiries"),
          businessType: type,
        };
        if (!isViewing(dest)) {
          toast.message(title, {
            description: details || undefined,
            duration: 10_000,
            action: {
              label: isOtherBusiness(dest) ? "Switch & view" : "View",
              onClick: () => void goToRef.current(dest),
            },
          });
        }
        showDesktopAlert({
          title,
          body: details || undefined,
          tag: `enquiry:${event.enquiry_public_id ?? event.at ?? ""}`,
          onClick: () => void goToRef.current(dest),
        });
      },
      onHallBookingPending: (event) => {
        if (playSoundRef.current) playAlertTone(event.business_type ?? "banquet_hall");
        refreshPendingSummarySoon(queryClient);
        const type = event.business_type ?? "banquet_hall";
        const title = withBusinessTag(type, "Hall booking paid · awaiting approval");
        const dest: BusinessDestination = {
          ...destFor(event, "/hall-bookings"),
          businessType: type,
        };
        if (!isViewing(dest)) {
          toast.message(title, {
            duration: 10_000,
            action: {
              label: isOtherBusiness(dest) ? "Switch & review" : "Review",
              onClick: () => void goToRef.current(dest),
            },
          });
        }
        showDesktopAlert({
          title,
          tag: `booking:${event.at ?? ""}`,
          onClick: () => void goToRef.current(dest),
        });
      },
      onNotificationCreated: (event) => {
        // Bell badge, panel switcher counts and tab title update instantly.
        setUnreadCounts(queryClient, event);
        void queryClient.invalidateQueries({
          queryKey: adminNotificationsKeys.all,
          predicate: (q) => q.queryKey[1] !== "unread-count",
        });
      },
      onNotificationRead: (event) => {
        setUnreadCounts(queryClient, event);
        void queryClient.invalidateQueries({
          queryKey: adminNotificationsKeys.all,
          predicate: (q) => q.queryKey[1] !== "unread-count",
        });
      },
      onReconnected: () => {
        void invalidateQueries(null);
        // Events may have been missed while offline.
        refreshPendingSummarySoon(queryClient, 0);
        void queryClient.invalidateQueries({ queryKey: adminNotificationsKeys.all });
        // Catch-up refetch only when kitchen board is open.
        refreshBoardIfActive();
      },
      onAuthFailure: (code) => {
        void handleAuthFailure(code);
      },
    });
    socket.connect();

    return () => {
      stopped = true;
      socket?.dispose();
      socket = null;
    };
  }, [
    enabled,
    accessToken,
    queryClient,
    refreshSession,
    bumpNewOrder,
    tickBoard,
    markCancelled,
    bumpInventory,
    bumpHallEnquiry,
    counterPaymentPending,
    counterPaymentReceived,
  ]);
}
