import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { orders as seedOrders, inr, type Order, type OrderStatus, type Channel } from "@/lib/mock/data";
import { usePanel, usePanelMenu, usePanelMeta } from "@/lib/use-panel";
import { cn } from "@/lib/utils";
import {
  Search,
  Timer,
  MapPin,
  Phone,
  Plus,
  X,
  Bell,
  Bike,
  Store,
  UtensilsCrossed,
  ShoppingBag,
  ChefHat,
  CheckCircle2,
  XCircle,
  Printer,
  Volume2,
  CircleDot,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/orders")({
  component: OrdersPage,
  head: () => ({ meta: [{ title: "Orders — Daawat Baker's" }] }),
});

type Stage = "new" | "preparing" | "ready" | "done";

const stages: { id: Stage; label: string; short: string; statuses: OrderStatus[] }[] = [
  { id: "new", label: "New Orders", short: "New", statuses: ["Pending"] },
  { id: "preparing", label: "Food Preparing", short: "Preparing", statuses: ["Preparing"] },
  { id: "ready", label: "Food Ready", short: "Ready", statuses: ["Ready", "Out for Delivery"] },
  { id: "done", label: "Past Orders", short: "Past", statuses: ["Completed", "Cancelled"] },
];

const channels: Array<"All" | Channel> = ["All", "Dine-In", "Takeaway", "Delivery", "Online", "Zomato"];

const PREP_OPTIONS = [15, 20, 25, 30, 40, 45];

const statusFlow: OrderStatus[] = ["Pending", "Preparing", "Ready", "Completed"];

function nextStatus(s: OrderStatus): OrderStatus | null {
  const i = statusFlow.indexOf(s);
  if (i < 0 || i >= statusFlow.length - 1) return null;
  return statusFlow[i + 1];
}

/** Stable pseudo-elapsed minutes from order id (simulates “placed ago”). */
function elapsedMinutes(orderId: string): number {
  let hash = 0;
  for (let i = 0; i < orderId.length; i++) hash = (hash + orderId.charCodeAt(i) * (i + 1)) % 23;
  return 2 + hash;
}

function formatTimer(totalMinutes: number) {
  const m = Math.max(0, Math.floor(totalMinutes));
  const s = (totalMinutes * 7) % 60; // decorative seconds from id hash feel
  return `${String(m).padStart(2, "0")}:${String(Math.floor(s)).padStart(2, "0")}`;
}

function channelIcon(channel: Channel) {
  switch (channel) {
    case "Zomato":
    case "Online":
      return ShoppingBag;
    case "Delivery":
      return Bike;
    case "Takeaway":
      return Store;
    default:
      return UtensilsCrossed;
  }
}

function channelTone(channel: Channel) {
  switch (channel) {
    case "Zomato":
      return "bg-[#E23744]/12 text-[#E23744] ring-[#E23744]/20";
    case "Online":
      return "bg-primary/10 text-primary ring-primary/20";
    case "Delivery":
      return "bg-info/10 text-info ring-info/20";
    case "Takeaway":
      return "bg-amber-500/10 text-amber-700 ring-amber-500/20";
    default:
      return "bg-muted text-muted-foreground ring-border";
  }
}

function primaryActionLabel(status: OrderStatus, channel: Channel): string | null {
  switch (status) {
    case "Pending":
      return "Accept";
    case "Preparing":
      return "Food Ready";
    case "Ready":
      return channel === "Delivery" || channel === "Zomato" || channel === "Online"
        ? "Handed to Rider"
        : "Picked Up";
    case "Out for Delivery":
      return "Mark Delivered";
    default:
      return null;
  }
}

function OrdersPage() {
  const navigate = useNavigate();
  const panel = usePanel();
  const meta = usePanelMeta();
  const panelOrders = useMemo(() => seedOrders.filter((o) => o.branch === panel), [panel]);
  const panelMenu = usePanelMenu();
  const [stage, setStage] = useState<Stage>("new");
  const [channel, setChannel] = useState<(typeof channels)[number]>("All");
  const [q, setQ] = useState("");
  const [orders, setOrders] = useState<Order[]>(() => panelOrders);
  const [selected, setSelected] = useState<Order | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [extraItems, setExtraItems] = useState<{ name: string; qty: number }[]>([]);
  const [outletOnline, setOutletOnline] = useState(true);
  const [acceptTarget, setAcceptTarget] = useState<Order | null>(null);
  const [prepChoice, setPrepChoice] = useState(20);
  const [prepByOrder, setPrepByOrder] = useState<Record<string, number>>({});

  useEffect(() => {
    setOrders(panelOrders);
  }, [panelOrders]);

  const counts = useMemo(() => {
    const map: Record<Stage, number> = { new: 0, preparing: 0, ready: 0, done: 0 };
    for (const o of orders) {
      for (const s of stages) {
        if (s.statuses.includes(o.status)) map[s.id] += 1;
      }
    }
    return map;
  }, [orders]);

  const filtered = useMemo(() => {
    const stageStatuses = stages.find((s) => s.id === stage)?.statuses ?? [];
    return orders
      .filter((o) => stageStatuses.includes(o.status))
      .filter((o) => (channel === "All" ? true : o.channel === channel))
      .filter((o) => {
        if (!q) return true;
        const needle = q.toLowerCase();
        return o.id.toLowerCase().includes(needle) || o.customer.toLowerCase().includes(needle);
      })
      .sort((a, b) => {
        if (stage === "preparing" || stage === "ready") {
          return elapsedMinutes(b.id) - elapsedMinutes(a.id);
        }
        return b.time.localeCompare(a.time);
      });
  }, [orders, stage, channel, q]);

  function updateOrder(id: string, patch: Partial<Order>) {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
    setSelected((cur) => (cur?.id === id ? { ...cur, ...patch } : cur));
  }

  function addByCode(input: string) {
    const codes = input
      .split("+")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n));
    const items = codes.map((c) => panelMenu.find((m) => m.code === c)).filter(Boolean);
    if (items.length === 0) {
      toast.error("No matching item codes in this panel");
      return;
    }
    setExtraItems((prev) => [...prev, ...items.map((m) => ({ name: m!.name, qty: 1 }))]);
    toast.success(`Added ${items.map((i) => i!.name).join(", ")}`);
    setCodeInput("");
  }

  function confirmAccept() {
    if (!acceptTarget) return;
    setPrepByOrder((p) => ({ ...p, [acceptTarget.id]: prepChoice }));
    updateOrder(acceptTarget.id, { status: "Preparing" });
    toast.success(`${acceptTarget.id} accepted · prep ${prepChoice} min`);
    setAcceptTarget(null);
    setStage("preparing");
  }

  function advanceStatus(order: Order) {
    if (order.status === "Pending") {
      setPrepChoice(20);
      setAcceptTarget(order);
      return;
    }
    const next = nextStatus(order.status);
    if (!next) {
      toast.message("Order already completed");
      return;
    }
    // Ready + delivery channels → Out for Delivery briefly then complete via "Handed to Rider" maps to Completed
    if (order.status === "Ready" || order.status === "Out for Delivery") {
      updateOrder(order.id, { status: "Completed" });
      toast.success(`${order.id} completed`);
      return;
    }
    updateOrder(order.id, { status: next });
    toast.success(`${order.id} → ${next}`);
    if (order.status === "Preparing") setStage("ready");
  }

  function cancelOrder(order: Order) {
    updateOrder(order.id, { status: "Cancelled" });
    toast.success(`${order.id} rejected`);
    setStage("done");
    setAcceptTarget(null);
  }

  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      {/* Compact Zomato-style ops header */}
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Orders</h1>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                  outletOnline
                    ? "bg-success/15 text-success"
                    : "bg-muted text-muted-foreground",
                )}
              >
                <CircleDot className={cn("h-3 w-3", outletOnline && "animate-pulse")} />
                {outletOnline ? "Live" : "Paused"}
              </span>
              {counts.new > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                  <Bell className="h-3 w-3 animate-pulse" />
                  {counts.new} new
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {meta.label} · partner-style kitchen board
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-medium">
              <Volume2 className="h-3.5 w-3.5 text-muted-foreground" />
              Outlet online
              <Switch checked={outletOnline} onCheckedChange={setOutletOnline} />
            </label>
            <Button className="rounded-xl gap-2" onClick={() => void navigate({ to: "/pos" })}>
              <Plus className="h-4 w-4" />
              New Order
            </Button>
          </div>
        </div>

        {/* Underline tabs — Zomato partner style */}
        <div className="flex items-end gap-1 overflow-x-auto px-4 sm:px-6 lg:px-8">
          {stages.map((s) => {
            const active = stage === s.id;
            const count = counts[s.id];
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setStage(s.id)}
                className={cn(
                  "relative flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors",
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                  s.id === "new" && count > 0 && !active && "text-primary",
                )}
              >
                {s.id === "new" && count > 0 && <Bell className="h-3.5 w-3.5" />}
                {s.id === "preparing" && <ChefHat className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{s.label}</span>
                <span className="sm:hidden">{s.short}</span>
                <span
                  className={cn(
                    "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-bold",
                    active
                      ? "bg-primary text-primary-foreground"
                      : s.id === "new" && count > 0
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6 lg:p-8">
        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {channels.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setChannel(c)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                  channel === c
                    ? "bg-foreground text-background"
                    : "bg-card text-muted-foreground ring-1 ring-border hover:text-foreground",
                )}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search order / customer…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="rounded-xl border-border/80 bg-card pl-9"
            />
          </div>
        </div>

        {/* New orders alert banner */}
        {stage === "new" && counts.new > 0 && (
          <div className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/8 px-4 py-3 text-sm">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Bell className="h-4 w-4 animate-pulse" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-foreground">
                {counts.new} new {counts.new === 1 ? "order" : "orders"} waiting
              </div>
              <div className="text-xs text-muted-foreground">Accept quickly to keep prep times accurate</div>
            </div>
            {!outletOnline && (
              <span className="rounded-full bg-warning/15 px-2.5 py-1 text-[11px] font-semibold text-warning">
                Outlet paused
              </span>
            )}
          </div>
        )}

        {/* Order tickets */}
        {filtered.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 py-20 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <ChefHat className="h-7 w-7 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold">
              {stage === "new" ? "No new orders" : `No ${stages.find((s) => s.id === stage)?.label.toLowerCase()}`}
            </h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {stage === "new"
                ? "Incoming orders will appear here for accept / reject — like the restaurant partner app."
                : "Orders in this stage will show up as kitchen tickets."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((order) => (
              <OrderTicket
                key={order.id}
                order={order}
                prepMins={prepByOrder[order.id]}
                onOpen={() => setSelected(order)}
                onAdvance={() => advanceStatus(order)}
                onCancel={() => cancelOrder(order)}
                onPrint={() => toast.success(`KOT printed for ${order.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Accept + prep time — Zomato flow */}
      <Dialog open={!!acceptTarget} onOpenChange={(v) => !v && setAcceptTarget(null)}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Accept order</DialogTitle>
          </DialogHeader>
          {acceptTarget && (
            <div className="space-y-4">
              <div className="rounded-xl border bg-muted/30 p-3">
                <div className="text-sm font-semibold">{acceptTarget.id}</div>
                <div className="text-xs text-muted-foreground">
                  {acceptTarget.customer} · {acceptTarget.items.reduce((s, i) => s + i.qty, 0)} items ·{" "}
                  {inr(acceptTarget.amount)}
                </div>
              </div>
              <div>
                <div className="mb-2 text-sm font-medium">Select preparation time</div>
                <div className="grid grid-cols-3 gap-2">
                  {PREP_OPTIONS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPrepChoice(m)}
                      className={cn(
                        "rounded-xl border py-3 text-sm font-bold transition-colors",
                        prepChoice === m
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card hover:border-primary/40",
                      )}
                    >
                      {m} min
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl text-destructive hover:bg-destructive/10"
                  onClick={() => cancelOrder(acceptTarget)}
                >
                  Reject
                </Button>
                <Button className="flex-[1.4] rounded-xl" onClick={confirmAccept}>
                  Accept · {prepChoice} min
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Sheet
        open={!!selected}
        onOpenChange={(v) => {
          if (!v) {
            setSelected(null);
            setExtraItems([]);
          }
        }}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center justify-between gap-3 pr-6">
                  <span>{selected.id}</span>
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{selected.status}</span>
                </SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                <div className="rounded-xl border p-3">
                  <div className="text-xs text-muted-foreground">Customer</div>
                  <div className="font-medium">{selected.customer}</div>
                  <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" /> {selected.phone}
                  </div>
                  {selected.address && (
                    <div className="mt-1 flex items-start gap-1 text-xs text-muted-foreground">
                      <MapPin className="mt-0.5 h-3 w-3" /> {selected.address}
                    </div>
                  )}
                </div>

                <div>
                  <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Progress</div>
                  <div className="flex items-center gap-1">
                    {statusFlow.map((s, i) => {
                      const done = statusFlow.indexOf(selected.status) >= i;
                      return <div key={s} className={`h-2 flex-1 rounded-full ${done ? "bg-primary" : "bg-muted"}`} />;
                    })}
                  </div>
                  <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                    <span>Pending</span>
                    <span>Preparing</span>
                    <span>Ready</span>
                    <span>Done</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {primaryActionLabel(selected.status, selected.channel) && (
                    <Button className="rounded-xl" onClick={() => advanceStatus(selected)}>
                      {primaryActionLabel(selected.status, selected.channel)}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => toast.success(`KOT printed for ${selected.id}`)}
                  >
                    Print KOT
                  </Button>
                  {selected.status !== "Cancelled" && selected.status !== "Completed" && (
                    <Button
                      variant="outline"
                      className="rounded-xl text-destructive"
                      onClick={() => cancelOrder(selected)}
                    >
                      Reject / Cancel
                    </Button>
                  )}
                </div>

                <div>
                  <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Items</div>
                  <div className="space-y-1.5">
                    {[...selected.items, ...extraItems.map((x) => ({ ...x, price: 0, code: 0 }))].map((it, i) => (
                      <div key={i} className="flex items-center justify-between rounded-lg border p-2 text-sm">
                        <span>
                          {it.qty}× {it.name}
                        </span>
                        <span className="font-medium">{inr(it.qty * (it as { price: number }).price)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Quick Add by Code</div>
                  <div className="flex gap-2">
                    <Input
                      value={codeInput}
                      onChange={(e) => setCodeInput(e.target.value)}
                      placeholder="e.g. 22+67"
                      onKeyDown={(e) => e.key === "Enter" && addByCode(codeInput)}
                      className="rounded-xl"
                    />
                    <Button className="rounded-xl" onClick={() => addByCode(codeInput)}>
                      Add
                    </Button>
                  </div>
                  {extraItems.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {extraItems.map((x, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                        >
                          {x.name}
                          <button type="button" onClick={() => setExtraItems((p) => p.filter((_, j) => j !== i))}>
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between rounded-xl bg-primary/5 p-3">
                  <span className="text-sm">Total</span>
                  <span className="text-lg font-bold text-primary">{inr(selected.amount)}</span>
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
  prepMins,
  onOpen,
  onAdvance,
  onCancel,
  onPrint,
}: {
  order: Order;
  prepMins?: number;
  onOpen: () => void;
  onAdvance: () => void;
  onCancel: () => void;
  onPrint: () => void;
}) {
  const ChannelIcon = channelIcon(order.channel);
  const action = primaryActionLabel(order.status, order.channel);
  const isNew = order.status === "Pending";
  const elapsed = elapsedMinutes(order.id);
  const promised = prepMins ?? 20;
  const delayed =
    (order.status === "Preparing" || order.status === "Ready") && elapsed > promised;
  const showTimer = order.status === "Pending" || order.status === "Preparing" || order.status === "Ready";
  const itemCount = order.items.reduce((s, i) => s + i.qty, 0);

  return (
    <article
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl border bg-card shadow-soft transition-all hover:shadow-elevated",
        isNew && "border-primary/45 ring-1 ring-primary/15",
        delayed && "border-destructive/50 ring-1 ring-destructive/20",
      )}
    >
      {/* Status strip */}
      <div
        className={cn(
          "h-1 w-full",
          isNew && "bg-primary",
          order.status === "Preparing" && (delayed ? "bg-destructive animate-pulse" : "bg-info"),
          order.status === "Ready" && "bg-success",
          order.status === "Out for Delivery" && "bg-gold",
          order.status === "Completed" && "bg-muted",
          order.status === "Cancelled" && "bg-destructive/50",
        )}
      />

      <button type="button" onClick={onOpen} className="flex flex-1 flex-col p-4 text-left">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1",
                  channelTone(order.channel),
                )}
              >
                <ChannelIcon className="h-3 w-3" />
                {order.channel}
              </span>
              <span className="text-sm font-bold tracking-tight">{order.id}</span>
            </div>
            <div className="text-[11px] text-muted-foreground">
              {itemCount} {itemCount === 1 ? "item" : "items"} · {order.time}
              {prepMins ? ` · prep ${prepMins}m` : ""}
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
                {formatTimer(elapsed)}
              </div>
            </div>
          )}
        </div>

        <div className="mt-3">
          <div className="text-sm font-semibold">{order.customer}</div>
          <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <Phone className="h-3 w-3" />
            {order.phone}
          </div>
          {order.address && (
            <div className="mt-1 line-clamp-2 flex items-start gap-1 text-xs text-muted-foreground">
              <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
              {order.address}
            </div>
          )}
        </div>

        <div className="mt-3 space-y-1.5 border-t border-border/60 pt-3">
          {order.items.map((item, i) => (
            <div key={`${item.code}-${i}`} className="flex items-start justify-between gap-3 text-sm">
              <span className="text-foreground">
                <span className="mr-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded bg-muted px-1 text-xs font-bold text-muted-foreground">
                  {item.qty}
                </span>
                {item.name}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">{inr(item.qty * item.price)}</span>
            </div>
          ))}
        </div>

        <div className="mt-auto flex items-end justify-between border-t border-border/60 pt-3">
          <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {order.pay}
          </span>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Bill total</div>
            <div className="text-lg font-bold">{inr(order.amount)}</div>
          </div>
        </div>
      </button>

      {/* Full-width action bar — partner app style */}
      <div className="flex border-t border-border/70">
        {isNew && (
          <button
            type="button"
            onClick={onCancel}
            className="flex flex-1 items-center justify-center gap-1.5 bg-card px-3 py-3.5 text-sm font-bold uppercase tracking-wide text-destructive transition-colors hover:bg-destructive/10"
          >
            <XCircle className="h-4 w-4" />
            Reject
          </button>
        )}
        {!isNew && order.status !== "Completed" && order.status !== "Cancelled" && (
          <button
            type="button"
            onClick={onPrint}
            className="flex items-center justify-center gap-1.5 border-r border-border/70 bg-muted/30 px-4 py-3.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted"
            aria-label="Print KOT"
          >
            <Printer className="h-4 w-4" />
          </button>
        )}
        {action ? (
          <button
            type="button"
            onClick={onAdvance}
            className={cn(
              "flex flex-[2] items-center justify-center gap-2 px-3 py-3.5 text-sm font-bold uppercase tracking-wide text-primary-foreground transition-colors",
              isNew && "bg-primary hover:bg-primary/90",
              order.status === "Preparing" &&
                (delayed
                  ? "animate-pulse bg-destructive hover:bg-destructive/90"
                  : "bg-success hover:bg-success/90"),
              (order.status === "Ready" || order.status === "Out for Delivery") &&
                "bg-foreground hover:bg-foreground/90",
            )}
          >
            {action}
          </button>
        ) : (
          <div className="flex flex-1 items-center justify-center gap-2 bg-muted/40 px-3 py-3.5 text-sm font-medium text-muted-foreground">
            {order.status === "Cancelled" ? (
              <>
                <XCircle className="h-4 w-4 text-destructive" />
                Rejected
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 text-success" />
                Completed
              </>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
