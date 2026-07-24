import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { RowActions } from "@/components/app/row-actions";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { orders as seedOrders, inr, type Order, type OrderStatus } from "@/lib/mock/data";
import { usePanel, usePanelMenu, usePanelMeta } from "@/lib/use-panel";
import { Search, LayoutGrid, List, Timer, MapPin, Phone, Plus, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/orders")({
  component: OrdersPage,
  head: () => ({ meta: [{ title: "Orders — Daawat Baker's" }] }),
});

const tabs = ["All", "Dine-In", "Takeaway", "Delivery", "Online", "Zomato"] as const;
const statusFlow: OrderStatus[] = ["Pending", "Preparing", "Ready", "Completed"];

function nextStatus(s: OrderStatus): OrderStatus | null {
  const i = statusFlow.indexOf(s);
  if (i < 0 || i >= statusFlow.length - 1) return null;
  return statusFlow[i + 1];
}

function OrdersPage() {
  const navigate = useNavigate();
  const panel = usePanel();
  const meta = usePanelMeta();
  const panelOrders = useMemo(() => seedOrders.filter((o) => o.branch === panel), [panel]);
  const panelMenu = usePanelMenu();
  const [tab, setTab] = useState<(typeof tabs)[number]>("All");
  const [view, setView] = useState<"table" | "kanban">("table");
  const [q, setQ] = useState("");
  const [orders, setOrders] = useState<Order[]>(() => panelOrders);
  const [selected, setSelected] = useState<Order | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [extraItems, setExtraItems] = useState<{ name: string; qty: number }[]>([]);

  useEffect(() => {
    setOrders(panelOrders);
  }, [panelOrders]);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (tab !== "All" && o.channel !== tab) return false;
      if (q && !o.id.toLowerCase().includes(q.toLowerCase()) && !o.customer.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [tab, q, orders]);

  const kanbanCols: OrderStatus[] = ["Pending", "Preparing", "Ready", "Completed"];

  function updateOrder(id: string, patch: Partial<Order>) {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
    setSelected((cur) => (cur?.id === id ? { ...cur, ...patch } : cur));
  }

  function addByCode(input: string) {
    const codes = input.split("+").map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
    const items = codes.map((c) => panelMenu.find((m) => m.code === c)).filter(Boolean);
    if (items.length === 0) {
      toast.error("No matching item codes in this panel");
      return;
    }
    setExtraItems((prev) => [...prev, ...items.map((m) => ({ name: m!.name, qty: 1 }))]);
    toast.success(`Added ${items.map((i) => i!.name).join(", ")}`);
    setCodeInput("");
  }

  function advanceStatus(order: Order) {
    const next = nextStatus(order.status);
    if (!next) {
      toast.message("Order already completed");
      return;
    }
    updateOrder(order.id, { status: next });
    toast.success(`${order.id} → ${next}`);
  }

  function cancelOrder(order: Order) {
    updateOrder(order.id, { status: "Cancelled" as OrderStatus });
    toast.success(`${order.id} cancelled`);
  }

  const orderActions = (o: Order) => [
    { label: "View details", onClick: () => setSelected(o) },
    {
      label: nextStatus(o.status) ? `Mark ${nextStatus(o.status)}` : "Already completed",
      onClick: () => advanceStatus(o),
      disabled: !nextStatus(o.status),
    },
    { label: "Print KOT", onClick: () => toast.success(`KOT printed for ${o.id}`) },
    { label: "Assign driver", onClick: () => toast.success(`Driver assigned to ${o.id}`) },
    { separator: true, label: "", onClick: () => {} },
    { label: "Cancel order", onClick: () => cancelOrder(o), destructive: true },
  ];

  return (
    <div>
      <PageHeader
        title={`${meta.label} Orders`}
        crumbs={["Operations", "Orders"]}
        description={`${meta.label} orders only — separate bills & GST (${meta.gst}).`}
        action={
          <Button className="rounded-xl gap-2" onClick={() => void navigate({ to: "/pos" })}>
            <Plus className="h-4 w-4" />
            New Order
          </Button>
        }
      />
      <div className="space-y-4 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList className="rounded-xl">
              {tabs.map((t) => (
                <TabsTrigger key={t} value={t}>
                  {t}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search order id / customer…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-64 rounded-xl pl-9"
              />
            </div>
            <div className="flex rounded-xl border border-border p-0.5">
              <Button size="sm" variant={view === "table" ? "default" : "ghost"} className="h-8 rounded-lg" onClick={() => setView("table")}>
                <List className="h-4 w-4" />
              </Button>
              <Button size="sm" variant={view === "kanban" ? "default" : "ghost"} className="h-8 rounded-lg" onClick={() => setView("kanban")}>
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {view === "table" ? (
          <div className="card-elevated overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Order ID</th>
                    <th className="px-4 py-3 text-left font-medium">Customer</th>
                    <th className="px-4 py-3 text-left font-medium">Channel</th>
                    <th className="px-4 py-3 text-left font-medium">Items</th>
                    <th className="px-4 py-3 text-right font-medium">Amount</th>
                    <th className="px-4 py-3 text-left font-medium">Payment</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium">Time</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((o) => (
                    <tr key={o.id} onClick={() => setSelected(o)} className="cursor-pointer border-b border-border/50 hover:bg-muted/40">
                      <td className="px-4 py-3 font-medium">{o.id}</td>
                      <td className="px-4 py-3">{o.customer}</td>
                      <td className="px-4 py-3 text-muted-foreground">{o.channel}</td>
                      <td className="px-4 py-3 text-muted-foreground">{o.items.length} items</td>
                      <td className="px-4 py-3 text-right font-semibold">{inr(o.amount)}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-md bg-muted px-2 py-0.5 text-xs">{o.pay}</span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={o.status} />
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{o.time}</td>
                      <td className="px-4 py-3 text-right">
                        <RowActions items={orderActions(o)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {kanbanCols.map((col) => {
              const list = filtered.filter((o) => o.status === col);
              return (
                <div key={col} className="card-elevated p-3">
                  <div className="mb-2 flex items-center justify-between px-1">
                    <StatusBadge status={col} />
                    <span className="text-xs text-muted-foreground">{list.length}</span>
                  </div>
                  <div className="space-y-2">
                    {list.map((o) => (
                      <div key={o.id} className="rounded-xl border border-border/70 bg-card p-3 text-left hover:border-primary/40">
                        <div className="flex items-center justify-between gap-2">
                          <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setSelected(o)}>
                            <span className="text-sm font-semibold">{o.id}</span>
                          </button>
                          <div className="flex items-center gap-1">
                            {col === "Preparing" && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                                <Timer className="h-3 w-3" />
                                {Math.floor(Math.random() * 20) + 5}m
                              </span>
                            )}
                            <RowActions items={orderActions(o)} />
                          </div>
                        </div>
                        <button type="button" className="mt-1 w-full text-left" onClick={() => setSelected(o)}>
                          <div className="text-xs text-muted-foreground">
                            {o.customer} · {o.channel}
                          </div>
                          <div className="mt-2 flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">{o.items.length} items</span>
                            <span className="text-sm font-semibold">{inr(o.amount)}</span>
                          </div>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

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
                <SheetTitle className="flex items-center justify-between">
                  <span>{selected.id}</span>
                  <StatusBadge status={selected.status} />
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
                  {nextStatus(selected.status) && (
                    <Button className="rounded-xl" onClick={() => advanceStatus(selected)}>
                      Mark {nextStatus(selected.status)}
                    </Button>
                  )}
                  <Button variant="outline" className="rounded-xl" onClick={() => toast.success(`KOT printed for ${selected.id}`)}>
                    Print KOT
                  </Button>
                  <Button variant="outline" className="rounded-xl text-destructive" onClick={() => cancelOrder(selected)}>
                    Cancel
                  </Button>
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
                        <span key={i} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
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
