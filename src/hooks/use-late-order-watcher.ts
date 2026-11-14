import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAccess } from "@/lib/access";
import { adminOrdersKeys } from "@/lib/api/admin-orders-keys";
import { isOrderLate, listAdminOrders, orderDisplayCode } from "@/lib/api/orders";
import type { AdminOrder, AdminOrderTab } from "@/lib/api/types";
import { withAuthRetry } from "@/lib/api/with-auth";
import { playLateOrderAlert } from "@/lib/realtime/new-order-chime";

const WATCHED_TABS: AdminOrderTab[] = ["new", "preparing"];
const POLL_MS = 60_000;
const CHECK_MS = 5_000;
const PAGE_SIZE = 50;
/** Safety cap: 10 pages x 50 = 500 active orders per list. */
const MAX_PAGES = 10;

/** Fetch every page of a tab so no late order is missed when the list is long. */
async function fetchAllOrders(tab: AdminOrderTab): Promise<AdminOrder[]> {
  const all: AdminOrder[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const data = await withAuthRetry((token) =>
      listAdminOrders(token, { tab, page, page_size: PAGE_SIZE }),
    );
    all.push(...data.results);
    if (all.length >= data.count || data.results.length === 0) break;
  }
  return all;
}

/**
 * Global late-order watcher. Mount in the authenticated `_app` layout so the
 * "Order is getting late" sound + toast fire on every page, not just Orders.
 * Data refreshes every minute and instantly on WS events (queries are invalidated
 * through `adminOrdersKeys.all`).
 */
export function useLateOrderWatcher() {
  const canView = useAccess().canView("orders");
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  const queries = WATCHED_TABS.map((tab) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks -- fixed-length constant list
    useQuery({
      queryKey: [...adminOrdersKeys.tab(tab), "late-watch"],
      queryFn: () => fetchAllOrders(tab),
      enabled: canView,
      refetchInterval: POLL_MS,
      refetchIntervalInBackground: true,
    }),
  );

  const newOrders = queries[0].data;
  const preparingOrders = queries[1].data;
  const loadedAt = Math.max(queries[0].dataUpdatedAt, queries[1].dataUpdatedAt);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!canView) return;
    const timer = window.setInterval(() => setNow(Date.now()), CHECK_MS);
    return () => window.clearInterval(timer);
  }, [canView]);

  const alerted = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!canView) return;
    const entries: Array<[AdminOrderTab, AdminOrder]> = [
      ...(newOrders ?? []).map((o): [AdminOrderTab, AdminOrder] => ["new", o]),
      ...(preparingOrders ?? []).map((o): [AdminOrderTab, AdminOrder] => ["preparing", o]),
    ];
    // Forget orders that left the active tabs so the set doesn't grow forever.
    const live = new Set(entries.map(([, o]) => o.public_id));
    for (const id of alerted.current) if (!live.has(id)) alerted.current.delete(id);

    for (const [tab, order] of entries) {
      if (alerted.current.has(order.public_id)) continue;
      if (!isOrderLate(order, tab, now, loadedAt)) continue;
      alerted.current.add(order.public_id);
      const code = orderDisplayCode(order);
      playLateOrderAlert(code);
      toast.error(`Order ${code} is getting late`, {
        description: tab === "new" ? "Not accepted yet" : "Preparation time exceeded",
        duration: 15_000,
        action: {
          label: "Open Orders",
          onClick: () => {
            void navigateRef.current({ to: "/orders" });
          },
        },
      });
      break; // one announcement per check; the rest follow on the next tick
    }
  }, [canView, newOrders, preparingOrders, now, loadedAt]);
}
