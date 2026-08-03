import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { inr, banquetEvents, type Order, type OrderStatus } from "@/lib/mock/data";
import { usePanel, usePanelInventory, usePanelMenu, usePanelMeta, usePanelOrders } from "@/lib/use-panel";
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
  CircleDot,
  Timer,
  Star,
  Bike,
  UtensilsCrossed,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Dashboard — Daawat Baker's" }] }),
});

type Stage = "new" | "preparing" | "ready" | "done";

const stageMeta: {
  id: Stage;
  label: string;
  statuses: OrderStatus[];
  icon: typeof Bell;
  tone: string;
}[] = [
  {
    id: "new",
    label: "New Orders",
    statuses: ["Pending"],
    icon: Bell,
    tone: "border-primary/40 bg-primary/5 text-primary",
  },
  {
    id: "preparing",
    label: "Preparing",
    statuses: ["Preparing"],
    icon: ChefHat,
    tone: "border-info/30 bg-info/5 text-info",
  },
  {
    id: "ready",
    label: "Food Ready",
    statuses: ["Ready", "Out for Delivery"],
    icon: CheckCircle2,
    tone: "border-success/30 bg-success/5 text-success",
  },
];

function Dashboard() {
  const navigate = useNavigate();
  const panel = usePanel();
  const meta = usePanelMeta();
  const panelOrders = usePanelOrders();
  const panelMenu = usePanelMenu();
  const panelInventory = usePanelInventory();
  const [outletOnline, setOutletOnline] = useState(true);
  const [orders, setOrders] = useState<Order[]>(panelOrders);

  useEffect(() => {
    setOrders(panelOrders);
  }, [panelOrders]);

  const counts = useMemo(() => {
    const map = { new: 0, preparing: 0, ready: 0, done: 0 };
    for (const o of orders) {
      if (o.status === "Pending") map.new += 1;
      else if (o.status === "Preparing") map.preparing += 1;
      else if (o.status === "Ready" || o.status === "Out for Delivery") map.ready += 1;
      else map.done += 1;
    }
    return map;
  }, [orders]);

  const newOrders = useMemo(
    () => orders.filter((o) => o.status === "Pending").slice(0, 4),
    [orders],
  );
  const liveOrders = useMemo(
    () =>
      orders
        .filter((o) => o.status === "Preparing" || o.status === "Ready" || o.status === "Out for Delivery")
        .slice(0, 5),
    [orders],
  );

  const todayRevenue = orders
    .filter((o) => o.status !== "Cancelled")
    .reduce((s, o) => s + o.amount, 0);
  const avgOrder = orders.length ? Math.round(todayRevenue / Math.max(orders.length, 1)) : 0;
  const lowStock = panelInventory.filter((i) => i.current <= i.reorder);

  function acceptOrder(order: Order) {
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: "Preparing" } : o)));
    toast.success(`${order.id} accepted`);
  }

  function rejectOrder(order: Order) {
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: "Cancelled" } : o)));
    toast.message(`${order.id} rejected`);
  }

  if (panel === "banquet") {
    return <BanquetDashboard />;
  }

  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      {/* Partner-style top bar */}
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/95 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{meta.label} Home</h1>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                  outletOnline ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
                )}
              >
                <CircleDot className={cn("h-3 w-3", outletOnline && "animate-pulse")} />
                {outletOnline ? "Outlet Online" : "Outlet Offline"}
              </span>
              {counts.new > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                  <Bell className="h-3 w-3 animate-pulse" />
                  {counts.new} waiting
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Live ops snapshot · GST {meta.gst}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-medium">
              Accepting orders
              <Switch checked={outletOnline} onCheckedChange={setOutletOnline} />
            </label>
            <Button className="rounded-xl gap-2" onClick={() => void navigate({ to: "/pos" })}>
              <Plus className="h-4 w-4" />
              New Order
            </Button>
          </div>
        </div>
      </header>

      <div className="space-y-5 p-4 sm:p-6 lg:p-8">
        {/* Stage pipeline — Zomato partner style */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {stageMeta.map((s) => {
            const Icon = s.icon;
            const count = counts[s.id];
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
                    <div className="text-xs font-semibold uppercase tracking-wide opacity-80">{s.label}</div>
                    <div className="text-3xl font-bold tracking-tight text-foreground">{count}</div>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 opacity-50" />
              </Link>
            );
          })}
        </div>

        {/* Today KPIs */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi
            label="Today's Sales"
            value={inr(todayRevenue)}
            icon={IndianRupee}
            hint="+12% vs yesterday"
          />
          <Kpi
            label="Orders Today"
            value={String(orders.length)}
            icon={ShoppingBag}
            hint={`${counts.done} completed`}
          />
          <Kpi
            label="Avg Ticket"
            value={inr(avgOrder)}
            icon={TrendingUp}
            hint="Across channels"
          />
          <Kpi
            label="Rating"
            value="4.6"
            icon={Star}
            hint="128 reviews"
          />
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
          {/* New orders — accept / reject strip */}
          <section className="xl:col-span-3">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold">New Orders</h2>
                {counts.new > 0 && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                    {counts.new}
                  </span>
                )}
              </div>
              <Link to="/orders" className="inline-flex items-center gap-0.5 text-xs font-semibold text-primary hover:underline">
                Open board <ChevronRight className="h-3 w-3" />
              </Link>
            </div>

            {newOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-card px-6 py-12 text-center">
                <UtensilsCrossed className="mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium">No new orders right now</p>
                <p className="mt-1 text-xs text-muted-foreground">Incoming orders will appear here to accept.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {newOrders.map((order) => (
                  <article
                    key={order.id}
                    className="overflow-hidden rounded-2xl border border-primary/30 bg-card shadow-soft ring-1 ring-primary/10"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3 p-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                            {order.channel}
                          </span>
                          <span className="text-sm font-bold">{order.id}</span>
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-warning">
                            <Timer className="h-3 w-3" /> just now
                          </span>
                        </div>
                        <div className="mt-1 text-sm font-semibold">{order.customer}</div>
                        <ul className="mt-2 space-y-0.5 text-sm text-muted-foreground">
                          {order.items.map((it, i) => (
                            <li key={i}>
                              <span className="font-semibold text-foreground">{it.qty}×</span> {it.name}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold">{inr(order.amount)}</div>
                        <div className="text-[11px] text-muted-foreground">{order.pay} · {order.time}</div>
                      </div>
                    </div>
                    <div className="flex border-t">
                      <button
                        type="button"
                        onClick={() => rejectOrder(order)}
                        className="flex-1 bg-muted/40 py-3 text-sm font-semibold text-destructive hover:bg-destructive/10"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        onClick={() => acceptOrder(order)}
                        className="flex-[1.4] bg-primary py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90"
                      >
                        Accept
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* Live kitchen + alerts */}
          <aside className="space-y-5 xl:col-span-2">
            <section className="rounded-2xl border bg-card p-4 shadow-soft">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold">In Kitchen</h2>
                <Link to="/orders" className="text-xs font-semibold text-primary hover:underline">
                  View all
                </Link>
              </div>
              {liveOrders.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">Nothing preparing right now</p>
              ) : (
                <div className="space-y-2">
                  {liveOrders.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => void navigate({ to: "/orders" })}
                      className="flex w-full items-center gap-3 rounded-xl border border-border/70 p-3 text-left hover:bg-muted/40"
                    >
                      <div
                        className={cn(
                          "grid h-9 w-9 place-items-center rounded-lg",
                          o.status === "Preparing" ? "bg-info/10 text-info" : "bg-success/10 text-success",
                        )}
                      >
                        {o.status === "Preparing" ? <ChefHat className="h-4 w-4" /> : <Bike className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{o.id}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {o.customer} · {o.items.length} items
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-semibold">{o.status}</div>
                        <div className="text-[11px] text-muted-foreground">{inr(o.amount)}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-2xl border bg-card p-4 shadow-soft">
              <div className="mb-3 flex items-center gap-2">
                <PackageX className="h-4 w-4 text-warning" />
                <h2 className="text-sm font-bold">Stock Alerts</h2>
              </div>
              <div className="space-y-2">
                {lowStock.slice(0, 4).map((i) => (
                  <div key={i.name} className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{i.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {i.current} {i.unit} left
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 rounded-lg text-xs"
                      onClick={() => toast.success(`Reorder placed for ${i.name}`)}
                    >
                      Reorder
                    </Button>
                  </div>
                ))}
                {lowStock.length === 0 && (
                  <p className="py-4 text-center text-xs text-muted-foreground">Stock looks healthy</p>
                )}
              </div>
            </section>

            <section className="rounded-2xl border bg-card p-4 shadow-soft">
              <h2 className="mb-3 text-sm font-bold">Top Selling</h2>
              <div className="space-y-2">
                {panelMenu.slice(0, 4).map((m, i) => (
                  <div key={m.code} className="flex items-center gap-3">
                    <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                      {i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{m.name}</div>
                      <div className="text-[11px] text-muted-foreground">{m.cat}</div>
                    </div>
                    <div className="text-xs font-semibold">{140 - i * 18} sold</div>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </div>
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
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
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
        <Kpi label="This Week" value={String(banquetEvents.length)} icon={ShoppingBag} hint="Events booked" />
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
