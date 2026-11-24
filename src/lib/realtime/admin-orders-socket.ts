import { getApiBaseUrl } from "@/lib/api/client";
import type { AdminOrderTab } from "@/lib/api/types";

export type AdminOrderWsEventType = "order.created" | "order.updated";

export type AdminOrderWsEvent = {
  type: AdminOrderWsEventType;
  order_public_id: string;
  status: string;
  tab: AdminOrderTab;
  at: string;
};

export type InventoryStockStatus = "low_stock" | "out_of_stock";

/** `inventory.stock_alert` message on the same admin socket. */
export type InventoryStockAlertEvent = {
  type: "inventory.stock_alert";
  business_public_id?: string;
  business_name?: string;
  inventory_item_public_id: string;
  item_name: string;
  unit?: string;
  available: string;
  stock_status: InventoryStockStatus;
  title: string;
  message: string;
  at: string;
};

/** `hall_enquiry.created` message on the same admin socket. */
export type HallEnquiryCreatedEvent = {
  type: "hall_enquiry.created";
  enquiry_public_id?: string;
  [key: string]: unknown;
};

/** Pay-at-counter events: `payment_pending` on handover, `payment_received` on settle. */
export type CounterPaymentEvent = {
  type: "order.payment_pending" | "order.payment_received";
  order_public_id: string;
  table_number: string;
  /** Decimal string, e.g. "300.00". */
  total: string;
  at: string;
};

function isCounterPaymentEvent(value: unknown): value is CounterPaymentEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Record<string, unknown>;
  return (
    (event.type === "order.payment_pending" || event.type === "order.payment_received") &&
    typeof event.order_public_id === "string"
  );
}

export const ADMIN_ORDERS_WS_CLOSE = {
  unauthorized: 4401,
  forbidden: 4403,
} as const;

const MIN_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;

export function getAdminOrdersWsUrl(accessToken: string): string {
  const apiBase = getApiBaseUrl();
  const wsBase = /^https:/i.test(apiBase)
    ? apiBase.replace(/^https:/i, "wss:")
    : apiBase.replace(/^http:/i, "ws:");
  const url = new URL(`${wsBase}/ws/admin/`);
  url.searchParams.set("token", accessToken);
  return url.toString();
}

function isAdminOrderWsEvent(value: unknown): value is AdminOrderWsEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Record<string, unknown>;
  return (
    (event.type === "order.created" || event.type === "order.updated") &&
    typeof event.order_public_id === "string" &&
    typeof event.status === "string" &&
    typeof event.tab === "string" &&
    typeof event.at === "string"
  );
}

function isInventoryStockAlertEvent(value: unknown): value is InventoryStockAlertEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Record<string, unknown>;
  return (
    event.type === "inventory.stock_alert" &&
    typeof event.inventory_item_public_id === "string" &&
    (event.stock_status === "low_stock" || event.stock_status === "out_of_stock")
  );
}

function isHallEnquiryCreatedEvent(value: unknown): value is HallEnquiryCreatedEvent {
  if (!value || typeof value !== "object") return false;
  return (value as Record<string, unknown>).type === "hall_enquiry.created";
}

export type AdminOrdersSocketHandlers = {
  onHallEnquiryCreated?: (event: HallEnquiryCreatedEvent) => void;
  onEvent: (event: AdminOrderWsEvent) => void;
  onStockAlert?: (event: InventoryStockAlertEvent) => void;
  onCounterPayment?: (event: CounterPaymentEvent) => void;
  onOpen?: () => void;
  onReconnected?: () => void;
  /** Called when the socket should stop (auth/forbidden) or needs a fresh token. */
  onAuthFailure?: (code: number) => void;
  onClose?: (code: number, reason: string) => void;
};

/**
 * Native WebSocket client for kitchen-board events.
 * Server → client only. Accept / reject / ready stay on REST.
 */
export class AdminOrdersSocket {
  private socket: WebSocket | null = null;
  private disposed = false;
  private intentionalClose = false;
  private backoffMs = MIN_BACKOFF_MS;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private hasConnectedOnce = false;
  private token: string;

  constructor(
    token: string,
    private readonly handlers: AdminOrdersSocketHandlers,
  ) {
    this.token = token;
  }

  /** Start (or restart) the connection with the given access token. */
  connect(token?: string) {
    if (this.disposed) return;
    if (token) this.token = token;
    this.intentionalClose = false;
    this.clearReconnectTimer();
    this.open();
  }

  /** Update token and reconnect (e.g. after refreshSession). */
  updateToken(token: string) {
    this.token = token;
    if (this.disposed) return;
    this.intentionalClose = false;
    this.clearReconnectTimer();
    this.open();
  }

  disconnect() {
    this.intentionalClose = true;
    this.clearReconnectTimer();
    this.closeSocket();
  }

  dispose() {
    this.disposed = true;
    this.disconnect();
  }

  private open() {
    if (this.disposed || !this.token) return;
    this.closeSocket();

    let url: string;
    try {
      url = getAdminOrdersWsUrl(this.token);
    } catch {
      this.scheduleReconnect();
      return;
    }

    const socket = new WebSocket(url);
    this.socket = socket;

    socket.onopen = () => {
      if (this.disposed || this.socket !== socket) return;
      this.backoffMs = MIN_BACKOFF_MS;
      const wasReconnect = this.hasConnectedOnce;
      this.hasConnectedOnce = true;
      this.handlers.onOpen?.();
      if (wasReconnect) this.handlers.onReconnected?.();
    };

    socket.onmessage = (message) => {
      if (this.disposed || this.socket !== socket) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(String(message.data));
      } catch {
        return;
      }
      // Route by `type`; unknown types are ignored.
      if (isAdminOrderWsEvent(parsed)) {
        this.handlers.onEvent(parsed);
      } else if (isInventoryStockAlertEvent(parsed)) {
        this.handlers.onStockAlert?.(parsed);
      } else if (isCounterPaymentEvent(parsed)) {
        this.handlers.onCounterPayment?.(parsed);
      } else if (isHallEnquiryCreatedEvent(parsed)) {
        this.handlers.onHallEnquiryCreated?.(parsed);
      }
    };

    socket.onerror = () => {
      // onclose handles reconnect / auth
    };

    socket.onclose = (event) => {
      if (this.socket === socket) this.socket = null;
      if (this.disposed) return;
      this.handlers.onClose?.(event.code, event.reason ?? "");

      if (
        event.code === ADMIN_ORDERS_WS_CLOSE.unauthorized ||
        event.code === ADMIN_ORDERS_WS_CLOSE.forbidden
      ) {
        this.handlers.onAuthFailure?.(event.code);
        return;
      }

      if (this.intentionalClose) return;
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect() {
    if (this.disposed || this.intentionalClose) return;
    this.clearReconnectTimer();
    const delay = this.backoffMs;
    this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.open();
    }, delay);
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer != null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private closeSocket() {
    const socket = this.socket;
    this.socket = null;
    if (!socket) return;

    // Detach handlers so a late open/close cannot reconnect after dispose.
    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;

    if (socket.readyState === WebSocket.OPEN) {
      socket.close();
      return;
    }

    // Closing while CONNECTING logs "WebSocket is closed before the connection
    // is established" (common under React Strict Mode remount). Defer instead.
    if (socket.readyState === WebSocket.CONNECTING) {
      const abandon = () => {
        try {
          socket.close();
        } catch {
          // ignore
        }
      };
      socket.addEventListener("open", abandon, { once: true });
      socket.addEventListener("error", abandon, { once: true });
    }
  }
}
