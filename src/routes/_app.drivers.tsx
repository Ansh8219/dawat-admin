import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { RowActions } from "@/components/app/row-actions";
import { StatusBadge } from "@/components/app/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { drivers as seedDrivers, inr } from "@/lib/mock/data";
import { cn } from "@/lib/utils";
import {
  Bike,
  MapPin,
  Phone,
  Plus,
  Search,
  Star,
  Timer,
  UserRound,
  CircleDot,
  Package,
  IndianRupee,
  CheckCircle2,
  Navigation,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/drivers")({
  component: DriversPage,
  head: () => ({ meta: [{ title: "Drivers — Daawat Baker's" }] }),
});

type DriverStatus = "Online" | "On Delivery" | "Offline";
type Driver = (typeof seedDrivers)[number] & { status: DriverStatus };
type FleetFilter = "all" | DriverStatus;

type QueueOrder = {
  id: string;
  customer: string;
  area: string;
  amount: number;
  waitMin: number;
  items: number;
  assigned: string;
};

const seedQueue: QueueOrder[] = [
  { id: "DB-1201", customer: "Priya Kapoor", area: "Sector 45", amount: 680, waitMin: 4, items: 3, assigned: "" },
  { id: "DB-1202", customer: "Rohan Mehta", area: "DLF Phase 4", amount: 1240, waitMin: 9, items: 5, assigned: "" },
  { id: "DB-1203", customer: "Ananya Iyer", area: "MG Road", amount: 420, waitMin: 2, items: 2, assigned: "" },
  { id: "DB-1204", customer: "Vikram Singh", area: "Cyber Hub", amount: 890, waitMin: 14, items: 4, assigned: "" },
];

const filterTabs: { id: FleetFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "Online", label: "Available" },
  { id: "On Delivery", label: "On Delivery" },
  { id: "Offline", label: "Offline" },
];

function initials(name: string) {
  return name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2);
}

function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>(() => [...seedDrivers] as Driver[]);
  const [queue, setQueue] = useState<QueueOrder[]>(seedQueue);
  const [filter, setFilter] = useState<FleetFilter>("all");
  const [q, setQ] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "" });
  const [assigningId, setAssigningId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const online = drivers.filter((d) => d.status === "Online").length;
    const onDelivery = drivers.filter((d) => d.status === "On Delivery").length;
    const offline = drivers.filter((d) => d.status === "Offline").length;
    const waiting = queue.filter((o) => !o.assigned).length;
    const earnings = drivers.reduce((s, d) => s + d.earnings, 0);
    return { online, onDelivery, offline, waiting, earnings, total: drivers.length };
  }, [drivers, queue]);

  const availableDrivers = useMemo(
    () => drivers.filter((d) => d.status === "Online"),
    [drivers],
  );

  const waitingOrders = useMemo(() => queue.filter((o) => !o.assigned), [queue]);
  const activeRuns = useMemo(() => queue.filter((o) => o.assigned), [queue]);

  const filteredDrivers = useMemo(() => {
    return drivers
      .filter((d) => (filter === "all" ? true : d.status === filter))
      .filter((d) => {
        if (!q.trim()) return true;
        const needle = q.toLowerCase();
        return d.name.toLowerCase().includes(needle) || d.phone.includes(needle) || d.id.toLowerCase().includes(needle);
      })
      .sort((a, b) => {
        const rank = { Online: 0, "On Delivery": 1, Offline: 2 };
        return rank[a.status] - rank[b.status] || b.deliveries - a.deliveries;
      });
  }, [drivers, filter, q]);

  function addDriver() {
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error("Name and phone are required");
      return;
    }
    const next: Driver = {
      id: `DRV-${100 + drivers.length}`,
      name: form.name.trim(),
      phone: form.phone.trim(),
      status: "Online",
      deliveries: 0,
      earnings: 0,
      rating: "5.0",
    };
    setDrivers((prev) => [next, ...prev]);
    setAddOpen(false);
    setForm({ name: "", phone: "" });
    toast.success(`${next.name} added to fleet`);
  }

  function toggleStatus(driver: Driver) {
    const next: DriverStatus =
      driver.status === "Online" ? "Offline" : driver.status === "Offline" ? "Online" : "Online";
    setDrivers((prev) => prev.map((d) => (d.id === driver.id ? { ...d, status: next } : d)));
    toast.success(`${driver.name} → ${next}`);
  }

  function assignOrder(orderId: string, driverName: string) {
    if (!driverName) {
      toast.error("Pick a driver first");
      return;
    }
    setQueue((prev) => prev.map((o) => (o.id === orderId ? { ...o, assigned: driverName } : o)));
    setDrivers((prev) =>
      prev.map((d) => (d.name === driverName ? { ...d, status: "On Delivery" as const } : d)),
    );
    setAssigningId(null);
    toast.success(`${orderId} assigned to ${driverName}`);
  }

  function quickAssign(orderId: string) {
    const free = availableDrivers[0];
    if (!free) {
      toast.error("No available drivers online");
      return;
    }
    assignOrder(orderId, free.name);
  }

  function markDelivered(orderId: string) {
    const order = queue.find((o) => o.id === orderId);
    if (!order?.assigned) return;
    setQueue((prev) => prev.filter((o) => o.id !== orderId));
    setDrivers((prev) =>
      prev.map((d) =>
        d.name === order.assigned
          ? { ...d, status: "Online", deliveries: d.deliveries + 1, earnings: d.earnings + 80 }
          : d,
      ),
    );
    toast.success(`${orderId} delivered · ${order.assigned} free again`);
  }

  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <PageHeader
        title="Delivery Fleet"
        crumbs={["Operations", "Drivers"]}
        description="Assign waiting orders, track riders, and keep the fleet moving."
        action={
          <Button className="rounded-xl gap-2" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add Driver
          </Button>
        }
      />

      <div className="space-y-5 p-4 sm:p-6 lg:p-8">
        {/* Snapshot KPIs */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Kpi
            label="Waiting"
            value={String(counts.waiting)}
            hint="Need a rider"
            icon={Package}
            tone={counts.waiting > 0 ? "border-primary/40 bg-primary/5 text-primary" : undefined}
          />
          <Kpi label="Available" value={String(counts.online)} hint="Ready to assign" icon={CircleDot} tone="text-success" />
          <Kpi label="On Delivery" value={String(counts.onDelivery)} hint="Out on road" icon={Navigation} tone="text-info" />
          <Kpi label="Offline" value={String(counts.offline)} hint="Not working" icon={Bike} />
          <Kpi label="Today Earnings" value={inr(counts.earnings)} hint={`${counts.total} riders`} icon={IndianRupee} />
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
          {/* Assignment board — primary job */}
          <section className="space-y-4 xl:col-span-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold">Assignment Queue</h2>
                <p className="text-xs text-muted-foreground">Orders ready for pickup</p>
              </div>
              {counts.waiting > 0 && (
                <span className="rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-bold text-primary-foreground">
                  {counts.waiting} waiting
                </span>
              )}
            </div>

            {waitingOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-card px-6 py-14 text-center shadow-soft">
                <CheckCircle2 className="mb-2 h-9 w-9 text-success" />
                <p className="text-sm font-semibold">Queue clear</p>
                <p className="mt-1 text-xs text-muted-foreground">All ready orders are assigned.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {waitingOrders.map((order) => {
                  const urgent = order.waitMin >= 10;
                  const picking = assigningId === order.id;
                  return (
                    <article
                      key={order.id}
                      className={cn(
                        "overflow-hidden rounded-2xl border bg-card shadow-soft",
                        urgent && "border-warning/50 ring-1 ring-warning/20",
                      )}
                    >
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-bold tracking-tight">{order.id}</span>
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                                  urgent ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground",
                                )}
                              >
                                <Timer className="h-3 w-3" />
                                {order.waitMin}m wait
                              </span>
                            </div>
                            <div className="mt-1 text-sm font-medium">{order.customer}</div>
                            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3 shrink-0" />
                              {order.area} · {order.items} items
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-base font-bold">{inr(order.amount)}</div>
                            <div className="text-[11px] text-muted-foreground">COD / Paid</div>
                          </div>
                        </div>

                        {picking ? (
                          <div className="mt-3 space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground">Pick an available rider</p>
                            {availableDrivers.length === 0 ? (
                              <p className="rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                                No riders online right now.
                              </p>
                            ) : (
                              <div className="grid gap-1.5">
                                {availableDrivers.map((d) => (
                                  <button
                                    key={d.id}
                                    type="button"
                                    onClick={() => assignOrder(order.id, d.name)}
                                    className="flex items-center gap-3 rounded-xl border border-border/70 px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
                                  >
                                    <Avatar className="h-8 w-8">
                                      <AvatarFallback className="bg-success/15 text-xs font-semibold text-success">
                                        {initials(d.name)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0 flex-1">
                                      <div className="truncate text-sm font-semibold">{d.name}</div>
                                      <div className="text-[11px] text-muted-foreground">
                                        {d.deliveries} trips · ★ {d.rating}
                                      </div>
                                    </div>
                                    <span className="text-xs font-bold text-primary">Assign</span>
                                  </button>
                                ))}
                              </div>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 rounded-lg text-xs"
                              onClick={() => setAssigningId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <div className="mt-3 flex gap-2">
                            <Button
                              variant="outline"
                              className="flex-1 rounded-xl"
                              onClick={() => setAssigningId(order.id)}
                            >
                              Choose rider
                            </Button>
                            <Button
                              className="flex-1 rounded-xl"
                              disabled={availableDrivers.length === 0}
                              onClick={() => quickAssign(order.id)}
                            >
                              Auto-assign
                            </Button>
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {activeRuns.length > 0 && (
              <div className="rounded-2xl border bg-card p-4 shadow-soft">
                <h3 className="mb-3 text-sm font-bold">Active Runs</h3>
                <div className="space-y-2">
                  {activeRuns.map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center gap-3 rounded-xl border border-info/20 bg-info/5 px-3 py-2.5"
                    >
                      <div className="grid h-9 w-9 place-items-center rounded-lg bg-info/15 text-info">
                        <Bike className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">
                          {order.id} · {order.area}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {order.assigned} · {order.customer}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 shrink-0 rounded-lg text-xs"
                        onClick={() => markDelivered(order.id)}
                      >
                        Delivered
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Fleet roster */}
          <section className="xl:col-span-3">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-bold">Fleet Roster</h2>
                <p className="text-xs text-muted-foreground">{filteredDrivers.length} riders shown</p>
              </div>
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search name, phone, id…"
                  className="rounded-xl pl-9"
                />
              </div>
            </div>

            <div className="mb-4 flex flex-wrap gap-1.5">
              {filterTabs.map((tab) => {
                const count =
                  tab.id === "all"
                    ? counts.total
                    : tab.id === "Online"
                      ? counts.online
                      : tab.id === "On Delivery"
                        ? counts.onDelivery
                        : counts.offline;
                const active = filter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFilter(tab.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                      active
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                    )}
                  >
                    {tab.label}
                    <span
                      className={cn(
                        "inline-flex min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold",
                        active ? "bg-background/20 text-background" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {filteredDrivers.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-card px-6 py-16 text-center">
                <UserRound className="mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-semibold">No riders match</p>
                <p className="mt-1 text-xs text-muted-foreground">Try another filter or search.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {filteredDrivers.map((driver) => (
                  <DriverCard
                    key={driver.id}
                    driver={driver}
                    onToggle={() => toggleStatus(driver)}
                    onRemove={() => {
                      setDrivers((prev) => prev.filter((d) => d.id !== driver.id));
                      toast.success(`${driver.name} removed`);
                    }}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Driver</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Full name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ramesh Kumar"
                className="mt-1 rounded-xl"
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+91 98…"
                className="mt-1 rounded-xl"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" className="rounded-xl" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button className="rounded-xl" onClick={addDriver}>
                Save Driver
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof Bike;
  tone?: string;
}) {
  return (
    <div className={cn("rounded-2xl border bg-card p-4 shadow-soft", tone?.includes("border-") && tone)}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={cn("grid h-8 w-8 place-items-center rounded-lg bg-muted text-muted-foreground", tone)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight">{value}</div>
      <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>
    </div>
  );
}

function DriverCard({
  driver,
  onToggle,
  onRemove,
}: {
  driver: Driver;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const tone =
    driver.status === "Online"
      ? "border-success/30"
      : driver.status === "On Delivery"
        ? "border-info/30"
        : "border-border opacity-90";

  return (
    <article className={cn("rounded-2xl border bg-card p-4 shadow-soft transition-shadow hover:shadow-elevated", tone)}>
      <div className="flex items-start gap-3">
        <div className="relative">
          <Avatar className="h-11 w-11">
            <AvatarFallback
              className={cn(
                "text-sm font-semibold",
                driver.status === "Online" && "bg-success/15 text-success",
                driver.status === "On Delivery" && "bg-info/15 text-info",
                driver.status === "Offline" && "bg-muted text-muted-foreground",
              )}
            >
              {initials(driver.name)}
            </AvatarFallback>
          </Avatar>
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card",
              driver.status === "Online" && "bg-success",
              driver.status === "On Delivery" && "bg-info",
              driver.status === "Offline" && "bg-muted-foreground/40",
            )}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate font-semibold">{driver.name}</div>
              <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <Phone className="h-3 w-3" />
                {driver.phone}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <StatusBadge status={driver.status} />
              <RowActions
                items={[
                  { label: "Call rider", onClick: () => toast.message(`Calling ${driver.phone}`) },
                  {
                    label: driver.status === "Offline" ? "Set online" : "Set offline",
                    onClick: onToggle,
                  },
                  { label: "View profile", onClick: () => toast.message(driver.name) },
                  { separator: true, label: "", onClick: () => {} },
                  { label: "Remove", onClick: onRemove, destructive: true },
                ]}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-muted/40 p-2.5 text-center">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Trips</div>
          <div className="mt-0.5 text-sm font-bold">{driver.deliveries}</div>
        </div>
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Earned</div>
          <div className="mt-0.5 text-sm font-bold">{inr(driver.earnings)}</div>
        </div>
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Rating</div>
          <div className="mt-0.5 inline-flex items-center justify-center gap-0.5 text-sm font-bold">
            {driver.rating}
            <Star className="h-3 w-3 fill-gold text-gold" />
          </div>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-8 flex-1 rounded-lg text-xs"
          onClick={() => toast.message(`Calling ${driver.phone}`)}
        >
          <Phone className="mr-1.5 h-3.5 w-3.5" />
          Call
        </Button>
        <Button
          size="sm"
          variant={driver.status === "Offline" ? "default" : "outline"}
          className="h-8 flex-1 rounded-lg text-xs"
          onClick={onToggle}
          disabled={driver.status === "On Delivery"}
        >
          {driver.status === "Offline" ? "Go online" : driver.status === "On Delivery" ? "Busy" : "Go offline"}
        </Button>
      </div>
    </article>
  );
}
