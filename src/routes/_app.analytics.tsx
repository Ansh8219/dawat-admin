import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { z } from "zod";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  analyticsKeys,
  downloadAnalyticsCsv,
  fillHourlySales,
  formatSharePct,
  getAnalyticsFinancial,
  getAnalyticsInventory,
  getAnalyticsProducts,
  getAnalyticsSales,
  isWastageReason,
} from "@/lib/api/analytics";
import { listBusinesses } from "@/lib/api/businesses";
import { formatOrderMoney, fulfillmentLabel, paymentLabel } from "@/lib/api/orders";
import { ApiError } from "@/lib/api/types";
import type {
  AnalyticsFinancialData,
  AnalyticsGroupBy,
  AnalyticsInventoryData,
  AnalyticsProductsData,
  AnalyticsReport,
  AnalyticsSalesData,
  Business,
} from "@/lib/api/types";
import { withAuthRetry } from "@/lib/api/with-auth";
import { canCheckPersistedAuth, isSuperAdmin, useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { AlertTriangle, Download, Info, Loader2, RefreshCw } from "lucide-react";
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
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

const TABS = ["sales", "products", "inventory", "financial"] as const;
type AnalyticsTab = (typeof TABS)[number];

const searchSchema = z.object({
  tab: z.enum(TABS).optional().catch(undefined),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
  business: z.string().min(1).optional().catch(undefined),
  group_by: z.enum(["day", "week", "month"]).optional().catch(undefined),
});

type AnalyticsSearch = z.infer<typeof searchSchema>;

export const Route = createFileRoute("/_app/analytics")({
  validateSearch: searchSchema,
  beforeLoad: () => {
    if (!canCheckPersistedAuth()) return;
    if (!isSuperAdmin(useAuth.getState().user)) {
      throw redirect({ to: "/" });
    }
  },
  component: AnalyticsPage,
  head: () => ({ meta: [{ title: "Analytics — Daawat Baker's" }] }),
});

const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

const PRESETS = [
  { id: "today", label: "Today" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "month", label: "This month" },
] as const;

type PresetId = (typeof PRESETS)[number]["id"];

/** UTC calendar date YYYY-MM-DD (analytics buckets use UTC). */
function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function addUtcDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function firstOfUtcMonth(iso: string): string {
  return `${iso.slice(0, 8)}01`;
}

function presetRange(preset: PresetId): { from: string; to: string } {
  const to = utcToday();
  if (preset === "today") return { from: to, to };
  if (preset === "7d") return { from: addUtcDays(to, -6), to };
  if (preset === "30d") return { from: addUtcDays(to, -29), to };
  return { from: firstOfUtcMonth(to), to };
}

function defaultRange(): { from: string; to: string } {
  return presetRange("30d");
}

function formatTrendLabel(period: string, groupBy: AnalyticsGroupBy): string {
  const d = new Date(`${period}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return period;
  if (groupBy === "month") {
    return d.toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" });
  }
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function tooltipStyle(): CSSProperties {
  return {
    background: "var(--color-card)",
    border: "1px solid var(--color-border)",
    borderRadius: 12,
    color: "var(--color-card-foreground)",
    fontSize: 12,
  };
}

function moneyTick(v: number): string {
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`;
  return String(v);
}

function AnalyticsPage() {
  const navigate = useNavigate({ from: Route.fullPath });
  const search = Route.useSearch();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [exporting, setExporting] = useState(false);

  const range = useMemo(() => {
    const fallback = defaultRange();
    return {
      from: search.from ?? fallback.from,
      to: search.to ?? fallback.to,
    };
  }, [search.from, search.to]);

  const tab: AnalyticsTab = search.tab ?? "sales";
  const groupBy: AnalyticsGroupBy = search.group_by ?? "day";
  const businessId = search.business && search.business !== "all" ? search.business : undefined;

  const filters = useMemo(
    () => ({
      from: range.from,
      to: range.to,
      business_public_id: businessId,
    }),
    [range.from, range.to, businessId],
  );

  const setSearch = useCallback(
    (patch: Partial<AnalyticsSearch>) => {
      void navigate({
        search: (prev) => {
          const next: AnalyticsSearch = { ...prev, ...patch };
          (Object.keys(next) as (keyof AnalyticsSearch)[]).forEach((key) => {
            if (next[key] === "" || next[key] == null) delete next[key];
          });
          if (next.business === "all") delete next.business;
          if (next.tab === "sales") delete next.tab;
          if (next.group_by === "day") delete next.group_by;
          return next;
        },
        replace: true,
      });
    },
    [navigate],
  );

  // Seed default dates into the URL once so shareable links include the range.
  useEffect(() => {
    if (search.from && search.to) return;
    const defaults = defaultRange();
    setSearch({
      from: search.from ?? defaults.from,
      to: search.to ?? defaults.to,
    });
  }, [search.from, search.to, setSearch]);

  useEffect(() => {
    let cancelled = false;
    withAuthRetry((token) => listBusinesses(token))
      .then((list) => {
        if (!cancelled) setBusinesses(list);
      })
      .catch(() => {
        if (!cancelled) setBusinesses([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activePreset = useMemo((): PresetId | "custom" => {
    for (const p of PRESETS) {
      const r = presetRange(p.id);
      if (r.from === range.from && r.to === range.to) return p.id;
    }
    return "custom";
  }, [range.from, range.to]);

  const rangeInvalid = range.from > range.to;

  async function onExport() {
    if (rangeInvalid) {
      toast.error("'from' must be on or before 'to'.");
      return;
    }
    setExporting(true);
    try {
      await withAuthRetry((token) =>
        downloadAnalyticsCsv(token, { ...filters, report: tab as AnalyticsReport }),
      );
      toast.success("CSV downloaded");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to export CSV");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Analytics"
        crumbs={["Admin", "Analytics"]}
        description="Sales, product, inventory, and financial reports."
        action={
          <Button
            className="gap-2 rounded-xl"
            disabled={exporting || rangeInvalid}
            onClick={() => void onExport()}
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Export CSV
          </Button>
        }
      />

      <div className="space-y-4 p-4 sm:p-6 lg:p-8">
        <div className="card-elevated flex flex-col gap-3 p-3 lg:flex-row lg:flex-wrap lg:items-end">
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <Button
                key={p.id}
                type="button"
                size="sm"
                variant={activePreset === p.id ? "default" : "outline"}
                className="rounded-xl"
                onClick={() => setSearch(presetRange(p.id))}
              >
                {p.label}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">From (UTC)</Label>
              <Input
                type="date"
                className="mt-1 w-40 rounded-xl"
                value={range.from}
                onChange={(e) => setSearch({ from: e.target.value || undefined })}
              />
            </div>
            <span className="pb-2 text-muted-foreground">to</span>
            <div>
              <Label className="text-xs text-muted-foreground">To (UTC)</Label>
              <Input
                type="date"
                className="mt-1 w-40 rounded-xl"
                value={range.to}
                onChange={(e) => setSearch({ to: e.target.value || undefined })}
              />
            </div>
          </div>

          <div className="min-w-[12rem] flex-1">
            <Label className="text-xs text-muted-foreground">Business</Label>
            <Select
              value={businessId ?? "all"}
              onValueChange={(value) =>
                setSearch({ business: value === "all" ? undefined : value })
              }
            >
              <SelectTrigger className="mt-1 rounded-xl">
                <SelectValue placeholder="All businesses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All businesses</SelectItem>
                {businesses.map((b) => (
                  <SelectItem key={b.public_id} value={b.public_id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {rangeInvalid && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Start date must be on or before end date.
          </div>
        )}

        <Tabs value={tab} onValueChange={(value) => setSearch({ tab: value as AnalyticsTab })}>
          <TabsList className="h-auto flex-wrap rounded-xl">
            <TabsTrigger value="sales">Sales</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
            <TabsTrigger value="financial">Financial</TabsTrigger>
          </TabsList>

          <TabsContent value="sales" className="mt-4">
            <SalesTab
              enabled={tab === "sales" && !rangeInvalid}
              filters={filters}
              groupBy={groupBy}
              onGroupBy={(value) => setSearch({ group_by: value })}
            />
          </TabsContent>
          <TabsContent value="products" className="mt-4">
            <ProductsTab enabled={tab === "products" && !rangeInvalid} filters={filters} />
          </TabsContent>
          <TabsContent value="inventory" className="mt-4">
            <InventoryTab enabled={tab === "inventory" && !rangeInvalid} filters={filters} />
          </TabsContent>
          <TabsContent value="financial" className="mt-4">
            <FinancialTab enabled={tab === "financial" && !rangeInvalid} filters={filters} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function QueryState({
  loading,
  error,
  onRetry,
  empty,
  children,
}: {
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  empty?: boolean;
  children: ReactNode;
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-6 py-16 text-center">
        <p className="text-sm text-destructive">
          {error instanceof ApiError ? error.message : "Unable to load analytics."}
        </p>
        <Button variant="outline" className="gap-2 rounded-xl" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" /> Try again
        </Button>
      </div>
    );
  }
  if (empty) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-card px-6 py-20 text-center">
        <p className="text-sm font-medium">No sales in this period</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Try a wider date range or another business.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}

function Kpi({
  label,
  value,
  hint,
  tip,
}: {
  label: string;
  value: string;
  hint?: string;
  tip?: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-soft">
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        {tip ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="text-muted-foreground hover:text-foreground">
                  <Info className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">{tip}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight">{value}</div>
      {hint ? <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

function ChartCard({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-2xl border bg-card p-4 shadow-soft", className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function EmptyChart({ label = "No sales in this period" }: { label?: string }) {
  return (
    <div className="flex h-56 items-center justify-center rounded-xl border border-dashed text-xs text-muted-foreground">
      {label}
    </div>
  );
}

function SalesTab({
  enabled,
  filters,
  groupBy,
  onGroupBy,
}: {
  enabled: boolean;
  filters: { from: string; to: string; business_public_id?: string };
  groupBy: AnalyticsGroupBy;
  onGroupBy: (value: AnalyticsGroupBy) => void;
}) {
  const query = useQuery({
    queryKey: analyticsKeys.sales({ ...filters, group_by: groupBy }),
    enabled,
    queryFn: ({ signal }) =>
      withAuthRetry((token) => getAnalyticsSales(token, { ...filters, group_by: groupBy }, signal)),
  });

  const data = query.data as AnalyticsSalesData | undefined;
  const hourly = useMemo(() => fillHourlySales(data?.hourly ?? []), [data?.hourly]);
  const trend = useMemo(
    () =>
      (data?.trend ?? []).map((row) => ({
        ...row,
        label: formatTrendLabel(row.period, groupBy),
      })),
    [data?.trend, groupBy],
  );
  const empty = Boolean(data && data.summary.orders === 0 && data.summary.revenue === 0);

  return (
    <QueryState
      loading={query.isLoading}
      error={query.error}
      onRetry={() => void query.refetch()}
      empty={empty}
    >
      {data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-3 2xl:grid-cols-6">
            <Kpi label="Revenue" value={formatOrderMoney(data.summary.revenue)} />
            <Kpi label="Orders" value={String(data.summary.orders)} />
            <Kpi label="AOV" value={formatOrderMoney(data.summary.avg_order_value)} />
            <Kpi label="Discounts" value={formatOrderMoney(data.summary.discounts)} />
            <Kpi label="Delivery fees" value={formatOrderMoney(data.summary.delivery_fees)} />
            <Kpi label="Tips" value={formatOrderMoney(data.summary.tips)} />
          </div>

          <div className="grid gap-4 xl:grid-cols-5">
            <ChartCard
              className="xl:col-span-3"
              title="Sales trend"
              action={
                <div className="flex rounded-full border p-0.5">
                  {(["day", "week", "month"] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => onGroupBy(g)}
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize",
                        groupBy === g
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              }
            >
              {trend.length === 0 ? (
                <EmptyChart />
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="analyticsTrend" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--color-border)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="label"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        stroke="var(--color-muted-foreground)"
                      />
                      <YAxis
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        width={44}
                        stroke="var(--color-muted-foreground)"
                        tickFormatter={moneyTick}
                      />
                      <RechartsTooltip
                        contentStyle={tooltipStyle()}
                        formatter={(value: number, _n, item) => [
                          `${formatOrderMoney(value)} · ${(item?.payload as { orders?: number })?.orders ?? 0} orders`,
                          "Sales",
                        ]}
                      />
                      <Area
                        type="monotone"
                        dataKey="sales"
                        stroke="var(--color-primary)"
                        strokeWidth={2.5}
                        fill="url(#analyticsTrend)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </ChartCard>

            <ChartCard className="xl:col-span-2" title="Sales by hour (UTC)">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourly} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--color-border)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      fontSize={9}
                      interval={3}
                      tickLine={false}
                      axisLine={false}
                      stroke="var(--color-muted-foreground)"
                    />
                    <YAxis
                      fontSize={11}
                      width={40}
                      tickLine={false}
                      axisLine={false}
                      stroke="var(--color-muted-foreground)"
                      tickFormatter={moneyTick}
                    />
                    <RechartsTooltip
                      contentStyle={tooltipStyle()}
                      formatter={(value: number, _n, item) => [
                        `${formatOrderMoney(value)} · ${(item?.payload as { orders?: number })?.orders ?? 0} orders`,
                        "Sales",
                      ]}
                      labelFormatter={(label) => `${label}:00 UTC`}
                    />
                    <Bar dataKey="sales" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <SplitDonut
              title="Payment methods"
              rows={data.by_payment_method}
              labelFor={paymentLabel}
            />
            <SplitDonut
              title="Order types"
              rows={data.by_fulfillment}
              labelFor={fulfillmentLabel}
            />
          </div>

          {!filters.business_public_id && (data.by_business?.length ?? 0) > 0 && (
            <ChartCard title="By business">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Business</th>
                      <th className="px-3 py-2 text-right font-medium">Sales</th>
                      <th className="px-3 py-2 text-right font-medium">Orders</th>
                      <th className="px-3 py-2 text-right font-medium">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.by_business!.map((row) => (
                      <tr key={`${row.business_public_id}-${row.name}`} className="border-b">
                        <td className="px-3 py-2 font-medium">{row.name}</td>
                        <td className="px-3 py-2 text-right">{formatOrderMoney(row.sales)}</td>
                        <td className="px-3 py-2 text-right">{row.orders}</td>
                        <td className="px-3 py-2 text-right">{formatSharePct(row.share_pct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ChartCard>
          )}
        </div>
      ) : null}
    </QueryState>
  );
}

function SplitDonut({
  title,
  rows,
  labelFor,
}: {
  title: string;
  rows: Array<{ key: string; sales: number; orders: number; share_pct: number }>;
  labelFor: (key: string) => string;
}) {
  const data = rows.map((r) => ({ ...r, name: labelFor(r.key) }));
  return (
    <ChartCard title={title}>
      {data.length === 0 ? (
        <EmptyChart />
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="mx-auto h-44 w-44 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="sales"
                  nameKey="name"
                  innerRadius="58%"
                  outerRadius="88%"
                  paddingAngle={2}
                  stroke="var(--color-card)"
                >
                  {data.map((entry, i) => (
                    <Cell key={entry.key} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip
                  contentStyle={tooltipStyle()}
                  formatter={(value: number, _n, item) => {
                    const payload = item?.payload as { orders?: number; share_pct?: number };
                    return [
                      `${formatOrderMoney(value)} · ${payload?.orders ?? 0} orders · ${formatSharePct(payload?.share_pct)}`,
                      "Sales",
                    ];
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="min-w-0 flex-1 space-y-1.5">
            {data.map((row, i) => (
              <li key={row.key} className="flex items-center justify-between gap-2 text-xs">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                  />
                  <span className="truncate font-medium">{row.name}</span>
                </span>
                <span className="shrink-0 text-muted-foreground">
                  {formatSharePct(row.share_pct)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ChartCard>
  );
}

function ProductsTab({
  enabled,
  filters,
}: {
  enabled: boolean;
  filters: { from: string; to: string; business_public_id?: string };
}) {
  const query = useQuery({
    queryKey: analyticsKeys.products(filters),
    enabled,
    queryFn: ({ signal }) => withAuthRetry((token) => getAnalyticsProducts(token, filters, signal)),
  });
  const data = query.data as AnalyticsProductsData | undefined;
  const empty = Boolean(
    data &&
    data.top_items.length === 0 &&
    data.category_sales.length === 0 &&
    data.slow_items.length === 0,
  );

  return (
    <QueryState
      loading={query.isLoading}
      error={query.error}
      onRetry={() => void query.refetch()}
      empty={empty}
    >
      {data ? (
        <div className="space-y-4">
          <ChartCard title="Top items by revenue">
            {data.top_items.length === 0 ? (
              <EmptyChart />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Item</th>
                      <th className="px-3 py-2 text-left font-medium">Category</th>
                      <th className="px-3 py-2 text-right font-medium">Qty</th>
                      <th className="px-3 py-2 text-right font-medium">Revenue</th>
                      <th className="px-3 py-2 text-right font-medium">COGS</th>
                      <th className="px-3 py-2 text-right font-medium">Margin</th>
                      <th className="px-3 py-2 text-right font-medium">Margin %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.top_items.map((row) => (
                      <tr key={row.public_id} className="border-b">
                        <td className="px-3 py-2">
                          <div className="font-medium">{row.name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {row.item_code || "—"}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{row.category || "—"}</td>
                        <td className="px-3 py-2 text-right">{row.quantity}</td>
                        <td className="px-3 py-2 text-right">{formatOrderMoney(row.revenue)}</td>
                        <td className="px-3 py-2 text-right">
                          {row.cogs == null ? "—" : formatOrderMoney(row.cogs)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {row.margin == null ? "—" : formatOrderMoney(row.margin)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {row.margin_pct == null ? "—" : formatSharePct(row.margin_pct)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ChartCard>

          <div className="grid gap-4 xl:grid-cols-5">
            <ChartCard className="xl:col-span-3" title="Category sales">
              {data.category_sales.length === 0 ? (
                <EmptyChart />
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.category_sales}
                      layout="vertical"
                      margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--color-border)"
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        fontSize={11}
                        tickFormatter={moneyTick}
                        stroke="var(--color-muted-foreground)"
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={110}
                        fontSize={11}
                        stroke="var(--color-muted-foreground)"
                      />
                      <RechartsTooltip
                        contentStyle={tooltipStyle()}
                        formatter={(value: number, _n, item) => [
                          `${formatOrderMoney(value)} · ${formatSharePct((item?.payload as { share_pct?: number })?.share_pct)}`,
                          "Sales",
                        ]}
                      />
                      <Bar dataKey="sales" fill="var(--color-primary)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </ChartCard>

            <ChartCard className="xl:col-span-2" title="Not selling">
              {data.slow_items.length === 0 ? (
                <p className="py-10 text-center text-xs text-muted-foreground">
                  No slow items in this range.
                </p>
              ) : (
                <ul className="max-h-72 space-y-2 overflow-y-auto">
                  {data.slow_items.map((item) => (
                    <li key={item.public_id} className="rounded-xl border px-3 py-2">
                      <div className="truncate text-sm font-medium">{item.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {item.item_code || "—"} · {item.category || "—"}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </ChartCard>
          </div>
        </div>
      ) : null}
    </QueryState>
  );
}

function InventoryTab({
  enabled,
  filters,
}: {
  enabled: boolean;
  filters: { from: string; to: string; business_public_id?: string };
}) {
  const query = useQuery({
    queryKey: analyticsKeys.inventory(filters),
    enabled,
    queryFn: ({ signal }) =>
      withAuthRetry((token) => getAnalyticsInventory(token, filters, signal)),
  });
  const data = query.data as AnalyticsInventoryData | undefined;
  const lowLabel =
    data && data.stock.low_stock_count >= 20 ? "20+" : String(data?.stock.low_stock_count ?? 0);

  return (
    <QueryState loading={query.isLoading} error={query.error} onRetry={() => void query.refetch()}>
      {data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Kpi
              label="Stock value"
              value={formatOrderMoney(data.stock.value)}
              hint="Current stock · not filtered by dates"
            />
            <Kpi label="Items" value={String(data.stock.items)} hint="Current catalog" />
            <Kpi label="Low stock" value={lowLabel} hint="Capped at 20 rows below" />
          </div>

          <ChartCard title="Low stock">
            {data.low_stock.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">Stock looks healthy.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Item</th>
                      <th className="px-3 py-2 text-left font-medium">SKU</th>
                      <th className="px-3 py-2 text-right font-medium">Available</th>
                      <th className="px-3 py-2 text-right font-medium">Reorder at</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.low_stock.map((row) => (
                      <tr key={row.public_id} className="border-b">
                        <td className="px-3 py-2 font-medium">{row.name}</td>
                        <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                          {row.sku || "—"}
                        </td>
                        <td className="px-3 py-2 text-right text-warning">
                          {row.available} {row.unit}
                        </td>
                        <td className="px-3 py-2 text-right text-muted-foreground">
                          {row.reorder_level} {row.unit}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ChartCard>

          <ChartCard title="Stock movement">
            {data.movement.length === 0 ? (
              <EmptyChart label="No movement in this period" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Type</th>
                      <th className="px-3 py-2 text-left font-medium">Reason</th>
                      <th className="px-3 py-2 text-right font-medium">Entries</th>
                      <th className="px-3 py-2 text-right font-medium">Qty</th>
                      <th className="px-3 py-2 text-right font-medium">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.movement.map((row, idx) => {
                      const waste = isWastageReason(row.reason);
                      return (
                        <tr
                          key={`${row.entry_type}-${row.reason}-${idx}`}
                          className={cn("border-b", waste && "bg-destructive/5")}
                        >
                          <td className="px-3 py-2 capitalize">{row.entry_type}</td>
                          <td className="px-3 py-2">
                            <span
                              className={cn(
                                waste &&
                                  "inline-flex items-center gap-1 font-medium text-destructive",
                              )}
                            >
                              {waste ? <AlertTriangle className="h-3.5 w-3.5" /> : null}
                              {row.reason || "—"}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right">{row.entries}</td>
                          <td className="px-3 py-2 text-right">{row.quantity}</td>
                          <td className="px-3 py-2 text-right">{formatOrderMoney(row.value)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </ChartCard>

          <ChartCard title={`Purchases · ${formatOrderMoney(data.purchases.total)}`}>
            {data.purchases.by_supplier.length === 0 ? (
              <EmptyChart label="No purchases in this period" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Supplier</th>
                      <th className="px-3 py-2 text-right font-medium">Bills</th>
                      <th className="px-3 py-2 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.purchases.by_supplier.map((row) => (
                      <tr key={row.supplier} className="border-b">
                        <td className="px-3 py-2 font-medium">{row.supplier}</td>
                        <td className="px-3 py-2 text-right">{row.bills}</td>
                        <td className="px-3 py-2 text-right">{formatOrderMoney(row.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ChartCard>
        </div>
      ) : null}
    </QueryState>
  );
}

function FinancialTab({
  enabled,
  filters,
}: {
  enabled: boolean;
  filters: { from: string; to: string; business_public_id?: string };
}) {
  const query = useQuery({
    queryKey: analyticsKeys.financial(filters),
    enabled,
    queryFn: ({ signal }) =>
      withAuthRetry((token) => getAnalyticsFinancial(token, filters, signal)),
  });
  const data = query.data as AnalyticsFinancialData | undefined;

  return (
    <QueryState loading={query.isLoading} error={query.error} onRetry={() => void query.refetch()}>
      {data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
            <Kpi
              label="Revenue"
              value={formatOrderMoney(data.revenue)}
              hint={`${data.orders} orders`}
              tip={data.notes.revenue}
            />
            <Kpi
              label="Refunds"
              value={formatOrderMoney(data.refunds.amount)}
              hint={`${data.refunds.count} refunds · not subtracted from revenue`}
            />
            <Kpi
              label="COGS (estimate)"
              value={formatOrderMoney(data.cogs)}
              tip={data.notes.cogs}
            />
            <Kpi
              label="Gross profit"
              value={formatOrderMoney(data.gross_profit)}
              hint={`${formatSharePct(data.gross_margin_pct)} margin`}
            />
            <Kpi label="Purchases" value={formatOrderMoney(data.purchases)} />
            <Kpi label="Net after purchases" value={formatOrderMoney(data.net_after_purchases)} />
          </div>

          <div className="rounded-2xl border border-info/30 bg-info/5 p-4 text-sm">
            <div className="flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" />
              <div className="space-y-1 text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">Revenue:</span> {data.notes.revenue}
                </p>
                <p>
                  <span className="font-medium text-foreground">COGS (estimate):</span>{" "}
                  {data.notes.cogs}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </QueryState>
  );
}
