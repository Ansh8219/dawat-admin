import { useCallback, useEffect, useRef, useState } from "react";
import { InvoiceDocument } from "@/components/app/invoice-document";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatInvoiceDateTime, formatInvoiceMoney, getInvoice } from "@/lib/api/invoices";
import { paymentLabel, tableLabel } from "@/lib/api/orders";
import { listCounterOrders, settleCounterOrder } from "@/lib/api/pos";
import {
  ApiError,
  type CounterOrder,
  type CounterOrderListData,
  type CounterOrderSettled,
  type CounterOrderStatusFilter,
  type InvoiceDetail,
  type PosPaymentMethod,
} from "@/lib/api/types";
import { withAuthRetry } from "@/lib/api/with-auth";
import { useAccess } from "@/lib/access";
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
  Phone,
  Printer,
  RefreshCw,
  Smartphone,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

const money = formatInvoiceMoney;
const PAGE_SIZE = 20;

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

function itemLabel(it: CounterOrder["items"][number]) {
  return `${it.name}${it.variant_name ? ` (${it.variant_name})` : ""}`;
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
  const { canManage } = useAccess();
  const canSettle = canManage("pos");
  const tick = useCounterPaymentAlerts((s) => s.tick);
  const paidIds = useCounterPaymentAlerts((s) => s.paidIds);
  const markPaid = useCounterPaymentAlerts((s) => s.markPaid);
  const clearPendingAlerts = useCounterPaymentAlerts((s) => s.clearPendingAlerts);

  const [page, setPage] = useState(1);
  const [data, setData] = useState<CounterOrderListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [settling, setSettling] = useState<CounterOrder | null>(null);
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
        if (d.results.length === 0 && page > 1) setPage((p) => p - 1);
        else setData(d);
      })
      .catch((err) => {
        if (!isAbort(err, ctrl.signal)) setError(errMessage(err, "Unable to load orders."));
      })
      .finally(() => !ctrl.signal.aborted && setLoading(false));
    return () => ctrl.abort();
  }, [status, page, tick, reload]);

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

  function onSettled(result: CounterOrderSettled) {
    setSettling(null);
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
            ? "Handed-over orders waiting to pay at the counter, oldest first."
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
            <PendingCard
              key={o.public_id}
              order={o}
              now={now}
              canSettle={canSettle}
              onReceive={() => setSettling(o)}
            />
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

      <SettleDialog
        order={settling}
        onClose={() => setSettling(null)}
        onSettled={onSettled}
        onStale={() => {
          setSettling(null);
          refresh();
        }}
      />
      <CounterReceiptDialog result={receipt} onClose={() => setReceipt(null)} />
    </div>
  );
}

function PendingCard({
  order,
  now,
  canSettle,
  onReceive,
}: {
  order: CounterOrder;
  now: number;
  canSettle: boolean;
  onReceive: () => void;
}) {
  return (
    <div className="card-elevated flex flex-col overflow-hidden">
      <div className="flex items-start justify-between gap-2 border-b p-4">
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
      <div className="flex-1 space-y-1.5 p-4">
        {order.items.map((it, i) => (
          <div key={i} className="flex items-start justify-between gap-3 text-sm">
            <span className="min-w-0 break-words">
              <span className="mr-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded bg-muted px-1 text-xs font-bold text-muted-foreground">
                {it.quantity}
              </span>
              {itemLabel(it)}
              {it.addons.length > 0 && (
                <span className="block pl-7 text-[11px] text-muted-foreground">
                  + {it.addons.map((a) => a.name).join(", ")}
                </span>
              )}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">{money(it.line_total)}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 border-t bg-muted/20 p-4">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Total</div>
          <div className="text-xl font-bold text-primary">{money(order.total)}</div>
        </div>
        {canSettle ? (
          <Button className="rounded-xl" onClick={onReceive}>
            <Wallet className="mr-2 h-4 w-4" /> Receive payment
          </Button>
        ) : (
          <span className="text-[11px] text-muted-foreground">No permission to settle</span>
        )}
      </div>
    </div>
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

function SettleDialog({
  order,
  onClose,
  onSettled,
  onStale,
}: {
  order: CounterOrder | null;
  onClose: () => void;
  onSettled: (result: CounterOrderSettled) => void;
  /** Order is gone or already paid: close and refresh the list. */
  onStale: () => void;
}) {
  const [method, setMethod] = useState<PosPaymentMethod | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    setMethod(null);
  }, [order?.public_id]);

  async function confirm() {
    if (!order || !method || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const result = await withAuthRetry((t) => settleCounterOrder(t, order.public_id, method));
      onSettled(result);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "";
      const status = err instanceof ApiError ? err.status : 0;
      if (code === "order_already_paid") {
        toast.info("Already paid");
        onStale();
      } else if (code === "order_not_handed_over") {
        toast.error("Hand over the order first");
      } else if (code === "order_not_found" || status === 404) {
        toast.error("Order not found");
        onStale();
      } else if (status === 403) {
        toast.error("You don't have permission to record payments.");
      } else {
        toast.error(errMessage(err, "Unable to record the payment."));
      }
    } finally {
      submittingRef.current = false;
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
              <div className="text-2xl font-bold text-primary">{money(order.total)}</div>
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
                ? `Confirm ${money(order.total)} by ${paymentLabel(method)}`
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
  const sellers = [...new Set(r.invoices.map((i) => i.seller_name))].join(" · ");
  const invoices = r.invoices
    .map((i) => `<div>Invoice: <b>${esc(i.invoice_number)}</b></div>`)
    .join("");
  const cgst = gst.reduce((s, g) => s + (g.cgst_amount ?? 0), 0);
  const sgst = gst.reduce((s, g) => s + (g.sgst_amount ?? 0), 0);
  const tax = r.invoices.reduce((s, i) => s + (i.total_tax ?? 0), 0);
  const taxRows =
    gst.length === r.invoices.length && gst.length > 0
      ? row("CGST", money(cgst)) + row("SGST", money(sgst))
      : row("GST", money(tax));
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(r.invoices[0]?.invoice_number ?? "Receipt")}</title>
<style>body{font:12px monospace;width:72mm;margin:0 auto;padding:4mm}.r{display:flex;justify-content:space-between;gap:8px}.b{font-weight:bold}.c{text-align:center}.s{font-size:10px;color:#555}hr{border:0;border-top:1px dashed #000;margin:6px 0}</style></head><body>
<div class="c b" style="font-size:14px">${esc(sellers || "Receipt")}</div><hr>
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
  const cgst = gst.reduce((s, g) => s + (g.cgst_amount ?? 0), 0);
  const sgst = gst.reduce((s, g) => s + (g.sgst_amount ?? 0), 0);
  const tax = r?.invoices.reduce((s, i) => s + (i.total_tax ?? 0), 0) ?? 0;
  const haveSplit = !!r && gst.length === r.invoices.length && gst.length > 0;

  return (
    <>
      <Dialog open={!!r && !viewing} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Payment received</DialogTitle>
          </DialogHeader>
          {r && (
            <>
              <div className="rounded-xl border-2 border-dashed p-4 font-mono text-xs">
                <div className="text-center text-base font-bold uppercase">
                  {[...new Set(r.invoices.map((i) => i.seller_name))].join(" · ") || "Receipt"}
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
                {r.items.map((it, i) => (
                  <div key={i} className="mb-1">
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
                  {haveSplit ? (
                    <>
                      <div className="flex justify-between">
                        <span>CGST</span>
                        <span>{money(cgst)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>SGST</span>
                        <span>{money(sgst)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between">
                      <span>GST</span>
                      <span>{money(tax)}</span>
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
