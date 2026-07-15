import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { RowActions } from "@/components/app/row-actions";
import { StatCard } from "@/components/app/stat-card";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  inr,
  salesDaily,
  salesMonthly,
  channelSplit,
  kpiSpark,
  kpiSpark2,
  kpiSpark3,
  kpiSpark4,
  inventory,
  orders,
  menuItems,
  banquetEvents,
} from "@/lib/mock/data";
import {
  IndianRupee,
  ShoppingBag,
  TrendingUp,
  Armchair,
  Plus,
  PackageX,
  Image as ImageIcon,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

export const Route = createFileRoute("/_app/")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Dashboard — Daawat Baker's" }] }),
});

function Dashboard() {
  const navigate = useNavigate();
  const [range, setRange] = useState<"daily" | "weekly" | "monthly">("daily");
  const [biz, setBiz] = useState<"all" | "bakery" | "restaurant" | "banquet">("all");
  const [bookings, setBookings] = useState(banquetEvents.slice(0, 4));
  const chartData = range === "monthly" ? salesMonthly : salesDaily;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        crumbs={["Home", "Dashboard"]}
        description="Live snapshot of Daawat Baker's operations."
        action={
          <Button className="rounded-xl gap-2" onClick={() => void navigate({ to: "/pos" })}>
            <Plus className="h-4 w-4" /> New Order
          </Button>
        }
      />

      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <Tabs value={biz} onValueChange={(v) => setBiz(v as typeof biz)}>
          <TabsList className="rounded-xl">
            <TabsTrigger value="all">All Business</TabsTrigger>
            <TabsTrigger value="bakery">Bakery</TabsTrigger>
            <TabsTrigger value="restaurant">Restaurant</TabsTrigger>
            <TabsTrigger value="banquet">Banquet</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Today's Revenue"
            value={inr(84200)}
            delta={12.4}
            icon={IndianRupee}
            spark={kpiSpark}
            tone="brand"
          />
          <StatCard
            label="Total Orders"
            value="248"
            delta={8.1}
            icon={ShoppingBag}
            spark={kpiSpark2}
            tone="info"
          />
          <StatCard
            label="Avg Order Value"
            value={inr(680)}
            delta={-2.3}
            icon={TrendingUp}
            spark={kpiSpark3}
            tone="gold"
          />
          <StatCard
            label="Active Tables"
            value="14 / 18"
            delta={5.5}
            icon={Armchair}
            spark={kpiSpark4}
            tone="success"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="card-elevated p-5 xl:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Sales Overview</div>
                <div className="text-xs text-muted-foreground">Total revenue across channels</div>
              </div>
              <Tabs value={range} onValueChange={(v) => setRange(v as typeof range)}>
                <TabsList className="h-8">
                  <TabsTrigger value="daily" className="text-xs">
                    Daily
                  </TabsTrigger>
                  <TabsTrigger value="weekly" className="text-xs">
                    Weekly
                  </TabsTrigger>
                  <TabsTrigger value="monthly" className="text-xs">
                    Monthly
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="brand" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={12} />
                  <YAxis
                    stroke="var(--color-muted-foreground)"
                    fontSize={12}
                    tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 12,
                    }}
                    formatter={(v: number) => inr(v)}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="var(--color-primary)"
                    strokeWidth={2.5}
                    fill="url(#brand)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card-elevated p-5">
            <div className="text-sm font-semibold">Revenue by Channel</div>
            <div className="text-xs text-muted-foreground">Share this week</div>
            <div className="mt-2 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={channelSplit}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {channelSplit.map((c, i) => (
                      <Cell key={i} fill={c.color} />
                    ))}
                  </Pie>
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="card-elevated p-5">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Inventory Alerts</div>
              <PackageX className="h-4 w-4 text-warning" />
            </div>
            <div className="mt-3 space-y-2">
              {inventory
                .filter((i) => i.current <= i.reorder)
                .slice(0, 5)
                .map((i) => (
                  <div
                    key={i.name}
                    className="flex items-center justify-between rounded-xl border border-border/70 p-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{i.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {i.current} {i.unit} left · reorder {i.reorder}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-lg h-8"
                      onClick={() => toast.success(`Reorder placed for ${i.name}`)}
                    >
                      Reorder
                    </Button>
                  </div>
                ))}
            </div>
          </div>

          <div className="card-elevated p-5 xl:col-span-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Recent Orders</div>
              <Link
                to="/orders"
                className="text-xs text-primary inline-flex items-center gap-0.5 hover:underline"
              >
                View all <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b border-border/70">
                    <th className="py-2 text-left font-medium">Order</th>
                    <th className="py-2 text-left font-medium">Customer</th>
                    <th className="py-2 text-left font-medium">Channel</th>
                    <th className="py-2 text-right font-medium">Amount</th>
                    <th className="py-2 text-right font-medium">Status</th>
                    <th className="py-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.slice(0, 6).map((o) => (
                    <tr key={o.id} className="border-b border-border/50 hover:bg-muted/40">
                      <td className="py-2.5 font-medium">{o.id}</td>
                      <td className="py-2.5">{o.customer}</td>
                      <td className="py-2.5 text-muted-foreground">{o.channel}</td>
                      <td className="py-2.5 text-right font-semibold">{inr(o.amount)}</td>
                      <td className="py-2.5 text-right">
                        <StatusBadge status={o.status} />
                      </td>
                      <td className="py-2.5 text-right">
                        <RowActions
                          items={[
                            {
                              label: "View",
                              onClick: () => void navigate({ to: "/orders" }),
                            },
                            {
                              label: "Print",
                              onClick: () => toast.success(`Printing ${o.id}`),
                            },
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="card-elevated p-5">
            <div className="text-sm font-semibold">Hot Selling Products</div>
            <div className="mt-3 space-y-2.5">
              {menuItems.slice(0, 5).map((m, i) => (
                <div key={m.code} className="flex items-center gap-3 rounded-xl p-2 hover:bg-muted/40">
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                    #{i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{m.name}</div>
                    <div className="text-xs text-muted-foreground">{m.cat}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">{140 - i * 22} sold</div>
                    <div className="text-xs text-muted-foreground">{inr(m.price)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card-elevated p-5">
            <div className="text-sm font-semibold">Upcoming Bookings</div>
            <div className="mt-3 space-y-2.5">
              {bookings.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">No pending bookings</div>
              ) : (
                bookings.map((e) => (
                  <div
                    key={e.date}
                    className="flex items-center gap-3 rounded-xl border border-border/60 p-3"
                  >
                    <div className="grid h-11 w-11 place-items-center rounded-xl bg-gold/20 text-gold-foreground font-bold">
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
                ))
              )}
            </div>
          </div>

          <div className="card-elevated relative overflow-hidden p-5">
            <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-primary/10" />
            <div className="absolute -bottom-8 -left-4 h-24 w-24 rounded-full bg-gold/20" />
            <div className="relative">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground">
                <ImageIcon className="h-5 w-5" />
              </div>
              <div className="mt-3 text-base font-semibold">Promotional Banners</div>
              <p className="mt-1 text-sm text-muted-foreground">
                Manage the banners customers see in the ordering app.
              </p>
              <Button
                variant="outline"
                className="mt-4 rounded-xl"
                onClick={() => void navigate({ to: "/marketing" })}
              >
                Manage Banners
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
