import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { listBusinesses, setBusinessAcceptingOrders } from "@/lib/api/businesses";
import { getAdminDashboard } from "@/lib/api/dashboard";
import { formatOrderMoney } from "@/lib/api/orders";
import { ApiError } from "@/lib/api/types";
import type {
  AdminDashboardData,
  Business,
  DashboardCategorySales,
  DashboardHourlySalesPoint,
  DashboardSalesTrendPoint,
  DashboardSplitPoint,
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
  Loader2,
  CircleDot,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/_app/")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Dashboard — Daawat Baker's" }] }),
});

const ORDERABLE_TYPES = new Set(["restaurant", "bakery"]);
const POLL_MS = 45_000;
const IST = "Asia/Kolkata";

const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

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
  if (pct == null || Number.isNaN(pct)) return "—";
  const rounded = Math.round(pct * 10) / 10;
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded}% vs yesterday`;
}

function paymentSplitLabel(key: string): string {
  const known: Record<string, string> = {
    online: "Online",
    cod: "Cash on delivery",
  };
  return known[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function fulfillmentSplitLabel(key: string): string {
  const known: Record<string, string> = {
    delivery: "Delivery",
    takeaway: "Takeaway",
    dine_in: "Dine-in",
  };
  return known[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Format a UTC hour (0–23) as a local IST clock label. */
function formatUtcHourIst(hour: number): string {
  const safe = Math.max(0, Math.min(23, Math.floor(hour)));
  const d = new Date(Date.UTC(2026, 0, 1, safe, 0, 0));
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

function formatTrendDate(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return date;
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(d);
}

function tooltipSurface(style?: CSSProperties): CSSProperties {
  return {
    background: "var(--color-card)",
    border: "1px solid var(--color-border)",
    borderRadius: 12,
    color: "var(--color-card-foreground)",
    fontSize: 12,
    ...style,
  };
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
      prev ? { ...prev, business: { ...prev.business, is_accepting_orders: next } } : prev,
    );
    setBusinesses((prev) =>
      prev.map((b) => (b.public_id === biz.public_id ? { ...b, is_accepting_orders: next } : b)),
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
        prev ? { ...prev, business: { ...prev.business, is_accepting_orders: previous } } : prev,
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

  const title = data?.business.name || meta.label;
  const accepting = data?.business.is_accepting_orders ?? false;

  const salesTrend = useMemo(
    () => (data?.sales_trend ?? []).map((p) => ({ ...p, label: formatTrendDate(p.date) })),
    [data?.sales_trend],
  );

  const hourlySales = useMemo(() => {
    const rows = data?.hourly_sales ?? [];
    let peakHour: number | null = null;
    let peakSales = -1;
    for (const row of rows) {
      if (row.sales > peakSales) {
        peakSales = row.sales;
        peakHour = row.hour;
      }
    }
    return {
      peakHour: peakSales > 0 ? peakHour : null,
      rows: rows.map((p) => ({
        ...p,
        label: formatUtcHourIst(p.hour),
        isPeak: peakSales > 0 && p.hour === peakHour,
      })),
    };
  }, [data?.hourly_sales]);

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
                value={data.kpis.rating != null ? String(data.kpis.rating) : "No ratings yet"}
                icon={Star}
                hint={
                  data.kpis.rating_count > 0
                    ? `${data.kpis.rating_count} reviews`
                    : "No ratings yet"
                }
              />
            </div>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
              <ChartCard title="Sales — last 7 days" className="xl:col-span-3">
                <SalesTrendChart data={salesTrend} />
              </ChartCard>
              <ChartCard
                title="Sales by hour (today)"
                className="xl:col-span-2"
                hint={
                  hourlySales.peakHour != null
                    ? `Peak ${formatUtcHourIst(hourlySales.peakHour)} IST`
                    : undefined
                }
              >
                <HourlySalesChart data={hourlySales.rows} />
              </ChartCard>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              <ChartCard title="Payment methods">
                <SplitDonut
                  data={data.payment_split}
                  labelFor={paymentSplitLabel}
                  emptyTitle="No sales yet today"
                />
              </ChartCard>
              <ChartCard title="Order types">
                <SplitDonut
                  data={data.fulfillment_split}
                  labelFor={fulfillmentSplitLabel}
                  emptyTitle="No sales yet today"
                />
              </ChartCard>
              <ChartCard title="Top categories today" className="md:col-span-2 xl:col-span-1">
                <CategoryBars data={data.category_sales} />
              </ChartCard>
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
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

              <section className="rounded-2xl border bg-card p-4 shadow-soft">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <PackageX className="h-4 w-4 text-warning" />
                    <h2 className="text-sm font-bold">Stock Alerts</h2>
                  </div>
                  <Link
                    to="/inventory"
                    className="inline-flex items-center gap-0.5 text-xs font-semibold text-primary hover:underline"
                  >
                    View all <ChevronRight className="h-3 w-3" />
                  </Link>
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
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function ChartCard({
  title,
  hint,
  className,
  children,
}: {
  title: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("rounded-2xl border bg-card p-4 shadow-soft", className)}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <h2 className="text-sm font-bold">{title}</h2>
        {hint ? <span className="text-[11px] text-muted-foreground">{hint}</span> : null}
      </div>
      {children}
    </section>
  );
}

function ChartEmpty({ title }: { title: string }) {
  return (
    <div className="flex h-48 items-center justify-center rounded-xl border border-dashed bg-muted/20 px-4 text-center text-xs text-muted-foreground">
      {title}
    </div>
  );
}

function SalesTrendChart({ data }: { data: Array<DashboardSalesTrendPoint & { label: string }> }) {
  if (data.length === 0) {
    return <ChartEmpty title="No sales yet today" />;
  }
  return (
    <div className="h-56 w-full sm:h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="dashSalesTrend" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="label"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            stroke="var(--color-muted-foreground)"
            interval="preserveStartEnd"
          />
          <YAxis
            fontSize={11}
            tickLine={false}
            axisLine={false}
            stroke="var(--color-muted-foreground)"
            width={44}
            tickFormatter={(v: number) =>
              v >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : String(v)
            }
          />
          <Tooltip
            contentStyle={tooltipSurface()}
            formatter={(value: number, _name, item) => {
              const orders = (item?.payload as DashboardSalesTrendPoint | undefined)?.orders ?? 0;
              return [`${formatOrderMoney(value)} · ${orders} orders`, "Sales"];
            }}
            labelFormatter={(label) => String(label)}
          />
          <Area
            type="monotone"
            dataKey="sales"
            stroke="var(--color-primary)"
            strokeWidth={2.5}
            fill="url(#dashSalesTrend)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function HourlySalesChart({
  data,
}: {
  data: Array<DashboardHourlySalesPoint & { label: string; isPeak: boolean }>;
}) {
  if (data.length === 0) {
    return <ChartEmpty title="No sales yet today" />;
  }
  return (
    <div className="h-56 w-full sm:h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="label"
            fontSize={9}
            tickLine={false}
            axisLine={false}
            stroke="var(--color-muted-foreground)"
            interval={3}
            minTickGap={8}
          />
          <YAxis
            fontSize={11}
            tickLine={false}
            axisLine={false}
            stroke="var(--color-muted-foreground)"
            width={40}
            tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
          />
          <Tooltip
            contentStyle={tooltipSurface()}
            formatter={(value: number, _name, item) => {
              const orders = (item?.payload as DashboardHourlySalesPoint | undefined)?.orders ?? 0;
              return [`${formatOrderMoney(value)} · ${orders} orders`, "Sales"];
            }}
            labelFormatter={(label) => `${label} IST`}
          />
          <Bar dataKey="sales" radius={[4, 4, 0, 0]}>
            {data.map((entry) => (
              <Cell
                key={entry.hour}
                fill={entry.isPeak ? "var(--color-primary)" : "var(--color-chart-2)"}
                fillOpacity={entry.isPeak ? 1 : 0.45}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function SplitDonut({
  data,
  labelFor,
  emptyTitle,
}: {
  data: DashboardSplitPoint[];
  labelFor: (key: string) => string;
  emptyTitle: string;
}) {
  if (data.length === 0) {
    return <ChartEmpty title={emptyTitle} />;
  }
  const rows = data.map((d) => ({
    ...d,
    name: labelFor(d.key),
  }));
  return (
    <div className="flex h-48 flex-col gap-3 sm:flex-row sm:items-center">
      <div className="mx-auto h-40 w-40 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={rows}
              dataKey="sales"
              nameKey="name"
              innerRadius="58%"
              outerRadius="88%"
              paddingAngle={2}
              stroke="var(--color-card)"
            >
              {rows.map((entry, i) => (
                <Cell key={entry.key} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={tooltipSurface()}
              formatter={(value: number, _name, item) => {
                const payload = item?.payload as DashboardSplitPoint | undefined;
                const orders = payload?.orders ?? 0;
                const share = payload?.share_pct ?? 0;
                return [`${formatOrderMoney(value)} · ${orders} orders · ${share}%`, "Sales"];
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="min-w-0 flex-1 space-y-1.5">
        {rows.map((row, i) => (
          <li key={row.key} className="flex items-center justify-between gap-2 text-xs">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
              />
              <span className="truncate font-medium">{row.name}</span>
            </span>
            <span className="shrink-0 text-muted-foreground">{row.share_pct}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CategoryBars({ data }: { data: DashboardCategorySales[] }) {
  if (data.length === 0) {
    return <ChartEmpty title="No sales yet today" />;
  }
  const max = Math.max(...data.map((d) => d.sales), 1);
  return (
    <div className="space-y-3">
      {data.map((row) => {
        const pct = Math.max(4, Math.round((row.sales / max) * 100));
        return (
          <div key={row.name} className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate font-medium">{row.name}</span>
              <span className="shrink-0 text-muted-foreground">
                {formatOrderMoney(row.sales)} · {row.share_pct}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width]"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
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
