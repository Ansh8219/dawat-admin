import { Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowRight,
  Bell,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  IndianRupee,
  Landmark,
  Lock,
  Mail,
  RefreshCw,
  RotateCcw,
  TriangleAlert,
  Users,
} from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatDay,
  formatInr,
  formatMonth,
  getHallDashboard,
  HALL_BOOKING_STATUS_LABELS,
  HALL_BOOKING_STATUSES,
  isForbidden,
  type HallBookingStatus,
  type HallDashboardData,
} from "@/lib/api/hall-bookings";
import { ApiError } from "@/lib/api/types";
import { withAuthRetry } from "@/lib/api/with-auth";
import { cn } from "@/lib/utils";

const STATUS_COLOR: Record<HallBookingStatus, string> = {
  pending_payment: "oklch(0.7 0.02 260)",
  pending_approval: "var(--color-warning)",
  confirmed: "var(--color-success)",
  completed: "var(--color-info)",
  no_show: "oklch(0.7 0.17 50)",
  rejected: "var(--color-destructive)",
  expired: "oklch(0.82 0.01 260)",
};

const tooltipStyle = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: 12,
  color: "var(--color-card-foreground)",
  fontSize: 12,
};

/** "2026-11-12" → { day: "12", mon: "Nov", wd: "Thu" } without timezone shifting. */
function dateParts(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const f = (o: Intl.DateTimeFormatOptions) =>
    dt.toLocaleDateString("en-IN", { timeZone: "UTC", ...o });
  return { day: f({ day: "numeric" }), mon: f({ month: "short" }), wd: f({ weekday: "short" }) };
}

export function HallDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<HallDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [noAccess, setNoAccess] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setNoAccess(false);
    try {
      setData(await withAuthRetry((t) => getHallDashboard(t)));
    } catch (err) {
      if (isForbidden(err)) setNoAccess(true);
      else setError(err instanceof ApiError ? err.message : "Unable to load the dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openStatus = (status: HallBookingStatus) =>
    void navigate({ to: "/hall-bookings", search: { status } });

  const pending = data?.cards.pending_approvals ?? 0;

  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/95 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Banquet Hall Home</h1>
              {pending > 0 && (
                <Link
                  to="/hall-bookings"
                  search={{ status: "pending_approval" }}
                  className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground"
                >
                  <Bell className="h-3 w-3 animate-pulse" />
                  {pending} awaiting approval
                </Link>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">Bookings · advances · hall load</p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" className="rounded-xl">
              <Link to="/hall-bookings">All bookings</Link>
            </Button>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} /> Refresh
            </Button>
          </div>
        </div>
      </header>

      {noAccess ? (
        <div className="p-4 sm:p-6 lg:p-8">
          <EmptyState
            icon={Lock}
            title="No access"
            description="You don't have permission to view the hall dashboard."
          />
        </div>
      ) : !data ? (
        <div className="space-y-4 p-4 sm:p-6 lg:p-8">
          {error ? (
            <EmptyState
              icon={TriangleAlert}
              title="Couldn't load the dashboard"
              description={error}
              action={<Button onClick={() => void load()}>Try again</Button>}
            />
          ) : (
            <DashboardSkeleton />
          )}
        </div>
      ) : (
        <Body data={data} loading={loading} error={error} openStatus={openStatus} />
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl lg:col-span-2" />
      </div>
      <Skeleton className="h-72 rounded-2xl" />
    </>
  );
}

function Body({
  data,
  loading,
  error,
  openStatus,
}: {
  data: HallDashboardData;
  loading: boolean;
  error: string;
  openStatus: (s: HallBookingStatus) => void;
}) {
  const { cards, money, status_breakdown, upcoming, halls, daily_load } = data;
  const month = formatMonth(money.month_start);
  const statusData = HALL_BOOKING_STATUSES.map((s) => ({
    status: s,
    label: HALL_BOOKING_STATUS_LABELS[s],
    count: status_breakdown[s] ?? 0,
  }));
  const hasStatusData = statusData.some((d) => d.count > 0);
  const maxStatus = Math.max(1, ...statusData.map((d) => d.count));
  const maxHall = Math.max(1, ...halls.map((h) => h.bookings_this_month));

  return (
    <div className={cn("space-y-4 p-4 transition-opacity sm:p-6 lg:p-8", loading && "opacity-70")}>
      {error && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Refresh failed: {error}
        </p>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Link
          to="/hall-bookings"
          search={{ status: "pending_approval" }}
          className="group relative overflow-hidden rounded-2xl border border-warning/40 bg-gradient-to-br from-warning/20 via-warning/10 to-card p-4 shadow-soft transition-shadow hover:shadow-md"
        >
          <KpiHead label="Pending approvals" icon={CalendarClock} tone="warn" />
          <div className="mt-2 text-3xl font-bold tracking-tight">{cards.pending_approvals}</div>
          <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-warning-foreground">
            Review now
            <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </div>
        </Link>
        <Kpi
          label="Today"
          value={cards.today_bookings}
          hint="Bookings today"
          icon={CalendarDays}
          tone="primary"
        />
        <Kpi
          label="Next 7 days"
          value={cards.upcoming_week}
          hint="Upcoming events"
          icon={CalendarCheck}
          tone="info"
        />
        <Kpi
          label="Approved"
          value={cards.approved_this_month}
          hint="This month"
          icon={CalendarCheck}
          tone="success"
        />
        {/* No Enquiries screen yet, so this is informational. */}
        <Kpi
          label="New enquiries"
          value={cards.new_enquiries}
          hint="Awaiting follow-up"
          icon={Mail}
          tone="gold"
        />
      </div>

      {/* Money + status */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <MoneyCard
            label="Advance collected"
            sub={month}
            value={formatInr(money.advance_collected)}
            icon={IndianRupee}
            tone="success"
          />
          <MoneyCard
            label="Refunded"
            sub={month}
            value={formatInr(money.refunded)}
            icon={RotateCcw}
            tone="danger"
          />
        </div>

        <Card title="Bookings by status" hint="Click to filter" className="lg:col-span-2">
          {!hasStatusData ? (
            <Empty text="No bookings yet" />
          ) : (
            <div className="grid items-center gap-4 sm:grid-cols-[200px_1fr]">
              <div className="mx-auto h-48 w-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData.filter((d) => d.count > 0)}
                      dataKey="count"
                      nameKey="label"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={2}
                      stroke="var(--color-card)"
                      cursor="pointer"
                      onClick={(d: { status?: HallBookingStatus }) =>
                        d?.status && openStatus(d.status)
                      }
                    >
                      {statusData
                        .filter((d) => d.count > 0)
                        .map((d) => (
                          <Cell key={d.status} fill={STATUS_COLOR[d.status]} />
                        ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => [v, "Bookings"]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="space-y-1.5">
                {statusData.map((d) => (
                  <li key={d.status}>
                    <button
                      type="button"
                      onClick={() => openStatus(d.status)}
                      className="group w-full rounded-lg px-2 py-1.5 text-left hover:bg-muted/60"
                    >
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ background: STATUS_COLOR[d.status] }}
                          />
                          {d.label}
                        </span>
                        <span className="font-semibold tabular-nums">{d.count}</span>
                      </div>
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${(d.count / maxStatus) * 100}%`,
                            background: STATUS_COLOR[d.status],
                          }}
                        />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>

      {/* Upcoming + halls */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card title="Next 7 days" hint="Confirmed bookings" className="lg:col-span-3">
          {upcoming.length === 0 ? (
            <Empty text="No confirmed bookings in the next 7 days" icon={CalendarCheck} />
          ) : (
            <ul className="space-y-2">
              {upcoming.map((b) => {
                const p = dateParts(b.booking_date);
                return (
                  <li key={b.public_id}>
                    <Link
                      to="/hall-bookings"
                      search={{ booking: b.public_id }}
                      className="flex items-center gap-3 rounded-xl border p-3 transition-colors hover:border-primary/40 hover:bg-muted/40"
                    >
                      <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                        <div className="text-center leading-tight">
                          <div className="text-[10px] font-semibold uppercase">{p.wd}</div>
                          <div className="text-lg font-bold">{p.day}</div>
                          <div className="text-[10px] font-semibold uppercase">{p.mon}</div>
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2">
                          <span className="truncate text-sm font-semibold">{b.hall?.name}</span>
                          <span className="text-xs text-muted-foreground">· {b.slot?.label}</span>
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {b.contact_name} · <span className="tabular-nums">{b.contact_phone}</span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right text-xs text-muted-foreground">
                        <div className="flex items-center justify-end gap-1 font-medium text-foreground">
                          <Users className="h-3.5 w-3.5" /> {b.guests}
                        </div>
                        {b.occasion && <div className="max-w-28 truncate">{b.occasion}</div>}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title="Halls" hint={month} className="lg:col-span-2">
          {halls.length === 0 ? (
            <Empty text="No halls yet" icon={Landmark} />
          ) : (
            <ul className="space-y-4">
              {halls.map((h) => (
                <li key={h.public_id}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className={cn(
                          "h-2 w-2 shrink-0 rounded-full",
                          h.is_active ? "bg-success" : "bg-muted-foreground/40",
                        )}
                        title={h.is_active ? "Active" : "Inactive"}
                      />
                      <span className="truncate text-sm font-semibold">{h.name}</span>
                      {!h.is_active && (
                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          Inactive
                        </span>
                      )}
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">
                      {formatInr(h.advance_this_month)}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${(h.bookings_this_month / maxHall) * 100}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {h.bookings_this_month} booking{h.bookings_this_month === 1 ? "" : "s"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* 30 day load */}
      <Card title="Next 30 days load" hint="Pending approval + confirmed, by event date">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={daily_load} margin={{ left: -12, right: 4, top: 8 }}>
              <XAxis
                dataKey="date"
                tickFormatter={(d: string) => {
                  const p = dateParts(d);
                  return `${p.day} ${p.mon}`;
                }}
                interval="preserveStartEnd"
                minTickGap={28}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                allowDecimals={false}
                width={36}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ fill: "var(--color-muted)", opacity: 0.5 }}
                labelFormatter={(d) => formatDay(String(d))}
                formatter={(v) => [v, "Bookings"]}
              />
              <Bar dataKey="bookings" radius={[6, 6, 0, 0]} maxBarSize={22}>
                {daily_load.map((d) => (
                  <Cell
                    key={d.date}
                    fill={d.bookings > 0 ? "var(--color-primary)" : "var(--color-muted)"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

const TONES = {
  primary: "bg-primary/10 text-primary",
  info: "bg-info/10 text-info",
  success: "bg-success/10 text-success",
  gold: "bg-gold/20 text-gold-foreground",
  warn: "bg-warning/25 text-warning-foreground",
  danger: "bg-destructive/10 text-destructive",
} as const;

function KpiHead({
  label,
  icon: Icon,
  tone,
}: {
  label: string;
  icon: typeof Mail;
  tone: keyof typeof TONES;
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={cn("grid h-8 w-8 place-items-center rounded-lg", TONES[tone])}>
        <Icon className="h-4 w-4" />
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  icon: typeof Mail;
  tone: keyof typeof TONES;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-soft">
      <KpiHead label={label} icon={icon} tone={tone} />
      <div className="mt-2 text-3xl font-bold tracking-tight">{value}</div>
      <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>
    </div>
  );
}

function MoneyCard({
  label,
  sub,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  sub: string;
  value: string;
  icon: typeof Mail;
  tone: "success" | "danger";
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-2xl border bg-gradient-to-br to-card p-5 shadow-soft",
        tone === "success" ? "from-success/10" : "from-destructive/10",
      )}
    >
      <div className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-xl", TONES[tone])}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label} · {sub}
        </div>
        <div className="mt-1 truncate text-2xl font-bold tracking-tight">{value}</div>
      </div>
    </div>
  );
}

function Card({
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

function Empty({ text, icon: Icon = CalendarDays }: { text: string; icon?: typeof Mail }) {
  return (
    <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/20 px-4 text-center text-xs text-muted-foreground">
      <Icon className="h-5 w-5" />
      {text}
    </div>
  );
}
