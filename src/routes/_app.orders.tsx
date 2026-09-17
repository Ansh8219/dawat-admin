import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  acceptAdminOrder,
  listAdminOrders,
  markAdminOrderReady,
  orderAddressLine,
  orderCustomerName,
  orderItemCount,
  orderPhone,
  orderStatusLabel,
  paymentLabel,
  rejectAdminOrder,
} from "@/lib/api/orders";
import { ApiError } from "@/lib/api/types";
import type { AdminOrder, AdminOrderTab } from "@/lib/api/types";
import { withAuthRetry } from "@/lib/api/with-auth";
import { useAuth } from "@/lib/auth";
import { inr } from "@/lib/mock/data";
import { usePanelMeta } from "@/lib/use-panel";
import { cn } from "@/lib/utils";
import {
  Search,
  Timer,
  MapPin,
  Phone,
  Plus,
  Bell,
  Bike,
  ChefHat,
  CheckCircle2,
  XCircle,
  Printer,
  CircleDot,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/orders")({
  component: OrdersPage,
  head: () => ({ meta: [{ title: "Orders — Daawat Baker's" }] }),
});

const PAGE_SIZE = 20;
const PREP_OPTIONS = [15, 20, 25, 30, 40, 45];
const TABS: { id: AdminOrderTab; label: string; short: string }[] = [
  { id: "new", label: "New Orders", short: "New" },
  { id: "preparing", label: "Food Preparing", short: "Preparing" },
  { id: "ready", label: "Food Ready", short: "Ready" },
  { id: "past", label: "Past Orders", short: "Past" },
];

function elapsedSeconds(createdAt: string, now: number): number {
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return 0;
  return Math.max(0, Math.floor((now - created) / 1000));
}

function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remain = seconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(remain).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(remain).padStart(2, "0")}`;
}

function formatPlacedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function shortId(publicId: string): string {
  return publicId.slice(0, 8);
}

function itemLabel(item: NonNullable<AdminOrder["items"]>[number]): string {
  const name = item.name?.trim() || "Item";
  const variant = item.variant_name?.trim();
  const addons = (item.addons ?? [])
    .map((addon) => addon.name?.trim())
    .filter(Boolean)
    .join(", ");
  return [variant ? `${name} (${variant})` : name, addons ? `+ ${addons}` : ""]
    .filter(Boolean)
    .join(" ");
}

function OrdersPage() {
  const navigate = useNavigate();
  const meta = usePanelMeta();
  const [tab, setTab] = useState<AdminOrderTab>("new");
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [count, setCount] = useState(0);
  const [tabCounts, setTabCounts] = useState<Record<AdminOrderTab, number>>({
    new: 0,
    preparing: 0,
    ready: 0,
    past: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [selected, setSelected] = useState<AdminOrder | null>(null);
  const [acceptTarget, setAcceptTarget] = useState<AdminOrder | null>(null);
  const [rejectTarget, setRejectTarget] = useState<AdminOrder | null>(null);
  const [prepChoice, setPrepChoice] = useState(20);
  const [prepCustom, setPrepCustom] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [actingId, setActingId] = useState<string | null>(null);

  const handleAuthError = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.status === 401) {
        useAuth.getState().logout();
        void navigate({ to: "/login" });
        return true;
      }
      return false;
    },
    [navigate],
  );

  const refresh = useCallback(
    async (options?: { showLoading?: boolean }) => {
      const showLoading = options?.showLoading ?? false;
      if (showLoading) {
        setLoading(true);
        setLoadError("");
      }
      try {
        const [active, ...rest] = await Promise.all([
          withAuthRetry((token) =>
            listAdminOrders(token, { tab, page, page_size: PAGE_SIZE }),
          ),
          ...TABS.filter((item) => item.id !== tab).map((item) =>
            withAuthRetry((token) =>
              listAdminOrders(token, { tab: item.id, page: 1, page_size: 1 }),
            ),
          ),
        ]);
        setOrders(active.results);
        setCount(active.count ?? 0);
        setTabCounts((prev) => {
          const next = { ...prev, [tab]: active.count ?? 0 };
          const otherTabs = TABS.filter((item) => item.id !== tab);
          otherTabs.forEach((item, index) => {
            next[item.id] = rest[index]?.count ?? prev[item.id];
          });
          return next;
        });
        setSelected((current) => {
          if (!current) return null;
          return active.results.find((order) => order.public_id === current.public_id) ?? current;
        });
      } catch (err) {
        if (handleAuthError(err)) return;
        const message = err instanceof ApiError ? err.message : "Unable to load orders.";
        if (showLoading) setLoadError(message);
        else toast.error(message);
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [tab, page, handleAuthError],
  );

  useEffect(() => {
    void refresh({ showLoading: true });
  }, [refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refresh();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return orders;
    return orders.filter((order) => {
      const haystack = [
        order.public_id,
        orderCustomerName(order),
        orderPhone(order),
        orderAddressLine(order),
        order.driver?.full_name ?? "",
        order.driver?.phone ?? "",
        ...(order.items ?? []).map((item) => item.name ?? ""),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [orders, q]);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const prepMinutes = prepCustom.trim() ? Number(prepCustom) : prepChoice;

  function openAccept(order: AdminOrder) {
    setPrepChoice(20);
    setPrepCustom("");
    setAcceptTarget(order);
  }

  function openReject(order: AdminOrder) {
    setRejectReason("");
    setRejectTarget(order);
    setAcceptTarget(null);
  }

  async function confirmAccept() {
    if (!acceptTarget) return;
    if (!Number.isInteger(prepMinutes) || prepMinutes < 1) {
      toast.error("Preparation time must be at least 1 minute.");
      return;
    }
    setActingId(acceptTarget.public_id);
    try {
      await withAuthRetry((token) =>
        acceptAdminOrder(token, acceptTarget.public_id, prepMinutes),
      );
      toast.success(`${shortId(acceptTarget.public_id)} accepted · prep ${prepMinutes} min`);
      setAcceptTarget(null);
      setSelected(null);
      setTab("preparing");
      setPage(1);
      if (tab === "preparing" && page === 1) void refresh();
    } catch (err) {
      if (handleAuthError(err)) return;
      toast.error(err instanceof ApiError ? err.message : "Unable to accept order");
    } finally {
      setActingId(null);
    }
  }

  async function confirmReject() {
    if (!rejectTarget) return;
    if (rejectReason.trim().length > 255) {
      toast.error("Reason must be 255 characters or less.");
      return;
    }
    setActingId(rejectTarget.public_id);
    try {
      await withAuthRetry((token) =>
        rejectAdminOrder(token, rejectTarget.public_id, rejectReason),
      );
      toast.success(`${shortId(rejectTarget.public_id)} rejected`);
      setRejectTarget(null);
      setSelected(null);
      setTab("past");
      setPage(1);
      if (tab === "past" && page === 1) void refresh();
    } catch (err) {
      if (handleAuthError(err)) return;
      toast.error(err instanceof ApiError ? err.message : "Unable to reject order");
    } finally {
      setActingId(null);
    }
  }

  async function markReady(order: AdminOrder) {
    setActingId(order.public_id);
    try {
      await withAuthRetry((token) => markAdminOrderReady(token, order.public_id));
      toast.success(`${shortId(order.public_id)} marked ready`);
      setSelected(null);
      setTab("ready");
      setPage(1);
      if (tab === "ready" && page === 1) void refresh();
    } catch (err) {
      if (handleAuthError(err)) return;
      toast.error(err instanceof ApiError ? err.message : "Unable to mark order ready");
    } finally {
      setActingId(null);
    }
  }

  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Orders</h1>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-success">
                <CircleDot className="h-3 w-3 animate-pulse" />
                Live
              </span>
              {tabCounts.new > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                  <Bell className="h-3 w-3 animate-pulse" />
                  {tabCounts.new} new
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {meta.label} · kitchen board
            </p>
          </div>

          <Button className="rounded-xl gap-2" onClick={() => void navigate({ to: "/pos" })}>
            <Plus className="h-4 w-4" />
            New Order
          </Button>
        </div>

        <div className="flex items-end gap-1 overflow-x-auto px-4 sm:px-6 lg:px-8">
          {TABS.map((item) => {
            const active = tab === item.id;
            const tabCount = tabCounts[item.id];
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setTab(item.id);
                  setPage(1);
                }}
                className={cn(
                  "relative flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors",
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                  item.id === "new" && tabCount > 0 && !active && "text-primary",
                )}
              >
                {item.id === "new" && tabCount > 0 && <Bell className="h-3.5 w-3.5" />}
                {item.id === "preparing" && <ChefHat className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{item.label}</span>
                <span className="sm:hidden">{item.short}</span>
                <span
                  className={cn(
                    "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-bold",
                    active
                      ? "bg-primary text-primary-foreground"
                      : item.id === "new" && tabCount > 0
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {tabCount}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search this page…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="rounded-xl border-border/80 bg-card pl-9"
            />
          </div>
        </div>

        {tab === "new" && tabCounts.new > 0 && (
          <div className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/8 px-4 py-3 text-sm">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Bell className="h-4 w-4 animate-pulse" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-foreground">
                {tabCounts.new} new {tabCounts.new === 1 ? "order" : "orders"} waiting
              </div>
              <div className="text-xs text-muted-foreground">Accept quickly to keep prep times accurate</div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm">Loading orders…</p>
          </div>
        ) : loadError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-24 text-center">
            <div className="max-w-md rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {loadError}
            </div>
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => void refresh({ showLoading: true })}>
              Try again
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 py-20 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <ChefHat className="h-7 w-7 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold">
              {tab === "new" ? "No new orders" : `No ${TABS.find((item) => item.id === tab)?.label.toLowerCase()}`}
            </h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {tab === "new"
                ? "Incoming orders will appear here for accept / reject."
                : "Orders in this stage will show up as kitchen tickets."}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((order) => (
                <OrderTicket
                  key={order.public_id}
                  order={order}
                  now={now}
                  busy={actingId === order.public_id}
                  onOpen={() => setSelected(order)}
                  onAccept={() => openAccept(order)}
                  onReject={() => openReject(order)}
                  onReady={() => void markReady(order)}
                  onPrint={() => toast.success(`KOT printed for ${shortId(order.public_id)}`)}
                />
              ))}
            </div>
            {count > PAGE_SIZE && (
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Page {safePage} of {totalPages} · {count} orders
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    disabled={safePage <= 1}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" /> Prev
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    disabled={safePage >= totalPages}
                    onClick={() => setPage((current) => current + 1)}
                  >
                    Next <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <Dialog open={!!acceptTarget} onOpenChange={(open) => !open && setAcceptTarget(null)}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Accept order</DialogTitle>
          </DialogHeader>
          {acceptTarget && (
            <div className="space-y-4">
              <div className="rounded-xl border bg-muted/30 p-3">
                <div className="text-sm font-semibold">{shortId(acceptTarget.public_id)}</div>
                <div className="text-xs text-muted-foreground">
                  {orderCustomerName(acceptTarget)} · {orderItemCount(acceptTarget)} items ·{" "}
                  {inr(acceptTarget.subtotal)}
                </div>
              </div>
              <div>
                <div className="mb-2 text-sm font-medium">Select preparation time</div>
                <div className="grid grid-cols-3 gap-2">
                  {PREP_OPTIONS.map((minutes) => (
                    <button
                      key={minutes}
                      type="button"
                      onClick={() => {
                        setPrepChoice(minutes);
                        setPrepCustom("");
                      }}
                      className={cn(
                        "rounded-xl border py-3 text-sm font-bold transition-colors",
                        !prepCustom && prepChoice === minutes
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card hover:border-primary/40",
                      )}
                    >
                      {minutes} min
                    </button>
                  ))}
                </div>
                <Label className="mt-3 block text-xs text-muted-foreground">Or enter minutes</Label>
                <Input
                  inputMode="numeric"
                  value={prepCustom}
                  onChange={(e) => setPrepCustom(e.target.value.replace(/[^\d]/g, ""))}
                  placeholder="At least 1"
                  className="mt-1 rounded-xl"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl text-destructive hover:bg-destructive/10"
                  disabled={actingId === acceptTarget.public_id}
                  onClick={() => openReject(acceptTarget)}
                >
                  Reject
                </Button>
                <Button
                  className="flex-[1.4] rounded-xl"
                  disabled={actingId === acceptTarget.public_id}
                  onClick={() => void confirmAccept()}
                >
                  {actingId === acceptTarget.public_id ? "Accepting…" : `Accept · ${prepMinutes || "—"} min`}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject order</DialogTitle>
          </DialogHeader>
          {rejectTarget && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Only a new order can be rejected. Reason is optional, up to 255 characters.
              </p>
              <Textarea
                value={rejectReason}
                maxLength={255}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Out of stock"
                className="min-h-24 rounded-xl"
              />
              <div className="flex justify-end text-[11px] text-muted-foreground">
                {rejectReason.length}/255
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setRejectTarget(null)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1 rounded-xl"
                  disabled={actingId === rejectTarget.public_id}
                  onClick={() => void confirmReject()}
                >
                  {actingId === rejectTarget.public_id ? "Rejecting…" : "Reject order"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center justify-between gap-3 pr-6">
                  <span>{shortId(selected.public_id)}</span>
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                    {orderStatusLabel(selected.status)}
                  </span>
                </SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                <div className="rounded-xl border p-3">
                  <div className="text-xs text-muted-foreground">Customer</div>
                  <div className="font-medium">{orderCustomerName(selected)}</div>
                  <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" /> {orderPhone(selected)}
                  </div>
                  {orderAddressLine(selected) && (
                    <div className="mt-1 flex items-start gap-1 text-xs text-muted-foreground">
                      <MapPin className="mt-0.5 h-3 w-3" /> {orderAddressLine(selected)}
                    </div>
                  )}
                  <div className="mt-2 text-[11px] text-muted-foreground">
                    Placed {formatPlacedAt(selected.created_at)}
                    {selected.address?.address_type ? ` · ${selected.address.address_type}` : ""}
                  </div>
                </div>

                {(selected.status === "on_the_way" || selected.driver) && (
                  <DriverPickup order={selected} />
                )}

                {selected.reject_reason && (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
                    <div className="text-xs font-semibold uppercase text-destructive">Reject reason</div>
                    <div className="mt-1">{selected.reject_reason}</div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {selected.status === "new" && (
                    <Button className="rounded-xl" onClick={() => openAccept(selected)}>
                      Accept
                    </Button>
                  )}
                  {selected.status === "preparing" && (
                    <Button className="rounded-xl" onClick={() => void markReady(selected)}>
                      Food Ready
                    </Button>
                  )}
                  {selected.status === "new" && (
                    <Button
                      variant="outline"
                      className="rounded-xl text-destructive"
                      onClick={() => openReject(selected)}
                    >
                      Reject
                    </Button>
                  )}
                </div>

                <div>
                  <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Items</div>
                  <div className="space-y-1.5">
                    {(selected.items ?? []).map((item) => (
                      <div key={item.public_id} className="flex items-center justify-between rounded-lg border p-2 text-sm">
                        <span>
                          {item.quantity}× {itemLabel(item)}
                        </span>
                        <span className="font-medium">{inr(item.line_total)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-primary/5 p-3">
                  <span className="text-sm">
                    Total · {paymentLabel(selected.payment_method)} · {selected.payment_status || "—"}
                  </span>
                  <span className="text-lg font-bold text-primary">{inr(selected.subtotal)}</span>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function OrderTicket({
  order,
  now,
  busy,
  onOpen,
  onAccept,
  onReject,
  onReady,
  onPrint,
}: {
  order: AdminOrder;
  now: number;
  busy: boolean;
  onOpen: () => void;
  onAccept: () => void;
  onReject: () => void;
  onReady: () => void;
  onPrint: () => void;
}) {
  const isNew = order.status === "new";
  const isPreparing = order.status === "preparing";
  const isReady = order.status === "ready";
  const isOnTheWay = order.status === "on_the_way";
  const isRejected = order.status === "rejected";
  const elapsed = elapsedSeconds(order.created_at, now);
  const promised = order.preparation_minutes ?? 0;
  const delayed = isPreparing && promised > 0 && elapsed > promised * 60;
  const showTimer = isNew || isPreparing || isReady;
  const itemCount = orderItemCount(order);
  const address = orderAddressLine(order);

  return (
    <article
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl border bg-card shadow-soft transition-all hover:shadow-elevated",
        isNew && "border-primary/45 ring-1 ring-primary/15",
        delayed && "border-destructive/50 ring-1 ring-destructive/20",
      )}
    >
      <div
        className={cn(
          "h-1 w-full",
          isNew && "bg-primary",
          isPreparing && (delayed ? "animate-pulse bg-destructive" : "bg-info"),
          isReady && "bg-success",
          isOnTheWay && "bg-info",
          order.status === "delivered" && "bg-muted",
          isRejected && "bg-destructive/50",
        )}
      />

      <button type="button" onClick={onOpen} className="flex flex-1 flex-col p-4 text-left">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-md bg-info/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-info ring-1 ring-info/20">
                <Bike className="h-3 w-3" />
                {order.address?.address_type || "Delivery"}
              </span>
              <span className="text-sm font-bold tracking-tight">{shortId(order.public_id)}</span>
            </div>
            <div className="text-[11px] text-muted-foreground">
              {itemCount} {itemCount === 1 ? "item" : "items"} · {formatPlacedAt(order.created_at)}
              {order.preparation_minutes ? ` · prep ${order.preparation_minutes}m` : ""}
            </div>
          </div>

          {showTimer && (
            <div
              className={cn(
                "flex shrink-0 flex-col items-end rounded-xl px-2.5 py-1.5",
                delayed ? "bg-destructive/10 text-destructive" : "bg-muted/80 text-foreground",
              )}
            >
              <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide opacity-70">
                <Timer className="h-3 w-3" />
                {delayed ? "Delayed" : isNew ? "Waiting" : "Elapsed"}
              </div>
              <div className={cn("font-mono text-lg font-bold tabular-nums leading-none", delayed && "animate-pulse")}>
                {formatDuration(elapsed)}
              </div>
            </div>
          )}
        </div>

        <div className="mt-3">
          <div className="text-sm font-semibold">{orderCustomerName(order)}</div>
          <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <Phone className="h-3 w-3" />
            {orderPhone(order)}
          </div>
          {address && (
            <div className="mt-1 line-clamp-2 flex items-start gap-1 text-xs text-muted-foreground">
              <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
              {address}
            </div>
          )}
        </div>

        {(isOnTheWay || order.driver) && <DriverPickup order={order} compact />}

        <div className="mt-3 space-y-1.5 border-t border-border/60 pt-3">
          {(order.items ?? []).map((item) => (
            <div key={item.public_id} className="flex items-start justify-between gap-3 text-sm">
              <span className="text-foreground">
                <span className="mr-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded bg-muted px-1 text-xs font-bold text-muted-foreground">
                  {item.quantity}
                </span>
                {itemLabel(item)}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">{inr(item.line_total)}</span>
            </div>
          ))}
        </div>

        <div className="mt-auto flex items-end justify-between border-t border-border/60 pt-3">
          <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {paymentLabel(order.payment_method)} · {order.payment_status || "—"}
          </span>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Bill total</div>
            <div className="text-lg font-bold">{inr(order.subtotal)}</div>
          </div>
        </div>
      </button>

      <div className="flex border-t border-border/70">
        {isNew && (
          <button
            type="button"
            disabled={busy}
            onClick={onReject}
            className="flex flex-1 items-center justify-center gap-1.5 bg-card px-3 py-3.5 text-sm font-bold uppercase tracking-wide text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
          >
            <XCircle className="h-4 w-4" />
            Reject
          </button>
        )}
        {(isPreparing || isReady || isOnTheWay) && (
          <button
            type="button"
            onClick={onPrint}
            className="flex items-center justify-center gap-1.5 border-r border-border/70 bg-muted/30 px-4 py-3.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted"
            aria-label="Print KOT"
          >
            <Printer className="h-4 w-4" />
          </button>
        )}
        {isNew ? (
          <button
            type="button"
            disabled={busy}
            onClick={onAccept}
            className="flex flex-[2] items-center justify-center gap-2 bg-primary px-3 py-3.5 text-sm font-bold uppercase tracking-wide text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            Accept
          </button>
        ) : isPreparing ? (
          <button
            type="button"
            disabled={busy}
            onClick={onReady}
            className={cn(
              "flex flex-[2] items-center justify-center gap-2 px-3 py-3.5 text-sm font-bold uppercase tracking-wide text-primary-foreground transition-colors disabled:opacity-50",
              delayed ? "animate-pulse bg-destructive hover:bg-destructive/90" : "bg-success hover:bg-success/90",
            )}
          >
            {busy ? "Updating…" : "Food Ready"}
          </button>
        ) : (
          <div className="flex flex-1 items-center justify-center gap-2 bg-muted/40 px-3 py-3.5 text-sm font-medium text-muted-foreground">
            {isRejected ? (
              <>
                <XCircle className="h-4 w-4 text-destructive" />
                Rejected
              </>
            ) : isOnTheWay ? (
              <>
                <Bike className="h-4 w-4 text-info" />
                On the way
              </>
            ) : isReady ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-success" />
                Ready
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 text-success" />
                Delivered
              </>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function DriverPickup({ order, compact = false }: { order: AdminOrder; compact?: boolean }) {
  const driver = order.driver;
  const name = driver?.full_name?.trim() || "Driver";
  const phone = driver?.phone?.trim() || "—";
  const photo = driver?.profile_picture_url;

  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-xl border border-info/25 bg-info/5",
        compact ? "mx-4 mb-3 px-2.5 py-2" : "p-3",
      )}
    >
      {photo ? (
        <img src={photo} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
      ) : (
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-info/15 text-[11px] font-bold text-info">
          {driverInitials(name)}
        </div>
      )}
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-info">
          On the way
        </div>
        <div className="truncate text-sm font-semibold">{name}</div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Phone className="h-3 w-3" />
          {phone}
        </div>
        {order.driver_accepted_at && (
          <div className="text-[11px] text-muted-foreground">
            Picked up {formatPlacedAt(order.driver_accepted_at)}
          </div>
        )}
      </div>
    </div>
  );
}

function driverInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "");
  return letters.join("") || "D";
}
