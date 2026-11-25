import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { InvoiceDocument } from "@/components/app/invoice-document";
import { OptionsDialog } from "@/components/app/pos-options-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listBusinesses } from "@/lib/api/businesses";
import { formatInvoiceDateTime, formatInvoiceMoney, getInvoice } from "@/lib/api/invoices";
import { paymentLabel, tableLabel } from "@/lib/api/orders";
import {
  addCounterOrderItems,
  getPosMenu,
  listCounterOrders,
  removeCounterOrderItem,
  settleCounterOrder,
  updateCounterOrderItem,
} from "@/lib/api/pos";
import {
  ApiError,
  type Business,
  type CounterOrder,
  type CounterOrderItem,
  type CounterOrderItemsPayload,
  type CounterOrderListData,
  type CounterOrderSettled,
  type CounterOrderStatusFilter,
  type InvoiceDetail,
  type PosMenuData,
  type PosMenuItem,
  type PosPaymentMethod,
} from "@/lib/api/types";
import { withAuthRetry } from "@/lib/api/with-auth";
import { useAccess, useBusinessScope } from "@/lib/access";
import { BUSINESS_ACCESS_DENIED_MESSAGE } from "@/lib/api/client";
import { useAuth } from "@/lib/auth";
import { useCounterPaymentAlerts } from "@/lib/counter-payment-alerts";
import { printInvoicePdf } from "@/lib/invoice-export";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  FileText,
  Loader2,
  Minus,
  Phone,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Smartphone,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

const money = formatInvoiceMoney;
const PAGE_SIZE = 20;
const MENU_PAGE_SIZE = 20;
const MAX_ADD_LINES = 50;

const METHODS: { m: PosPaymentMethod; label: string; icon: typeof Wallet }[] = [
  { m: "cash", label: "Cash", icon: Wallet },
  { m: "upi", label: "UPI", icon: Smartphone },
  { m: "card", label: "Card", icon: CreditCard },
];

function errMessage(err: unknown, fallback: string) {
  return err instanceof ApiError || err instanceof Error ? err.message : fallback;
}

function isAbort(err: unknown, signal: AbortSignal) {
  return signal.aborted || (err instanceof DOMException && err.name === "AbortError");
}

type ErrorHooks = {
  /** Order is paid or gone: close the Counter Order screen. */
  close: () => void;
  /** Refetch the Pending list (and the open order with it). */
  refresh: () => void;
};

/** Shared error handling for every counter-order endpoint. */
function handleCounterError(err: unknown, hooks: ErrorHooks, fallback: string) {
  const code = err instanceof ApiError ? err.code : "";
  const status = err instanceof ApiError ? err.status : 0;
  switch (code) {
    case "business_access_denied":
      // Item or order from a business this manager can't access; the refetched list is filtered.
      toast.error(BUSINESS_ACCESS_DENIED_MESSAGE);
      hooks.refresh();
      return;
    case "order_already_paid":
      toast.info("Already paid");
      hooks.close();
      hooks.refresh();
      return;
    case "order_not_handed_over":
      toast.error("Hand over the order first");
      return;
    case "order_not_found":
      toast.error("Order not found");
      hooks.close();
      hooks.refresh();
      return;
    case "order_item_not_editable":
      toast.error("Only extra items can be changed");
      hooks.refresh();
      return;
    case "order_item_not_found":
      toast.error("Item not found");
      hooks.refresh();
      return;
    case "menu_item_not_found":
      toast.error("Item is unavailable");
      return;
  }
  if (status === 403) {
    toast.error("You don't have permission to do that.");
    return;
  }
  toast.error(errMessage(err, fallback));
}

function waitingFor(since: string | null, now: number): string {
  if (!since) return "—";
  const ms = now - new Date(since).getTime();
  if (!Number.isFinite(ms)) return "—";
  const mins = Math.max(0, Math.floor(ms / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  return `${h}h ${mins % 60}m`;
}

function roleLabel(role: string) {
  if (role === "super_admin") return "Super admin";
  if (role === "manager") return "Manager";
  return role.replace(/_/g, " ");
}

function itemLabel(it: { name: string; variant_name: string | null }) {
  return `${it.name}${it.variant_name ? ` (${it.variant_name})` : ""}`;
}

function orderTitle(o: CounterOrder) {
  return `${tableLabel(o.table_number)}${o.customer?.name ? ` · ${o.customer.name}` : ""}`;
}

/** POS tab for QR dine-in "Pay at Counter" orders: Pending (handed over, unpaid) and Paid. */
export function CounterPayments() {
  const [tab, setTab] = useState<CounterOrderStatusFilter>("pending");
  const clearPendingAlerts = useCounterPaymentAlerts((s) => s.clearPendingAlerts);

  useEffect(() => {
    clearPendingAlerts();
  }, [clearPendingAlerts]);

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as CounterOrderStatusFilter)}>
      <TabsList className="rounded-xl">
        <TabsTrigger value="pending">Pending</TabsTrigger>
        <TabsTrigger value="paid">Paid</TabsTrigger>
      </TabsList>
      <TabsContent value="pending" className="mt-4">
        <CounterList status="pending" />
      </TabsContent>
      <TabsContent value="paid" className="mt-4">
        <CounterList status="paid" />
      </TabsContent>
    </Tabs>
  );
}

function CounterList({ status }: { status: CounterOrderStatusFilter }) {
  const tick = useCounterPaymentAlerts((s) => s.tick);
  const paidIds = useCounterPaymentAlerts((s) => s.paidIds);
  const changed = useCounterPaymentAlerts((s) => s.changed);
  const markPaid = useCounterPaymentAlerts((s) => s.markPaid);
  const rememberPending = useCounterPaymentAlerts((s) => s.rememberPending);
  const clearPendingAlerts = useCounterPaymentAlerts((s) => s.clearPendingAlerts);

  const [page, setPage] = useState(1);
  const [data, setData] = useState<CounterOrderListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState<CounterOrder | null>(null);
  const [receipt, setReceipt] = useState<CounterOrderSettled | null>(null);

  const refresh = useCallback(() => setReload((n) => n + 1), []);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError("");
    withAuthRetry((t) => listCounterOrders(t, { status, page, page_size: PAGE_SIZE }, ctrl.signal))
      .then((d) => {
        if (ctrl.signal.aborted) return;
        // Page emptied (e.g. last pending row settled) → step back.
        if (d.results.length === 0 && page > 1) {
          setPage((p) => p - 1);
          return;
        }
        setData(d);
        if (status === "pending") rememberPending(d.results.map((o) => o.public_id));
      })
      .catch((err) => {
        if (!isAbort(err, ctrl.signal)) setError(errMessage(err, "Unable to load orders."));
      })
      .finally(() => !ctrl.signal.aborted && setLoading(false));
    return () => ctrl.abort();
  }, [status, page, tick, reload, rememberPending]);

  // Keep the open Counter Order in step with a fresh list.
  useEffect(() => {
    setOpen((cur) => {
      if (!cur || !data) return cur;
      return data.results.find((o) => o.public_id === cur.public_id) ?? cur;
    });
  }, [data]);

  // Extras changed (here or on another till): update that row's total; refetch if it's open.
  useEffect(() => {
    if (!changed || status !== "pending") return;
    const total = Number(changed.total);
    if (Number.isFinite(total)) {
      setData((d) =>
        d
          ? {
              ...d,
              results: d.results.map((o) => (o.public_id === changed.id ? { ...o, total } : o)),
            }
          : d,
      );
    }
    if (open?.public_id === changed.id) refresh();
    // Only react to new events, not to `open` changing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [changed?.seq, status]);

  // Socket alerts while the list is on screen count as seen.
  useEffect(() => {
    if (status === "pending") clearPendingAlerts();
  }, [status, tick, clearPendingAlerts]);

  // Keep "waiting since" fresh.
  useEffect(() => {
    if (status !== "pending") return;
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, [status]);

  const rows =
    status === "pending"
      ? (data?.results ?? []).filter((o) => !paidIds.includes(o.public_id))
      : (data?.results ?? []);
  const totalPages = data ? Math.max(1, Math.ceil(data.count / data.page_size)) : 1;

  /** Server returned the updated order: it replaces both the screen and the row. */
  function replaceOrder(order: CounterOrder) {
    setOpen(order);
    setData((d) =>
      d
        ? {
            ...d,
            results: d.results.map((o) => (o.public_id === order.public_id ? order : o)),
          }
        : d,
    );
  }

  function onSettled(result: CounterOrderSettled) {
    setOpen(null);
    setReceipt(result);
    markPaid(result.public_id); // hides it from Pending and refetches
    const numbers = result.invoices.map((i) => i.invoice_number).join(", ");
    toast.success(`${tableLabel(result.table_number)} paid${numbers ? ` · ${numbers}` : ""}`);
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          {status === "pending"
            ? "Handed-over orders waiting to pay at the counter, oldest first. Tap one to add extras or take payment."
            : "Orders settled at the counter, latest first."}
          {data && <span className="ml-2 font-medium text-foreground">({data.count})</span>}
        </div>
        <Button
          variant="outline"
          size="icon"
          className="rounded-xl"
          onClick={refresh}
          disabled={loading}
          aria-label="Refresh"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
      </div>

      {error ? (
        <div className="card-elevated grid place-items-center gap-3 p-10 text-sm text-destructive">
          {error}
          <Button variant="outline" size="sm" onClick={refresh}>
            Retry
          </Button>
        </div>
      ) : loading && !data ? (
        <div className="card-elevated grid place-items-center p-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <div className="card-elevated grid place-items-center p-10 text-sm text-muted-foreground">
          {status === "pending"
            ? "No payments pending at the counter."
            : "No counter payments yet."}
        </div>
      ) : status === "pending" ? (
        <div className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-3", loading && "opacity-60")}>
          {rows.map((o) => (
            <PendingCard key={o.public_id} order={o} now={now} onOpen={() => setOpen(o)} />
          ))}
        </div>
      ) : (
        <PaidTable rows={rows} dimmed={loading} />
      )}

      {data && data.count > data.page_size && (
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Page {data.page} of {totalPages}
          </span>
          <div className="flex gap-1">
            <Button
              size="icon"
              variant="outline"
              className="h-7 w-7"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="h-7 w-7"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {status === "pending" && (
        <CounterOrderScreen
          order={open}
          onClose={() => setOpen(null)}
          onChange={replaceOrder}
          onSettled={onSettled}
          refresh={refresh}
        />
      )}
      <CounterReceiptDialog result={receipt} onClose={() => setReceipt(null)} />
    </div>
  );
}

function PendingCard({
  order,
  now,
  onOpen,
}: {
  order: CounterOrder;
  now: number;
  onOpen: () => void;
}) {
  const extras = order.items.filter((i) => i.is_extra).length;
  return (
    <button
      onClick={onOpen}
      className="card-elevated flex flex-col overflow-hidden text-left transition-all hover:border-primary/50 hover:shadow-md"
    >
      <div className="flex w-full items-start justify-between gap-2 p-4">
        <div className="min-w-0">
          <div className="text-2xl font-bold leading-tight">{tableLabel(order.table_number)}</div>
          {(order.customer?.name || order.customer?.phone) && (
            <div className="mt-1 truncate text-sm text-muted-foreground">
              {order.customer?.name}
              {order.customer?.phone && (
                <span className="ml-2 inline-flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {order.customer.phone}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="shrink-0 rounded-md border border-warning/40 bg-warning/15 px-2 py-1 text-xs font-semibold text-warning">
          <Clock className="mr-1 inline h-3 w-3" />
          {waitingFor(order.handed_over_at, now)}
        </div>
      </div>
      <div className="mt-auto flex w-full items-end justify-between gap-2 border-t bg-muted/20 p-4">
        <div className="text-xs text-muted-foreground">
          {order.item_count} item{order.item_count === 1 ? "" : "s"}
          {extras > 0 && (
            <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 font-medium text-primary">
              {extras} extra{extras === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Total</div>
          <div className="text-xl font-bold text-primary">{money(order.total)}</div>
        </div>
      </div>
    </button>
  );
}

function PaidTable({ rows, dimmed }: { rows: CounterOrder[]; dimmed: boolean }) {
  return (
    <div className="card-elevated overflow-x-auto">
      <table className={cn("w-full text-sm", dimmed && "opacity-60")}>
        <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-left font-medium">Table</th>
            <th className="px-4 py-3 text-right font-medium">Total</th>
            <th className="px-4 py-3 text-left font-medium">Method</th>
            <th className="px-4 py-3 text-left font-medium">Paid at</th>
            <th className="px-4 py-3 text-left font-medium">Received by</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => (
            <tr key={o.public_id} className="border-b">
              <td className="px-4 py-3 font-medium">{tableLabel(o.table_number)}</td>
              <td className="px-4 py-3 text-right font-semibold">{money(o.total)}</td>
              <td className="px-4 py-3">
                <span className="rounded-md bg-muted px-2 py-0.5 text-xs">
                  {paymentLabel(o.payment_method)}
                </span>
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground">
                {formatInvoiceDateTime(o.paid_at)}
              </td>
              <td className="px-4 py-3 text-xs">
                {o.paid_by ? `${o.paid_by.name} (${roleLabel(o.paid_by.role)})` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** One pending order: guest items (read-only), extras (editable), totals, add items, settle. */
function CounterOrderScreen({
  order,
  onClose,
  onChange,
  onSettled,
  refresh,
}: {
  order: CounterOrder | null;
  onClose: () => void;
  onChange: (order: CounterOrder) => void;
  onSettled: (result: CounterOrderSettled) => void;
  refresh: () => void;
}) {
  const { canManage } = useAccess();
  const canEdit = canManage("pos");
  const received = useCounterPaymentAlerts((s) => s.received);

  const [busyLine, setBusyLine] = useState<string | null>(null);
  const [removing, setRemoving] = useState<CounterOrderItem | null>(null);
  const [picking, setPicking] = useState(false);
  const [settling, setSettling] = useState(false);
  /** True while this till's settle request is in flight (its own payment_received is not "another counter"). */
  const settlingRef = useRef(false);
  const orderId = order?.public_id ?? null;

  useEffect(() => {
    setBusyLine(null);
    setRemoving(null);
    setPicking(false);
    setSettling(false);
  }, [orderId]);

  // Paid on another till while open here.
  useEffect(() => {
    if (!received || !orderId || received.id !== orderId || settlingRef.current) return;
    toast.info("Paid by another counter");
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [received?.seq]);

  const hooks: ErrorHooks = { close: onClose, refresh };

  async function changeQty(item: CounterOrderItem, quantity: number) {
    if (!order || busyLine || quantity < 1 || quantity > 99) return;
    setBusyLine(item.public_id);
    try {
      onChange(
        await withAuthRetry((t) =>
          updateCounterOrderItem(t, order.public_id, item.public_id, quantity),
        ),
      );
    } catch (err) {
      handleCounterError(err, hooks, "Unable to change the quantity.");
    } finally {
      setBusyLine(null);
    }
  }

  async function confirmRemove() {
    const item = removing;
    if (!order || !item) return;
    setRemoving(null);
    setBusyLine(item.public_id);
    try {
      onChange(
        await withAuthRetry((t) => removeCounterOrderItem(t, order.public_id, item.public_id)),
      );
      toast.success(`Removed ${item.quantity} × ${itemLabel(item)}`);
    } catch (err) {
      handleCounterError(err, hooks, "Unable to remove the item.");
    } finally {
      setBusyLine(null);
    }
  }

  async function addItems(lines: CounterOrderItemsPayload["items"]): Promise<boolean> {
    if (!order) return false;
    try {
      onChange(
        await withAuthRetry((t) => addCounterOrderItems(t, order.public_id, { items: lines })),
      );
      toast.success(`Added ${lines.length} item${lines.length === 1 ? "" : "s"}`);
      return true;
    } catch (err) {
      handleCounterError(err, hooks, "Unable to add items.");
      return false;
    }
  }

  const guestItems = order?.items.filter((i) => !i.is_extra) ?? [];
  const extraItems = order?.items.filter((i) => i.is_extra) ?? [];

  return (
    <>
      <Dialog open={!!order} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-lg">
          {order && (
            <>
              <DialogHeader className="border-b p-5 pb-4">
                <DialogTitle className="text-xl">{orderTitle(order)}</DialogTitle>
                {order.customer?.phone && (
                  <div className="text-xs text-muted-foreground">{order.customer.phone}</div>
                )}
              </DialogHeader>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
                <section>
                  <div className="mb-1.5 text-xs font-semibold uppercase text-muted-foreground">
                    Guest's order
                  </div>
                  <div className="space-y-1.5">
                    {guestItems.map((it) => (
                      <div
                        key={it.public_id}
                        className="flex items-start justify-between gap-3 rounded-lg border p-2.5 text-sm"
                      >
                        <LineText item={it} />
                        <span className="shrink-0 font-medium">{money(it.line_total)}</span>
                      </div>
                    ))}
                  </div>
                </section>

                {extraItems.length > 0 && (
                  <section>
                    <div className="mb-1.5 text-xs font-semibold uppercase text-muted-foreground">
                      Added at counter
                    </div>
                    <div className="space-y-1.5">
                      {extraItems.map((it) => {
                        const busy = busyLine === it.public_id;
                        return (
                          <div
                            key={it.public_id}
                            className={cn(
                              "rounded-lg border border-primary/30 bg-primary/5 p-2.5 text-sm",
                              busy && "opacity-60",
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <LineText item={it} />
                              <span className="shrink-0 font-medium">{money(it.line_total)}</span>
                            </div>
                            <div className="mt-2 flex items-center justify-between gap-2">
                              <div className="text-[11px] text-muted-foreground">
                                <span className="mr-1.5 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold uppercase text-primary-foreground">
                                  Extra
                                </span>
                                {it.added_by && `added by ${it.added_by.name}`}
                              </div>
                              {canEdit && (
                                <div className="flex items-center gap-1">
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    className="h-7 w-7"
                                    disabled={!!busyLine || it.quantity <= 1}
                                    onClick={() => void changeQty(it, it.quantity - 1)}
                                    aria-label="Decrease quantity"
                                  >
                                    <Minus className="h-3 w-3" />
                                  </Button>
                                  <span className="w-6 text-center text-sm">
                                    {busy ? (
                                      <Loader2 className="mx-auto h-3 w-3 animate-spin" />
                                    ) : (
                                      it.quantity
                                    )}
                                  </span>
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    className="h-7 w-7"
                                    disabled={!!busyLine || it.quantity >= 99}
                                    onClick={() => void changeQty(it, it.quantity + 1)}
                                    aria-label="Increase quantity"
                                  >
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 text-destructive"
                                    disabled={!!busyLine}
                                    onClick={() => setRemoving(it)}
                                    aria-label="Remove item"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}
              </div>

              <div className="border-t bg-muted/20 p-5 text-sm">
                <div className="flex justify-between py-0.5 text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{money(order.subtotal)}</span>
                </div>
                {order.discount_amount > 0 && (
                  <div className="flex justify-between py-0.5 text-primary">
                    <span>Discount</span>
                    <span>− {money(order.discount_amount)}</span>
                  </div>
                )}
                <div className="mt-1 flex items-center justify-between border-t pt-2 text-base font-bold">
                  <span>Total</span>
                  <span className="text-xl text-primary">{money(order.total)}</span>
                </div>
                {canEdit ? (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      className="rounded-xl"
                      onClick={() => setPicking(true)}
                      disabled={!!busyLine}
                    >
                      <Plus className="mr-2 h-4 w-4" /> Add items
                    </Button>
                    <Button
                      className="rounded-xl"
                      onClick={() => setSettling(true)}
                      disabled={!!busyLine}
                    >
                      <Wallet className="mr-2 h-4 w-4" /> Receive payment
                    </Button>
                  </div>
                ) : (
                  <div className="mt-3 text-center text-[11px] text-muted-foreground">
                    View only. You don't have permission to change orders or take payment.
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removing} onOpenChange={(v) => !v && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove {removing?.quantity} × {removing ? itemLabel(removing) : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>The order total will be updated.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void confirmRemove()}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {canEdit && (
        <MenuPicker open={!!order && picking} onClose={() => setPicking(false)} onAdd={addItems} />
      )}
      {canEdit && (
        <SettleDialog
          order={settling ? order : null}
          settlingRef={settlingRef}
          onClose={() => setSettling(false)}
          onSettled={(r) => {
            setSettling(false);
            onSettled(r);
          }}
          hooks={hooks}
        />
      )}
    </>
  );
}

function LineText({ item }: { item: CounterOrderItem }) {
  return (
    <span className="min-w-0 break-words">
      <span className="mr-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded bg-muted px-1 text-xs font-bold text-muted-foreground">
        {item.quantity}
      </span>
      {itemLabel(item)}
      {item.addons.length > 0 && (
        <span className="block pl-7 text-[11px] text-muted-foreground">
          + {item.addons.map((a) => a.name).join(", ")}
        </span>
      )}
      <span className="block pl-7 text-[11px] text-muted-foreground">
        {money(item.unit_price)} each
      </span>
    </span>
  );
}

type PickLine = {
  key: string;
  item: PosMenuItem;
  variant: string;
  addons: { name: string }[];
  qty: number;
  /** Business the item was picked from (restaurant / bakery). */
  businessName: string;
};

const MENU_BUSINESS_TYPES = new Set(["restaurant", "bakery"]);

/** POS menu picker (restaurant + bakery) that collects extra lines for a counter order. */
function MenuPicker({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (lines: CounterOrderItemsPayload["items"]) => Promise<boolean>;
}) {
  const current = useAuth((s) => s.business);
  const scope = useBusinessScope();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [bizId, setBizId] = useState<string>("");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [cat, setCat] = useState("all");
  const [menu, setMenu] = useState<PosMenuData | null>(null);
  const [items, setItems] = useState<PosMenuItem[]>([]);
  const [menuPage, setMenuPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [lines, setLines] = useState<PickLine[]>([]);
  const [choosing, setChoosing] = useState<PosMenuItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Reset and load businesses each time the picker opens.
  useEffect(() => {
    if (!open) return;
    setLines([]);
    setQ("");
    setDebouncedQ("");
    setCat("all");
    let cancelled = false;
    withAuthRetry((t) => listBusinesses(t))
      .then((list) => {
        if (cancelled) return;
        // One-business manager: only their own business's menu (others answer 403).
        const usable = list.filter((b) => MENU_BUSINESS_TYPES.has(b.type) && scope.allows(b.type));
        setBusinesses(usable);
        setBizId((prev) =>
          usable.some((b) => b.public_id === prev)
            ? prev
            : ((usable.find((b) => b.public_id === current?.publicId) ?? usable[0])?.public_id ??
              ""),
        );
      })
      .catch((err) => {
        if (cancelled) return;
        // Fall back to the selected business only (if it has a menu this user may use).
        if (current && MENU_BUSINESS_TYPES.has(current.type) && scope.allows(current.type)) {
          setBizId(current.publicId);
        }
        toast.error(errMessage(err, "Unable to load businesses."));
      });
    return () => {
      cancelled = true;
    };
  }, [open, current, scope]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setCat("all");
  }, [bizId]);

  const fetchMenu = useCallback(
    (pageNum: number, signal: AbortSignal) =>
      withAuthRetry((t) =>
        getPosMenu(
          t,
          {
            business_public_id: bizId,
            page: pageNum,
            page_size: MENU_PAGE_SIZE,
            q: debouncedQ || undefined,
            category_public_id: cat === "all" ? undefined : cat,
          },
          signal,
        ),
      ),
    [bizId, debouncedQ, cat],
  );

  useEffect(() => {
    if (!open || !bizId) return;
    const ctrl = new AbortController();
    setLoading(true);
    setLoadError("");
    fetchMenu(1, ctrl.signal)
      .then((d) => {
        if (ctrl.signal.aborted) return;
        setMenu(d);
        setItems(d.results);
        setMenuPage(d.page);
      })
      .catch((err) => {
        if (!isAbort(err, ctrl.signal)) setLoadError(errMessage(err, "Unable to load the menu."));
      })
      .finally(() => !ctrl.signal.aborted && setLoading(false));
    return () => ctrl.abort();
  }, [open, bizId, fetchMenu]);

  const loadMoreRef = useRef<AbortController | null>(null);
  async function loadMore() {
    if (loading || loadMoreRef.current) return;
    const ctrl = new AbortController();
    loadMoreRef.current = ctrl;
    try {
      const d = await fetchMenu(menuPage + 1, ctrl.signal);
      setItems((prev) => {
        const seen = new Set(prev.map((i) => i.public_id));
        return [...prev, ...d.results.filter((i) => !seen.has(i.public_id))];
      });
      setMenuPage(d.page);
    } catch (err) {
      if (!isAbort(err, ctrl.signal)) toast.error(errMessage(err, "Unable to load more items."));
    } finally {
      loadMoreRef.current = null;
    }
  }

  const hasMore = !!menu && menuPage * MENU_PAGE_SIZE < menu.count;
  const bizName = useMemo(
    () => new Map(businesses.map((b) => [b.public_id, b.name])),
    [businesses],
  );

  function addLine(item: PosMenuItem, variant: string, addons: { name: string }[]) {
    const key = [item.public_id, variant, ...addons.map((a) => a.name).sort()].join("|");
    setLines((prev) => {
      if (prev.some((l) => l.key === key)) {
        return prev.map((l) => (l.key === key ? { ...l, qty: Math.min(99, l.qty + 1) } : l));
      }
      if (prev.length >= MAX_ADD_LINES) {
        toast.error(`Up to ${MAX_ADD_LINES} lines at a time`);
        return prev;
      }
      return [
        ...prev,
        { key, item, variant, addons, qty: 1, businessName: bizName.get(bizId) ?? "" },
      ];
    });
  }

  function onPick(item: PosMenuItem) {
    if (item.variants.length > 0 || item.addon_groups.length > 0) setChoosing(item);
    else addLine(item, "", []);
  }

  async function submit() {
    if (lines.length === 0 || submitting) return;
    setSubmitting(true);
    const ok = await onAdd(
      lines.map((l) => ({
        menu_item_public_id: l.item.public_id,
        quantity: l.qty,
        variant_name: l.variant,
        addons: l.addons.map((a) => ({ name: a.name })),
      })),
    );
    setSubmitting(false);
    if (ok) onClose();
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && !submitting && onClose()}>
        <DialogContent className="flex max-h-[90vh] flex-col gap-3 sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Add items</DialogTitle>
          </DialogHeader>

          {businesses.length > 1 && (
            <div className="flex gap-1.5">
              {businesses.map((b) => (
                <button
                  key={b.public_id}
                  onClick={() => setBizId(b.public_id)}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                    bizId === b.public_id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:bg-muted",
                  )}
                >
                  {b.name}
                </button>
              ))}
            </div>
          )}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search item…"
              maxLength={64}
              className="rounded-xl pl-9"
            />
          </div>
          {menu && menu.categories.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {[{ public_id: "all", name: "All" }, ...menu.categories].map((c) => (
                <button
                  key={c.public_id}
                  onClick={() => setCat(c.public_id)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    cat === c.public_id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:bg-muted",
                  )}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}

          <div className="min-h-40 flex-1 overflow-y-auto">
            {loadError ? (
              <div className="grid place-items-center p-8 text-sm text-destructive">
                {loadError}
              </div>
            ) : loading && items.length === 0 ? (
              <div className="grid place-items-center p-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : items.length === 0 ? (
              <div className="grid place-items-center p-8 text-sm text-muted-foreground">
                No items found.
              </div>
            ) : (
              <>
                <div
                  className={cn(
                    "grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4",
                    loading && "opacity-60",
                  )}
                >
                  {items.map((m) => (
                    <button
                      key={m.public_id}
                      onClick={() => onPick(m)}
                      className="flex flex-col rounded-xl border p-2.5 text-left transition-all hover:border-primary/50 hover:shadow-sm"
                    >
                      <span className="text-[10px] text-muted-foreground">
                        {m.item_code ? `#${m.item_code}` : ""}
                      </span>
                      <span className="line-clamp-2 text-sm font-medium">{m.name}</span>
                      <span className="mt-1 text-sm font-bold text-primary">
                        {m.variants.length > 0
                          ? `from ${money(Math.min(...m.variants.map((v) => v.price)))}`
                          : money(m.price)}
                      </span>
                    </button>
                  ))}
                </div>
                {hasMore && (
                  <div className="grid place-items-center py-3">
                    <Button variant="outline" size="sm" onClick={() => void loadMore()}>
                      Load more ({items.length} of {menu?.count})
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="border-t pt-3">
            {lines.length === 0 ? (
              <div className="text-center text-xs text-muted-foreground">
                Tap items to add them to this order.
              </div>
            ) : (
              <div className="max-h-40 space-y-1.5 overflow-y-auto">
                {lines.map((l) => (
                  <div
                    key={l.key}
                    className="flex items-center justify-between gap-2 rounded-lg border p-2 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium">
                        {l.item.name}
                        {l.variant && ` (${l.variant})`}
                      </div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {l.businessName}
                        {l.addons.length > 0 &&
                          `${l.businessName ? " · " : ""}+ ${l.addons.map((a) => a.name).join(", ")}`}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7"
                        onClick={() =>
                          setLines((p) =>
                            p.map((x) =>
                              x.key === l.key ? { ...x, qty: Math.max(1, x.qty - 1) } : x,
                            ),
                          )
                        }
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-6 text-center">{l.qty}</span>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7"
                        onClick={() =>
                          setLines((p) =>
                            p.map((x) =>
                              x.key === l.key ? { ...x, qty: Math.min(99, x.qty + 1) } : x,
                            ),
                          )
                        }
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={() => setLines((p) => p.filter((x) => x.key !== l.key))}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Button
              className="mt-3 w-full rounded-xl"
              disabled={lines.length === 0 || submitting}
              onClick={() => void submit()}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add {lines.length > 0
                ? `${lines.length} line${lines.length === 1 ? "" : "s"}`
                : ""}{" "}
              to order
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <OptionsDialog
        item={choosing}
        onClose={() => setChoosing(null)}
        onConfirm={(item, variant, addons) => {
          addLine(
            item,
            variant,
            addons.map((a) => ({ name: a.name })),
          );
          setChoosing(null);
        }}
      />
    </>
  );
}

function SettleDialog({
  order,
  settlingRef,
  onClose,
  onSettled,
  hooks,
}: {
  order: CounterOrder | null;
  settlingRef: React.MutableRefObject<boolean>;
  onClose: () => void;
  onSettled: (result: CounterOrderSettled) => void;
  hooks: ErrorHooks;
}) {
  const [method, setMethod] = useState<PosPaymentMethod | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setMethod(null);
  }, [order?.public_id]);

  async function confirm() {
    if (!order || !method || settlingRef.current) return;
    settlingRef.current = true;
    setSubmitting(true);
    try {
      const result = await withAuthRetry((t) => settleCounterOrder(t, order.public_id, method));
      onSettled(result);
    } catch (err) {
      handleCounterError(err, hooks, "Unable to record the payment.");
    } finally {
      settlingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={!!order} onOpenChange={(v) => !v && !submitting && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Receive payment</DialogTitle>
        </DialogHeader>
        {order && (
          <div className="space-y-4">
            <div className="flex items-end justify-between rounded-xl bg-primary/5 p-3">
              <div>
                <div className="text-lg font-bold">{tableLabel(order.table_number)}</div>
                <div className="text-xs text-muted-foreground">
                  {order.item_count} item{order.item_count === 1 ? "" : "s"}
                  {order.customer?.name ? ` · ${order.customer.name}` : ""}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Final total
                </div>
                <div className="text-2xl font-bold text-primary">{money(order.total)}</div>
              </div>
            </div>
            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase text-muted-foreground">
                Payment method
              </div>
              <div className="grid grid-cols-3 gap-2">
                {METHODS.map(({ m, label, icon: Icon }) => (
                  <button
                    key={m}
                    onClick={() => setMethod(m)}
                    disabled={submitting}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-lg border p-3 text-xs transition-colors",
                      method === m
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-muted",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <Button
              className="w-full rounded-xl"
              disabled={!method || submitting}
              onClick={() => void confirm()}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {method
                ? `Confirm ${money(order.total)} received by ${paymentLabel(method)}`
                : "Choose a payment method"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

const esc = (v: string) =>
  v.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

function taxSplit(r: CounterOrderSettled, gst: InvoiceDetail[]) {
  const complete = gst.length > 0 && gst.length === r.invoices.length;
  return {
    complete,
    cgst: gst.reduce((s, g) => s + (g.cgst_amount ?? 0), 0),
    sgst: gst.reduce((s, g) => s + (g.sgst_amount ?? 0), 0),
    tax: r.invoices.reduce((s, i) => s + (i.total_tax ?? 0), 0),
  };
}

function sellerNames(r: CounterOrderSettled) {
  return [...new Set(r.invoices.map((i) => i.seller_name))].join(" · ");
}

function printCounterReceipt(r: CounterOrderSettled, gst: InvoiceDetail[]) {
  const row = (a: string, b: string, bold = false) =>
    `<div class="r${bold ? " b" : ""}"><span>${a}</span><span>${b}</span></div>`;
  const lines = r.items
    .map(
      (it) =>
        row(`${it.quantity}× ${esc(itemLabel(it))}`, money(it.line_total)) +
        (it.addons.length
          ? `<div class="s">+ ${esc(it.addons.map((a) => a.name).join(", "))}</div>`
          : ""),
    )
    .join("");
  const invoices = r.invoices
    .map((i) => `<div>Invoice: <b>${esc(i.invoice_number)}</b></div>`)
    .join("");
  const t = taxSplit(r, gst);
  const taxRows = t.complete
    ? row("CGST", money(t.cgst)) + row("SGST", money(t.sgst))
    : row("GST", money(t.tax));
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(r.invoices[0]?.invoice_number ?? "Receipt")}</title>
<style>body{font:12px monospace;width:72mm;margin:0 auto;padding:4mm}.r{display:flex;justify-content:space-between;gap:8px}.b{font-weight:bold}.c{text-align:center}.s{font-size:10px;color:#555}hr{border:0;border-top:1px dashed #000;margin:6px 0}</style></head><body>
<div class="c b" style="font-size:14px">${esc(sellerNames(r) || "Receipt")}</div><hr>
${invoices}
<div>${esc(formatInvoiceDateTime(r.paid_at))}</div>
<div>${esc(tableLabel(r.table_number))} · Dine-in · ${esc(paymentLabel(r.payment_method))}</div><hr>
${lines}<hr>
${row("Subtotal", money(r.subtotal))}
${r.discount_amount > 0 ? row("Discount", `− ${money(r.discount_amount)}`) : ""}
${row("TOTAL", money(r.total), true)}
<div class="s">Included in total:</div>
${taxRows}<hr>
<div class="c">Thank you!</div></body></html>`;
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) {
    frame.remove();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  window.setTimeout(() => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
  }, 200);
  window.setTimeout(() => frame.remove(), 120_000);
}

/** Bill view after settlement; loads each GST invoice (one per business) for tax + print. */
function CounterReceiptDialog({
  result,
  onClose,
}: {
  result: CounterOrderSettled | null;
  onClose: () => void;
}) {
  const [gst, setGst] = useState<InvoiceDetail[]>([]);
  const [gstLoading, setGstLoading] = useState(false);
  const [viewing, setViewing] = useState<InvoiceDetail | null>(null);

  useEffect(() => {
    setGst([]);
    setViewing(null);
    if (!result || result.invoices.length === 0) return;
    let cancelled = false;
    setGstLoading(true);
    Promise.all(result.invoices.map((i) => withAuthRetry((t) => getInvoice(t, i.public_id))))
      .then((list) => !cancelled && setGst(list))
      .catch((err) => !cancelled && toast.error(errMessage(err, "Unable to load the GST invoice.")))
      .finally(() => !cancelled && setGstLoading(false));
    return () => {
      cancelled = true;
    };
  }, [result]);

  const r = result;
  const t = r ? taxSplit(r, gst) : null;

  return (
    <>
      <Dialog open={!!r && !viewing} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Payment received</DialogTitle>
          </DialogHeader>
          {r && t && (
            <>
              <div className="rounded-xl border-2 border-dashed p-4 font-mono text-xs">
                <div className="text-center text-base font-bold uppercase">
                  {sellerNames(r) || "Receipt"}
                </div>
                <div className="my-2 border-t border-dashed" />
                {r.invoices.map((i) => (
                  <div key={i.public_id}>
                    Invoice: <b>{i.invoice_number}</b>
                  </div>
                ))}
                <div>{formatInvoiceDateTime(r.paid_at)}</div>
                <div>
                  {tableLabel(r.table_number)} · Dine-in · {paymentLabel(r.payment_method)}
                </div>
                <div className="my-2 border-t border-dashed" />
                {r.items.map((it) => (
                  <div key={it.public_id} className="mb-1">
                    <div className="flex justify-between gap-2">
                      <span>
                        {it.quantity}× {itemLabel(it)}
                      </span>
                      <span>{money(it.line_total)}</span>
                    </div>
                    {it.addons.length > 0 && (
                      <div className="text-[10px] text-muted-foreground">
                        + {it.addons.map((a) => a.name).join(", ")}
                      </div>
                    )}
                  </div>
                ))}
                <div className="my-2 border-t border-dashed" />
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{money(r.subtotal)}</span>
                </div>
                {r.discount_amount > 0 && (
                  <div className="flex justify-between">
                    <span>Discount</span>
                    <span>− {money(r.discount_amount)}</span>
                  </div>
                )}
                <div className="mt-1 flex justify-between font-bold">
                  <span>TOTAL</span>
                  <span>{money(r.total)}</span>
                </div>
                <div className="mt-2 text-[10px] text-muted-foreground">
                  <div>Included in total:</div>
                  {t.complete ? (
                    <>
                      <div className="flex justify-between">
                        <span>CGST</span>
                        <span>{money(t.cgst)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>SGST</span>
                        <span>{money(t.sgst)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between">
                      <span>GST</span>
                      <span>{money(t.tax)}</span>
                    </div>
                  )}
                </div>
                <div className="mt-2 text-center text-[10px] text-muted-foreground">Thank you!</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl"
                  onClick={() => printCounterReceipt(r, gst)}
                >
                  <Printer className="mr-2 h-4 w-4" /> Print
                </Button>
                {r.invoices.map((i) => {
                  const detail = gst.find((g) => g.public_id === i.public_id) ?? null;
                  return (
                    <Button
                      key={i.public_id}
                      variant="outline"
                      className="flex-1 rounded-xl"
                      disabled={!detail}
                      onClick={() => detail && setViewing(detail)}
                    >
                      {gstLoading && !detail ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <FileText className="mr-2 h-4 w-4" />
                      )}
                      {r.invoices.length > 1 ? i.seller_name : "GST Invoice"}
                    </Button>
                  );
                })}
                <Button className="w-full rounded-xl" onClick={onClose}>
                  Done
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewing} onOpenChange={(v) => !v && setViewing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{viewing?.invoice_number}</DialogTitle>
          </DialogHeader>
          {viewing && (
            <>
              <InvoiceDocument invoice={viewing} />
              <div className="flex gap-2">
                <Button variant="outline" className="rounded-xl" onClick={() => setViewing(null)}>
                  Back to receipt
                </Button>
                <Button className="rounded-xl" onClick={() => printInvoicePdf(viewing.public_id)}>
                  <Printer className="mr-2 h-4 w-4" /> Print GST invoice
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
