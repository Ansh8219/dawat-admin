import { useState } from "react";
import { toast } from "sonner";
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
import { Input } from "@/components/ui/input";
import {
  formatInvoiceMoney,
  INVOICE_QTY_MAX,
  invoiceEditErrorMessage,
  updateInvoice,
} from "@/lib/api/invoices";
import { ApiError } from "@/lib/api/types";
import type { InvoiceDetail, InvoiceLine } from "@/lib/api/types";
import { withAuthRetry } from "@/lib/api/with-auth";
import { cn } from "@/lib/utils";
import { Loader2, Minus, Plus, RotateCcw, Trash2 } from "lucide-react";

const clampQty = (n: number) => Math.min(INVOICE_QTY_MAX, Math.max(0, Math.round(n)));

/**
 * Edits item quantities of a cash invoice in place (super admin only). Amounts shown here are
 * an estimate (`unit_price × quantity`); the backend recalculates everything on save.
 */
export function InvoiceEditor({
  invoice,
  onSaved,
  onCancel,
  onUnauthorized,
  onEditingDisabled,
}: {
  invoice: InvoiceDetail;
  onSaved: (updated: InvoiceDetail) => void;
  onCancel: () => void;
  onUnauthorized: () => void;
  /** Editing was switched off globally while this form was open. */
  onEditingDisabled: () => void;
}) {
  // Keyed by position of the loaded invoice; reset by remounting after each save.
  const [qty, setQty] = useState<Record<number, number>>(() =>
    Object.fromEntries(invoice.lines.map((l) => [l.position, l.quantity])),
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const items = invoice.lines.filter((l) => l.line_type !== "delivery");
  const changes = items
    .filter((l) => qty[l.position] !== l.quantity)
    .map((l) => ({ position: l.position, quantity: qty[l.position] }));
  const allRemoved = items.every((l) => (qty[l.position] ?? 0) === 0);
  const canSave = changes.length > 0 && !allRemoved && !saving;

  const estimatedTotal = invoice.lines.reduce((sum, l) => sum + estimateLine(l, qty), 0);

  function setLineQty(position: number, value: number) {
    if (!Number.isFinite(value)) return;
    setError("");
    setQty((prev) => ({ ...prev, [position]: clampQty(value) }));
  }

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setError("");
    try {
      const updated = await withAuthRetry((token) =>
        updateInvoice(token, invoice.public_id, { lines: changes }),
      );
      setConfirmOpen(false);
      toast.success(`Invoice ${updated.invoice_number} updated.`);
      onSaved(updated);
    } catch (err) {
      setConfirmOpen(false);
      if (err instanceof ApiError && err.status === 401) {
        onUnauthorized();
        return;
      }
      if (err instanceof ApiError && err.code === "invoice_editing_disabled") {
        toast.error("Invoice editing was turned off");
        onEditingDisabled();
        return;
      }
      const message = invoiceEditErrorMessage(err);
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-[210mm] rounded-2xl border bg-background p-4 shadow-sm sm:p-6 print:hidden">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Edit invoice {invoice.invoice_number}</h2>
          <p className="text-sm text-muted-foreground">
            Change quantities or remove items. The invoice keeps its number and date.
          </p>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      <div className="mt-4 divide-y rounded-xl border">
        {invoice.lines.map((line) => {
          const isDelivery = line.line_type === "delivery";
          const current = qty[line.position] ?? line.quantity;
          const removed = !isDelivery && current === 0;
          const changed = !isDelivery && current !== line.quantity;
          return (
            <div
              key={line.position}
              className={cn(
                "flex flex-wrap items-center gap-3 px-3 py-3 sm:flex-nowrap",
                removed && "bg-destructive/5",
              )}
            >
              <div className="min-w-0 flex-1">
                <div className={cn("font-medium", removed && "text-muted-foreground line-through")}>
                  {line.description}
                </div>
                <div className="text-xs text-muted-foreground">
                  {isDelivery
                    ? "Delivery charge · not editable"
                    : `${formatInvoiceMoney(line.unit_price)} each · was ${line.quantity}`}
                </div>
              </div>

              {isDelivery ? (
                <div className="w-[168px] text-center text-sm tabular-nums text-muted-foreground">
                  {line.quantity}
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-8 w-8 rounded-lg"
                    aria-label={`Decrease ${line.description}`}
                    disabled={saving || current <= 0}
                    onClick={() => setLineQty(line.position, current - 1)}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={INVOICE_QTY_MAX}
                    step={1}
                    value={current}
                    disabled={saving}
                    aria-label={`Quantity of ${line.description}`}
                    className="h-8 w-16 text-center tabular-nums"
                    onChange={(e) =>
                      setLineQty(line.position, e.target.value === "" ? 0 : Number(e.target.value))
                    }
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-8 w-8 rounded-lg"
                    aria-label={`Increase ${line.description}`}
                    disabled={saving || current >= INVOICE_QTY_MAX}
                    onClick={() => setLineQty(line.position, current + 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  {removed ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-lg"
                      aria-label={`Restore ${line.description}`}
                      title="Restore"
                      disabled={saving}
                      onClick={() => setLineQty(line.position, line.quantity)}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-lg text-destructive hover:text-destructive"
                      aria-label={`Remove ${line.description}`}
                      title="Remove item"
                      disabled={saving}
                      onClick={() => setLineQty(line.position, 0)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}

              <div className="w-28 text-right tabular-nums">
                <div className={cn("text-sm font-medium", changed && "text-primary")}>
                  {formatInvoiceMoney(estimateLine(line, qty))}
                </div>
                {changed && (
                  <div className="text-xs text-muted-foreground line-through">
                    {formatInvoiceMoney(line.total_amount)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          <div>
            Current total{" "}
            <span className="font-semibold tabular-nums">
              {formatInvoiceMoney(invoice.total_amount)}
            </span>
            {changes.length > 0 && (
              <>
                {" → "}estimated{" "}
                <span className="font-semibold tabular-nums">
                  {formatInvoiceMoney(estimatedTotal)}
                </span>
              </>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {allRemoved
              ? "At least one item must remain on the invoice."
              : "Estimate only. GST, discounts and totals are recalculated when you save."}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" className="rounded-xl" disabled={saving} onClick={onCancel}>
            Cancel
          </Button>
          <Button
            className="gap-2 rounded-xl"
            disabled={!canSave}
            onClick={() => setConfirmOpen(true)}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={(o) => !saving && setConfirmOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update invoice {invoice.invoice_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              {changes.length} line{changes.length === 1 ? "" : "s"} will change. The invoice keeps
              its number and date, and this edit is recorded in its history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={saving}
              onClick={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              {saving ? "Updating…" : "Update invoice"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

/** Unchanged lines keep the backend amount; changed ones preview `unit_price × quantity`. */
function estimateLine(line: InvoiceLine, qty: Record<number, number>): number {
  const q = qty[line.position] ?? line.quantity;
  if (line.line_type === "delivery" || q === line.quantity) return line.total_amount;
  return line.unit_price * q;
}
