import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiFieldErrors } from "@/lib/api/client";
import {
  adjustCustomerCoins,
  COIN_ADJUST_MAX,
  COIN_NOTE_MAX,
  coinEntryLabel,
  getCustomerCoins,
} from "@/lib/api/customers";
import { ApiError } from "@/lib/api/types";
import type { CoinDirection, CustomerCoinsData } from "@/lib/api/types";
import { withAuthRetry } from "@/lib/api/with-auth";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Copy, Loader2, Minus, Plus } from "lucide-react";
import { toast } from "sonner";

const PAGE_SIZE = 20;
const INSUFFICIENT_COINS_MESSAGE = "Customer does not have enough coins for this deduction.";
const NOT_FOUND_MESSAGE = "Customer not found.";

type AdjustField = "direction" | "coins" | "note";
type AdjustErrors = Partial<Record<AdjustField, string>>;
type AdjustForm = { direction: CoinDirection; coins: string; note: string };

const EMPTY_ADJUST: AdjustForm = { direction: "credit", coins: "", note: "" };

function formatCoins(n: number): string {
  return n.toLocaleString("en-IN");
}

function formatEntryDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function validateAdjust(form: AdjustForm): AdjustErrors {
  const errors: AdjustErrors = {};
  const raw = form.coins.trim();
  const coins = Number(raw);
  if (!raw) errors.coins = "Coins are required.";
  else if (!/^\d+$/.test(raw) || coins < 1 || coins > COIN_ADJUST_MAX)
    errors.coins = `Enter a whole number from 1 to ${formatCoins(COIN_ADJUST_MAX)}.`;
  const note = form.note.trim();
  if (!note) errors.note = "A reason is required.";
  else if (note.length > COIN_NOTE_MAX)
    errors.note = `Reason must be at most ${COIN_NOTE_MAX} characters.`;
  return errors;
}

export function CustomerCoinsPanel({
  customerId,
  customerName,
  onAuthError,
  onAdjusted,
}: {
  customerId: string;
  customerName: string;
  /** Returns true when the error was a 401 that has been handled. */
  onAuthError: (err: unknown) => boolean;
  /** Called after a successful adjustment (level and counts may have changed). */
  onAdjusted?: () => void;
}) {
  const [data, setData] = useState<CustomerCoinsData | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const requestRef = useRef(0);
  const skipNextLoad = useRef(false);

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [form, setForm] = useState<AdjustForm>(EMPTY_ADJUST);
  const [fieldErrors, setFieldErrors] = useState<AdjustErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(
    async (nextPage: number) => {
      const requestId = ++requestRef.current;
      setLoading(true);
      setLoadError("");
      try {
        const res = await withAuthRetry((token) =>
          getCustomerCoins(token, customerId, { page: nextPage, page_size: PAGE_SIZE }),
        );
        if (requestId !== requestRef.current) return;
        setData(res);
      } catch (err) {
        if (requestId !== requestRef.current) return;
        if (onAuthError(err)) return;
        if (err instanceof ApiError && err.code === "customer_not_found") {
          setLoadError(NOT_FOUND_MESSAGE);
          return;
        }
        setLoadError(err instanceof ApiError ? err.message : "Unable to load coins.");
      } finally {
        if (requestId === requestRef.current) setLoading(false);
      }
    },
    [customerId, onAuthError],
  );

  useEffect(() => {
    if (skipNextLoad.current) {
      skipNextLoad.current = false;
      return;
    }
    void load(page);
  }, [load, page]);

  function openAdjust() {
    setForm(EMPTY_ADJUST);
    setFieldErrors({});
    setConfirming(false);
    setAdjustOpen(true);
  }

  function setField<K extends AdjustField>(key: K, value: AdjustForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function reviewAdjust() {
    const errors = validateAdjust(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setConfirming(true);
  }

  async function submitAdjust() {
    setSubmitting(true);
    try {
      const res = await withAuthRetry((token) =>
        adjustCustomerCoins(token, customerId, {
          direction: form.direction,
          coins: Number(form.coins.trim()),
          note: form.note.trim(),
        }),
      );
      requestRef.current++;
      setData(res);
      const nextPage = res.history?.page ?? 1;
      if (nextPage !== page) skipNextLoad.current = true;
      setPage(nextPage);
      setLoading(false);
      setLoadError("");
      setAdjustOpen(false);
      toast.success(
        form.direction === "credit"
          ? `${formatCoins(Number(form.coins))} coins added`
          : `${formatCoins(Number(form.coins))} coins deducted`,
      );
      onAdjusted?.();
    } catch (err) {
      if (onAuthError(err)) return;
      setConfirming(false);
      if (err instanceof ApiError) {
        if (err.code === "insufficient_coins") {
          setFieldErrors({ coins: INSUFFICIENT_COINS_MESSAGE });
          return;
        }
        if (err.code === "customer_not_found") {
          toast.error(NOT_FOUND_MESSAGE);
          setAdjustOpen(false);
          return;
        }
        const inline: AdjustErrors = {};
        let hasOther = false;
        for (const [field, message] of Object.entries(apiFieldErrors(err))) {
          if (field in form) inline[field as AdjustField] = message;
          else hasOther = true;
        }
        if (Object.keys(inline).length > 0) setFieldErrors(inline);
        if (hasOther || Object.keys(inline).length === 0) toast.error(err.message);
        return;
      }
      toast.error("Unable to adjust coins.");
    } finally {
      setSubmitting(false);
    }
  }

  const history = data?.history;
  const count = history?.count ?? 0;
  const pageSize = history?.page_size || PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  const results = history?.results ?? [];
  const isDebit = form.direction === "debit";

  return (
    <div className="space-y-4">
      {loadError && !data ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {loadError}
          </div>
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={() => void load(page)}
          >
            Try again
          </Button>
        </div>
      ) : !data ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading coins…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <SummaryCard label="Coin balance" value={formatCoins(data.coin_balance)} />
            <SummaryCard label="Lifetime coins" value={formatCoins(data.lifetime_coins)} />
            <SummaryCard label="Current level" value={data.tier?.name ?? "—"} />
            <SummaryCard
              label="Next level"
              value={
                data.next_tier
                  ? `${formatCoins(data.next_tier.coins_needed)} coins to ${data.next_tier.name}`
                  : "Top level"
              }
              small
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase text-muted-foreground">
              Coin history
            </div>
            <Button type="button" size="sm" className="h-8 rounded-xl" onClick={openAdjust}>
              Adjust coins
            </Button>
          </div>

          {loadError ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {loadError}
            </div>
          ) : null}

          <div className="relative overflow-hidden rounded-xl border">
            {loading ? (
              <div className="absolute inset-0 z-10 grid place-items-center bg-background/60">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              </div>
            ) : null}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[460px] text-xs">
                <thead className="bg-muted/30 uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Date</th>
                    <th className="px-3 py-2 text-left font-medium">Type</th>
                    <th className="px-3 py-2 text-right font-medium">Coins</th>
                    <th className="px-3 py-2 text-left font-medium">Order</th>
                    <th className="px-3 py-2 text-left font-medium">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {results.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                        No coin activity yet.
                      </td>
                    </tr>
                  ) : (
                    results.map((entry) => {
                      const credit = entry.direction === "credit";
                      return (
                        <tr key={entry.public_id} className="border-t align-top">
                          <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                            {formatEntryDate(entry.created_at)}
                          </td>
                          <td className="px-3 py-2">{coinEntryLabel(entry.entry_type)}</td>
                          <td
                            className={cn(
                              "whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums",
                              credit
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-destructive",
                            )}
                          >
                            {credit ? "+" : "−"}
                            {formatCoins(entry.coins)}
                          </td>
                          <td className="px-3 py-2">
                            {entry.order_public_id ? (
                              <OrderIdChip id={entry.order_public_id} />
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="max-w-[160px] break-words px-3 py-2 text-muted-foreground">
                            {entry.note || "—"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {count > pageSize ? (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Page {Math.min(page, totalPages)} / {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-xl"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" /> Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-xl"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}

      <Dialog
        open={adjustOpen}
        onOpenChange={(open) => {
          if (!open && !submitting) setAdjustOpen(false);
        }}
      >
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{confirming ? "Confirm adjustment" : "Adjust coins"}</DialogTitle>
            <DialogDescription>{customerName}</DialogDescription>
          </DialogHeader>

          {confirming ? (
            <div className="space-y-4">
              <p className="text-sm">
                {isDebit ? "Deduct" : "Add"}{" "}
                <b className={isDebit ? "text-destructive" : "text-emerald-600"}>
                  {formatCoins(Number(form.coins))} coins
                </b>{" "}
                {isDebit ? "from" : "to"} {customerName}?
              </p>
              <div className="rounded-xl border bg-muted/30 p-3 text-xs">
                <div className="font-semibold uppercase text-muted-foreground">Reason</div>
                <div className="mt-1 break-words">{form.note.trim()}</div>
              </div>
              {isDebit ? (
                <p className="text-xs text-muted-foreground">
                  This also reduces lifetime coins and can move the customer to a lower level.
                </p>
              ) : null}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 rounded-xl"
                  disabled={submitting}
                  onClick={() => setConfirming(false)}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  variant={isDebit ? "destructive" : "default"}
                  className="flex-1 rounded-xl"
                  disabled={submitting}
                  onClick={() => void submitAdjust()}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
                    </>
                  ) : isDebit ? (
                    "Deduct coins"
                  ) : (
                    "Add coins"
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <form
              className="space-y-4"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                reviewAdjust();
              }}
            >
              <div className="grid grid-cols-2 gap-2">
                <DirectionButton
                  active={!isDebit}
                  onClick={() => setField("direction", "credit")}
                  icon={<Plus className="h-4 w-4" />}
                  label="Add"
                />
                <DirectionButton
                  active={isDebit}
                  onClick={() => setField("direction", "debit")}
                  icon={<Minus className="h-4 w-4" />}
                  label="Deduct"
                  destructive
                />
              </div>
              {isDebit ? (
                <p className="text-[11px] text-muted-foreground">
                  Deducting reduces lifetime coins and can move the customer to a lower level.
                </p>
              ) : null}

              <div className="space-y-1.5">
                <Label htmlFor="coin-amount">Coins</Label>
                <Input
                  id="coin-amount"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={COIN_ADJUST_MAX}
                  step={1}
                  value={form.coins}
                  onChange={(e) => setField("coins", e.target.value)}
                  placeholder="50"
                  aria-invalid={!!fieldErrors.coins}
                  className={cn("rounded-xl", fieldErrors.coins && "border-destructive")}
                />
                {fieldErrors.coins ? (
                  <p className="text-[11px] font-medium text-destructive">{fieldErrors.coins}</p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="coin-note">Reason</Label>
                <Textarea
                  id="coin-note"
                  value={form.note}
                  maxLength={COIN_NOTE_MAX}
                  onChange={(e) => setField("note", e.target.value)}
                  placeholder="Correction"
                  aria-invalid={!!fieldErrors.note}
                  className={cn("min-h-20 rounded-xl", fieldErrors.note && "border-destructive")}
                />
                {fieldErrors.note ? (
                  <p className="text-[11px] font-medium text-destructive">{fieldErrors.note}</p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Visible to the customer in their history. {form.note.trim().length}/
                    {COIN_NOTE_MAX}
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 rounded-xl"
                  onClick={() => setAdjustOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1 rounded-xl">
                  Continue
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="rounded-xl border p-2.5">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 font-bold", small ? "text-xs" : "text-base tabular-nums")}>
        {value}
      </div>
    </div>
  );
}

function DirectionButton({
  active,
  onClick,
  icon,
  label,
  destructive,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors",
        active
          ? destructive
            ? "border-destructive bg-destructive/10 text-destructive"
            : "border-primary bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted/40",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function OrderIdChip({ id }: { id: string }) {
  return (
    <button
      type="button"
      title={`Copy order ID ${id}`}
      onClick={() => {
        if (!navigator.clipboard) {
          toast.error("Unable to copy");
          return;
        }
        navigator.clipboard
          .writeText(id)
          .then(() => toast.success("Order ID copied"))
          .catch(() => toast.error("Unable to copy"));
      }}
      className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] hover:bg-muted/70"
    >
      {id.slice(0, 8)}
      <Copy className="h-3 w-3 text-muted-foreground" />
    </button>
  );
}
