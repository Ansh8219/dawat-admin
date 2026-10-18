import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { listBusinesses, setBusinessAcceptingOrders } from "@/lib/api/businesses";
import { getAdminDashboard } from "@/lib/api/dashboard";
import {
  acceptAdminOrder,
  formatOrderMoney,
  orderStatusLabel,
  paymentLabel,
  rejectAdminOrder,
} from "@/lib/api/orders";
import { ApiError } from "@/lib/api/types";
import type {
  AdminDashboardData,
  Business,
  DashboardNewOrder,
} from "@/lib/api/types";
import { withAuthRetry } from "@/lib/api/with-auth";
import { useAuth } from "@/lib/auth";
import { inr, banquetEvents } from "@/lib/mock/data";
import { businessTypeToPanel } from "@/lib/panel";
import { usePanel, usePanelMeta } from "@/lib/use-panel";
import { cn } from "@/lib/utils";
import {
  IndianRupee,
  ShoppingBag,
  TrendingUp,
  Plus,
  PackageX,
  ChevronRight,
  Bell,
  ChefHat,
  CheckCircle2,
  Star,
  Bike,
  UtensilsCrossed,
  Loader2,
  CircleDot,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Dashboard — Daawat Baker's" }] }),
});

const ORDERABLE_TYPES = new Set(["restaurant", "bakery"]);
const POLL_MS = 45_000;

const stageMeta: {
  id: "new" | "preparing" | "ready" | "done_today";
  label: string;
  icon: typeof Bell;
  tone: string;
}[] = [
  {
    id: "new",
    label: "New Orders",
    icon: Bell,
    tone: "border-primary/40 bg-primary/5 text-primary",
  },
  {
    id: "preparing",
    label: "Preparing",
    icon: ChefHat,
    tone: "border-info/30 bg-info/5 text-info",
  },
  {
    id: "ready",
    label: "Food Ready",
    icon: CheckCircle2,
    tone: "border-success/30 bg-success/5 text-success",
  },
  {
    id: "done_today",
    label: "Done today",
    icon: ShoppingBag,
    tone: "border-border bg-card text-foreground",
  },
];

function sortOrderable(a: Business, b: Business): number {
  const rank = (t: string) => (t === "restaurant" ? 0 : t === "bakery" ? 1 : 2);
  return rank(a.type) - rank(b.type) || a.name.localeCompare(b.name);
}

function typeLabel(type: string): string {
  const panel = businessTypeToPanel(type);
  if (panel === "restaurant") return "Restaurant";
  if (panel === "bakery") return "Bakery";
  return type;
}

function salesChangeHint(pct: number | null): string {
  if (pct == null || Number.isNaN(pct)) return "vs yesterday unavailable";
  const rounded = Math.round(pct * 10) / 10;
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded}% vs yesterday`;
}

function Dashboard() {
  const panel = usePanel();
  if (panel === "banquet") {
    return <BanquetDashboard />;
  }
  return <FoodDashboard />;
}

function FoodDashboard() {
  const navigate = useNavigate();
  const meta = usePanelMeta();
  const authBusiness = useAuth((s) => s.business);
  const selectBusiness = useAuth((s) => s.selectBusiness);

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDash, setLoadingDash] = useState(false);
  const [listError, setListError] = useState("");
  const [dashError, setDashError] = useState("");
  const [toggling, setToggling] = useState(false);
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

  const loadBusinesses = useCallback(async () => {
    setLoadingList(true);
    setListError("");
    try {
      const list = await withAuthRetry((token) => listBusinesses(token));
      const orderable = list
        .filter((b) => ORDERABLE_TYPES.has(String(b.type)))
        .map((b) => ({ ...b, is_accepting_orders: Boolean(b.is_accepting_orders) }))
        .sort(sortOrderable);
      setBusinesses(orderable);

      setSelectedId((prev) => {
        if (prev && orderable.some((b) => b.public_id === prev)) return prev;
        const fromAuth = authBusiness?.publicId;
        if (fromAuth && orderable.some((b) => b.public_id === fromAuth)) return fromAuth;
        return orderable[0]?.public_id ?? null;
      });
    } catch (err) {
      if (handleAuthError(err)) return;
      setListError(err instanceof ApiError ? err.message : "Unable to load businesses.");
      setBusinesses([]);
    } finally {
      setLoadingList(false);
    }
  }, [authBusiness?.publicId, handleAuthError]);

  const loadDashboard = useCallback(
    async (businessPublicId: string, options?: { silent?: boolean }) => {
      if (!options?.silent) {
        setLoadingDash(true);
        setDashError("");
      }
      try {
        const dash = await withAuthRetry((token) => getAdminDashboard(token, businessPublicId));
        setData(dash);
        setDashError("");
      } catch (err) {
        if (handleAuthError(err)) return;
        setData(null);
        setDashError(err instanceof ApiError ? err.message : "Unable to load dashboard.");
      } finally {
        if (!options?.silent) setLoadingDash(false);
      }
    },
    [handleAuthError],
  );

  useEffect(() => {
    void loadBusinesses();
  }, [loadBusinesses]);

  useEffect(() => {
    if (!selectedId) {
      setData(null);
      return;
    }
    void loadDashboard(selectedId);
  }, [selectedId, loadDashboard]);

  useEffect(() => {
    if (!selectedId) return;
    const id = window.setInterval(() => {
      void loadDashboard(selectedId, { silent: true });
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [selectedId, loadDashboard]);

  function pickBusiness(biz: Business) {
    setSelectedId(biz.public_id);
    const result = selectBusiness(biz);
    if (!result.ok) {
      toast.error(result.error);
    }
  }

  async function toggleAccepting(next: boolean) {
    if (!data?.business) return;
    const biz = data.business;
    const previous = biz.is_accepting_orders;
    setToggling(true);
    setData((prev) =>
      prev
        ? { ...prev, business: { ...prev.business, is_accepting_orders: next } }
        : prev,
    );
    setBusinesses((prev) =>
      prev.map((b) =>
        b.public_id === biz.public_id ? { ...b, is_accepting_orders: next } : b,
      ),
    );
    try {
      const updated = await withAuthRetry((token) =>
        setBusinessAcceptingOrders(token, biz.public_id, next),
      );
      setData((prev) =>
        prev
          ? {
              ...prev,
              business: {
                ...prev.business,
                is_accepting_orders: updated.is_accepting_orders,
                name: updated.name || prev.business.name,
              },
            }
          : prev,
      );
      const label = typeLabel(updated.type || biz.type);
      toast.success(next ? `${label} — Accepting orders` : `${label} — Closed`);
    } catch (err) {
      setData((prev) =>
        prev
          ? { ...prev, business: { ...prev.business, is_accepting_orders: previous } }
          : prev,
      );
      setBusinesses((prev) =>
        prev.map((b) =>
          b.public_id === biz.public_id ? { ...b, is_accepting_orders: previous } : b,
        ),
      );
      if (handleAuthError(err)) return;
      toast.error(err instanceof ApiError ? err.message : "Unable to update accepting orders");
    } finally {
      setToggling(false);
    }
  }

  async function acceptOrder(order: DashboardNewOrder) {
    setActingId(order.public_id);
    try {
      await withAuthRetry((token) => acceptAdminOrder(token, order.public_id, 20));
      toast.success(`${order.public_id.slice(0, 8)} accepted · prep 20 min`);
      if (selectedId) await loadDashboard(selectedId, { silent: true });
    } catch (err) {
      if (handleAuthError(err)) return;
      toast.error(err instanceof ApiError ? err.message : "Unable to accept order");
    } finally {
      setActingId(null);
    }
  }

  async function rejectOrder(order: DashboardNewOrder) {
    setActingId(order.public_id);
    try {
      await withAuthRetry((token) => rejectAdminOrder(token, order.public_id));
      toast.success(`${order.public_id.slice(0, 8)} rejected`);
      if (selectedId) await loadDashboard(selectedId, { silent: true });
    } catch (err) {
      if (handleAuthError(err)) return;
      toast.error(err instanceof ApiError ? err.message : "Unable to reject order");
    } finally {
      setActingId(null);
    }
  }

  const title = data?.business.name || meta.label;
  const accepting = data?.business.is_accepting_orders ?? false;

  if (loadingList) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading businesses…
      </div>
    );
  }

  if (listError) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-destructive">{listError}</p>
        <Button className="rounded-xl" onClick={() => void loadBusinesses()}>
          Try again
        </Button>
      </div>
    );
  }

  if (businesses.length === 0) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-6 text-sm text-muted-foreground">
        No restaurant or bakery businesses available.
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/95 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title} Home</h1>
              {data && data.counts.new > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                  <Bell className="h-3 w-3 animate-pulse" />
                  {data.counts.new} waiting
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">Live ops snapshot</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-full border bg-card p-1">
              {businesses.map((biz) => {
                const active = biz.public_id === selectedId;
                return (
                  <button
                    key={biz.public_id}
                    type="button"
                    onClick={() => pickBusiness(biz)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {typeLabel(biz.type)}
                  </button>
                );
              })}
            </div>

            {data && (
              <label
                className={cn(
                  "flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-medium",
                  accepting ? "border-success/40" : "border-border",
                )}
              >
                <CircleDot
                  className={cn(
                    "h-3 w-3 shrink-0",
                    accepting ? "animate-pulse text-success" : "text-muted-foreground",
                  )}
                />
                <span className="whitespace-nowrap">
                  {accepting ? "Accepting orders" : "Closed"}
                </span>
                <Switch
                  checked={accepting}
                  disabled={toggling}
                  onCheckedChange={(checked) => void toggleAccepting(checked)}
                />
              </label>
            )}

            <Button
              variant="outline"
              size="icon"
              className="rounded-xl"
              disabled={!selectedId || loadingDash}
              onClick={() => selectedId && void loadDashboard(selectedId)}
              aria-label="Refresh dashboard"
            >
              <RefreshCw className={cn("h-4 w-4", loadingDash && "animate-spin")} />
            </Button>

            <Button className="rounded-xl gap-2" onClick={() => void navigate({ to: "/pos" })}>
              <Plus className="h-4 w-4" />
              New Order
            </Button>
          </div>
        </div>
      </header>

      <div className="space-y-5 p-4 sm:p-6 lg:p-8">
        {loadingDash && !data ? (
          <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading dashboard…
          </div>
        ) : dashError && !data ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-6 py-16 text-center">
            <p className="text-sm text-destructive">{dashError}</p>
            <Button
              className="rounded-xl"
              onClick={() => selectedId && void loadDashboard(selectedId)}
            >
              Try again
            </Button>
          </div>
        ) : data ? (
          <>
            {dashError && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {dashError} (showing last loaded data)
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {stageMeta.map((s) => {
                const Icon = s.icon;
                const count = data.counts[s.id];
                return (
                  <Link
                    key={s.id}
                    to="/orders"
                    className={cn(
                      "flex items-center justify-between rounded-2xl border p-4 shadow-soft transition-shadow hover:shadow-elevated",
                      s.tone,
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="grid h-11 w-11 place-items-center rounded-xl bg-background/80">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide opacity-80">
                          {s.label}
                        </div>
                        <div className="text-3xl font-bold tracking-tight text-foreground">
                          {count}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 opacity-50" />
                  </Link>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi
                label="Today's Sales"
                value={formatOrderMoney(data.kpis.today_sales)}
                icon={IndianRupee}
                hint={salesChangeHint(data.kpis.sales_change_pct)}
              />
              <Kpi
                label="Orders Today"
                value={String(data.kpis.orders_today)}
                icon={ShoppingBag}
                hint={`${data.counts.done_today} completed`}
              />
              <Kpi
                label="Avg Ticket"
                value={formatOrderMoney(data.kpis.avg_ticket)}
                icon={TrendingUp}
                hint="Across channels"
              />
              <Kpi
                label="Rating"
                value={data.kpis.rating != null ? String(data.kpis.rating) : "—"}
                icon={Star}
                hint={`${data.kpis.rating_count} reviews`}
              />
            </div>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
              <section className="xl:col-span-3">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold">New Orders</h2>
                    {data.counts.new > 0 && (
                      <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                        {data.counts.new}
                      </span>
                    )}
                  </div>
                  <Link
                    to="/orders"
                    className="inline-flex items-center gap-0.5 text-xs font-semibold text-primary hover:underline"
                  >
                    Open board <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>

                {data.new_orders.length === 0 ? (
                  <EmptyBlock
                    icon={UtensilsCrossed}
                    title="No new orders right now"
                    subtitle="Incoming orders will appear here to accept."
                  />
                ) : (
                  <div className="space-y-3">
                    {data.new_orders.map((order) => (
                      <article
                        key={order.public_id}
                        className="overflow-hidden rounded-2xl border border-primary/30 bg-card shadow-soft ring-1 ring-primary/10"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3 p-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                                {order.address?.address_type || "Delivery"}
                              </span>
                              <span className="text-sm font-bold">
                                {order.public_id.slice(0, 8)}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                {orderStatusLabel(order.status)}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                {order.created_at
                                  ? new Date(order.created_at).toLocaleString("en-IN", {
                                      hour: "numeric",
                                      minute: "2-digit",
                                    })
                                  : ""}
                              </span>
                            </div>
                            <div className="mt-1 text-sm font-semibold">
                              {order.address?.full_name?.trim() || "Customer"}
                            </div>
                            {order.address?.phone && (
                              <div className="text-xs text-muted-foreground">
                                {order.address.phone}
                              </div>
                            )}
                            <ul className="mt-2 space-y-0.5 text-sm text-muted-foreground">
                              {(order.items ?? []).map((it) => (
                                <li key={it.public_id}>
                                  <span className="font-semibold text-foreground">
                                    {it.quantity}×
                                  </span>{" "}
                                  {it.name || "Item"}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold">
                              {formatOrderMoney(order.total ?? order.subtotal ?? 0)}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {paymentLabel(order.payment_method)}
                            </div>
                          </div>
                        </div>
                        <div className="flex border-t">
                          <button
                            type="button"
                            disabled={actingId === order.public_id}
                            onClick={() => void rejectOrder(order)}
                            className="flex-1 bg-muted/40 py-3 text-sm font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            disabled={actingId === order.public_id}
                            onClick={() => void acceptOrder(order)}
                            className="flex-[1.4] bg-primary py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                          >
                            Accept
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <aside className="space-y-5 xl:col-span-2">
                <section className="rounded-2xl border bg-card p-4 shadow-soft">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-bold">In Kitchen</h2>
                    <Link
                      to="/orders"
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      View all
                    </Link>
                  </div>
                  {data.kitchen_orders.length === 0 ? (
                    <p className="py-6 text-center text-xs text-muted-foreground">
                      Nothing preparing right now
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {data.kitchen_orders.map((o) => {
                        const preparing =
                          o.status === "preparing" || o.status === "accepted";
                        return (
                          <button
                            key={o.public_id}
                            type="button"
                            onClick={() => void navigate({ to: "/orders" })}
                            className="flex w-full items-center gap-3 rounded-xl border border-border/70 p-3 text-left hover:bg-muted/40"
                          >
                            <div
                              className={cn(
                                "grid h-9 w-9 place-items-center rounded-lg",
                                preparing
                                  ? "bg-info/10 text-info"
                                  : "bg-success/10 text-success",
                              )}
                            >
                              {preparing ? (
                                <ChefHat className="h-4 w-4" />
                              ) : (
                                <Bike className="h-4 w-4" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-semibold">
                                {o.public_id.slice(0, 8)}
                              </div>
                              <div className="truncate text-xs text-muted-foreground">
                                {o.driver?.full_name
                                  ? `${o.driver.full_name} · ${o.driver.phone || "—"}`
                                  : `${o.customer_name || "Customer"} · ${o.item_count} items`}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs font-semibold">
                                {orderStatusLabel(o.status)}
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                {formatOrderMoney(o.total ?? 0)}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>

                <section className="rounded-2xl border bg-card p-4 shadow-soft">
                  <div className="mb-3 flex items-center gap-2">
                    <PackageX className="h-4 w-4 text-warning" />
                    <h2 className="text-sm font-bold">Stock Alerts</h2>
                  </div>
                  {data.stock_alerts.length === 0 ? (
                    <p className="py-4 text-center text-xs text-muted-foreground">
                      Stock looks healthy
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {data.stock_alerts.map((i) => (
                        <div
                          key={i.public_id}
                          className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">{i.name}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {i.available} {i.unit} left · reorder at {i.reorder_level}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="rounded-2xl border bg-card p-4 shadow-soft">
                  <h2 className="mb-3 text-sm font-bold">Top Selling</h2>
                  {data.top_selling.length === 0 ? (
                    <p className="py-4 text-center text-xs text-muted-foreground">
                      No sales yet today
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {data.top_selling.map((m, i) => (
                        <div key={m.public_id} className="flex items-center gap-3">
                          <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                            {i + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">{m.name}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {m.category || "—"}
                            </div>
                          </div>
                          <div className="text-xs font-semibold">{m.sold_today} sold</div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </aside>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function EmptyBlock({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof UtensilsCrossed;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-card px-6 py-12 text-center">
      <Icon className="mb-2 h-8 w-8 text-muted-foreground" />
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: string;
  icon: typeof IndianRupee;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-soft">
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight">{value}</div>
      <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>
    </div>
  );
}

function BanquetDashboard() {
  const navigate = useNavigate();
  const meta = usePanelMeta();
  const [bookings, setBookings] = useState(banquetEvents.slice(0, 4));

  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <header className="border-b bg-background px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold sm:text-2xl">{meta.label} Home</h1>
            <p className="text-xs text-muted-foreground">Events · packages · advances</p>
          </div>
          <Button className="rounded-xl gap-2" onClick={() => void navigate({ to: "/bookings" })}>
            <Plus className="h-4 w-4" /> New Booking
          </Button>
        </div>
      </header>
      <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-4 lg:p-8">
        <Kpi
          label="This Week"
          value={String(banquetEvents.length)}
          icon={ShoppingBag}
          hint="Events booked"
        />
        <Kpi label="Advance" value={inr(210000)} icon={IndianRupee} hint="Collected" />
        <Kpi label="Capacity" value="350" icon={TrendingUp} hint="Max guests" />
        <Kpi label="Halls" value="3" icon={Star} hint="Active this week" />
      </div>
      <div className="px-4 pb-8 sm:px-6 lg:px-8">
        <div className="rounded-2xl border bg-card p-4 shadow-soft">
          <h2 className="mb-3 text-sm font-bold">Upcoming Bookings</h2>
          <div className="space-y-2">
            {bookings.map((e) => (
              <div key={e.date} className="flex items-center gap-3 rounded-xl border p-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-gold/20 font-bold text-gold-foreground">
                  {e.date}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{e.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {e.guests} guests · {e.pkg}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 rounded-lg text-xs"
                    onClick={() => {
                      setBookings((prev) => prev.filter((b) => b.date !== e.date));
                      toast.message(`${e.title} rejected`);
                    }}
                  >
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 rounded-lg text-xs"
                    onClick={() => {
                      setBookings((prev) => prev.filter((b) => b.date !== e.date));
                      toast.success(`${e.title} approved`);
                    }}
                  >
                    Approve
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
