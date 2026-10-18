import type { AdminOrderTab } from "./types";

/** TanStack Query keys for kitchen-board admin orders. */
export const adminOrdersKeys = {
  all: ["admin-orders"] as const,
  board: (tab: AdminOrderTab, page: number) =>
    [...adminOrdersKeys.all, "board", tab, page] as const,
  counts: () => [...adminOrdersKeys.all, "counts"] as const,
  tab: (tab: AdminOrderTab) => [...adminOrdersKeys.all, "tab", tab] as const,
};
