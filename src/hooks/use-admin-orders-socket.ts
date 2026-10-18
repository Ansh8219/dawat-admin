import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { adminOrdersKeys } from "@/lib/api/admin-orders-keys";
import { useAuth } from "@/lib/auth";
import { useKitchenAlerts } from "@/lib/kitchen-alerts";
import {
  ADMIN_ORDERS_WS_CLOSE,
  AdminOrdersSocket,
  type AdminOrderWsEvent,
} from "@/lib/realtime/admin-orders-socket";
import { playNewOrderChime } from "@/lib/realtime/new-order-chime";
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

/**
 * Global kitchen WebSocket (Zomato-style). Mount in authenticated `_app` layout.
 * New orders alert from any page; Orders board soft-refreshes via kitchen-alerts store.
 */
export function useAdminOrdersSocket(options: UseAdminOrdersSocketOptions = {}) {
  const { enabled = true, playSoundOnCreate = true } = options;

  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const accessToken = useAuth((s) => s.tokens?.access ?? null);
  const refreshSession = useAuth((s) => s.refreshSession);
  const bumpNewOrder = useKitchenAlerts((s) => s.bumpNewOrder);
  const tickBoard = useKitchenAlerts((s) => s.tickBoard);
  const resetAlerts = useKitchenAlerts((s) => s.reset);

  const playSoundRef = useRef(playSoundOnCreate);
  const pathnameRef = useRef(pathname);
  const navigateRef = useRef(navigate);

  useEffect(() => {
    playSoundRef.current = playSoundOnCreate;
  }, [playSoundOnCreate]);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);
  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  // Drop alert state when auth is gone (logout).
  useEffect(() => {
    if (!accessToken) resetAlerts();
  }, [accessToken, resetAlerts]);

  useEffect(() => {
    if (!enabled || !accessToken || typeof window === "undefined") return;

    let stopped = false;
    let socket: AdminOrdersSocket | null = null;

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

    const handleEvent = (event: AdminOrderWsEvent) => {
      void invalidateQueries(event);

      if (event.type === "order.created") {
        if (playSoundRef.current) playNewOrderChime();
        // Bumps badge + boardTick + pending highlight for a mounted Orders page.
        bumpNewOrder(event.order_public_id);
        toast.message("New order", {
          description: `#${shortId(event.order_public_id)} · tap to open kitchen board`,
          duration: 8_000,
          action: {
            label: "Open Orders",
            onClick: () => {
              void navigateRef.current({ to: "/orders" });
            },
          },
        });
        return;
      }

      // order.updated — board catch-up when on Orders; quiet elsewhere.
      refreshBoardIfActive();
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
      onReconnected: () => {
        void invalidateQueries(null);
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
  }, [enabled, accessToken, queryClient, refreshSession, bumpNewOrder, tickBoard]);
}
