import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  diffInvoiceLines,
  formatInvoiceDateTime,
  formatInvoiceMoney,
  invoiceAmountsDiffer,
  invoiceEditErrorMessage,
  lineTax,
  listInvoiceEdits,
} from "@/lib/api/invoices";
import type { InvoiceEditEntry, InvoiceLine } from "@/lib/api/types";
import { withAuthRetry } from "@/lib/api/with-auth";
import { cn } from "@/lib/utils";
import { ArrowRight, ChevronDown } from "lucide-react";

/** Edit history of an invoice (super admin only), newest first. */
export function InvoiceEditHistory({
  invoicePublicId,
  invoiceNumber,
  open,
  onOpenChange,
  refreshKey,
}: {
  invoicePublicId: string;
  invoiceNumber: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Changes after each save so an open sheet reloads. */
  refreshKey?: string | null;
}) {
  const [entries, setEntries] = useState<InvoiceEditEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(
    async (signal?: { cancelled: boolean }) => {
      setLoading(true);
      setError("");
      try {
        const data = await withAuthRetry((token) => listInvoiceEdits(token, invoicePublicId));
        if (!signal?.cancelled) setEntries(data.results ?? []);
      } catch (err) {
        if (!signal?.cancelled) setError(invoiceEditErrorMessage(err, "Unable to load history."));
      } finally {
        if (!signal?.cancelled) setLoading(false);
      }
    },
    [invoicePublicId],
  );

  useEffect(() => {
    if (!open) return;
    const signal = { cancelled: false };
    void load(signal);
    return () => {
      signal.cancelled = true;
    };
  }, [open, load, refreshKey]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl print:hidden">
        <SheetHeader>
          <SheetTitle>Edit history</SheetTitle>
          <SheetDescription>Invoice {invoiceNumber} · newest first</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-3">
          {loading && !entries ? (
            <>
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </>
          ) : error ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
              <Button variant="outline" className="rounded-xl" onClick={() => void load()}>
                Try again
              </Button>
            </div>
          ) : !entries?.length ? (
            <p className="text-sm text-muted-foreground">This invoice has not been edited.</p>
          ) : (
            entries.map((entry, i) => (
              <HistoryEntry key={`${entry.edited_at}-${i}`} entry={entry} defaultOpen={i === 0} />
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function HistoryEntry({ entry, defaultOpen }: { entry: InvoiceEditEntry; defaultOpen: boolean }) {
  const [expanded, setExpanded] = useState(defaultOpen);
  const { before, after } = entry;
  const diffs = diffInvoiceLines(before, after).filter((d) => d.kind !== "unchanged");

  return (
    <div className="rounded-xl border">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">
            {entry.edited_by?.email ?? "Unknown user"}
          </div>
          <div className="text-xs text-muted-foreground">
            {formatInvoiceDateTime(entry.edited_at)}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="flex items-center gap-1 text-sm tabular-nums">
            <span className="text-muted-foreground">{formatInvoiceMoney(before.total_amount)}</span>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-semibold">{formatInvoiceMoney(after.total_amount)}</span>
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              expanded && "rotate-180",
            )}
          />
        </div>
      </button>

      {expanded && (
        <div className="space-y-3 border-t px-4 py-3 text-sm">
          {diffs.length === 0 ? (
            <p className="text-muted-foreground">No line changes recorded.</p>
          ) : (
            <ul className="space-y-2">
              {diffs.map((d, i) => (
                <li key={i} className="rounded-lg bg-muted/40 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{(d.before ?? d.after).description}</span>
                    {d.kind === "removed" ? (
                      <Badge variant="destructive">Removed</Badge>
                    ) : d.kind === "added" ? (
                      <Badge variant="secondary">Added</Badge>
                    ) : d.before.quantity !== d.after.quantity ? (
                      <Badge variant="outline" className="tabular-nums">
                        Qty {d.before.quantity} → {d.after.quantity}
                      </Badge>
                    ) : null}
                  </div>
                  <LineAmounts before={d.before} after={d.after} />
                </li>
              ))}
            </ul>
          )}

          <dl className="space-y-1 border-t pt-3">
            <SummaryRow
              label="Discount"
              before={before.discount_amount}
              after={after.discount_amount}
            />
            <SummaryRow label="Total tax" before={before.total_tax} after={after.total_tax} />
            <SummaryRow
              label="Invoice total"
              before={before.total_amount}
              after={after.total_amount}
              strong
            />
          </dl>
        </div>
      )}
    </div>
  );
}

/** Discount, tax and total of one line; only the amounts that changed. */
function LineAmounts({ before, after }: { before: InvoiceLine | null; after: InvoiceLine | null }) {
  const rows: { label: string; b: number; a: number }[] = [
    { label: "Discount", b: before?.discount_amount ?? 0, a: after?.discount_amount ?? 0 },
    { label: "Tax", b: before ? lineTax(before) : 0, a: after ? lineTax(after) : 0 },
    { label: "Total", b: before?.total_amount ?? 0, a: after?.total_amount ?? 0 },
  ].filter((r) => invoiceAmountsDiffer(r.b, r.a));
  if (!rows.length) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground tabular-nums">
      {rows.map((r) => (
        <span key={r.label}>
          {r.label} {formatInvoiceMoney(r.b)} → {formatInvoiceMoney(r.a)}
        </span>
      ))}
    </div>
  );
}

function SummaryRow({
  label,
  before,
  after,
  strong = false,
}: {
  label: string;
  before: number;
  after: number;
  strong?: boolean;
}) {
  const changed = invoiceAmountsDiffer(before, after);
  return (
    <div className={cn("flex items-center justify-between gap-4", strong && "font-semibold")}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">
        {changed ? (
          <>
            <span className="text-muted-foreground line-through">{formatInvoiceMoney(before)}</span>{" "}
            {formatInvoiceMoney(after)}
          </>
        ) : (
          formatInvoiceMoney(after)
        )}
      </dd>
    </div>
  );
}
