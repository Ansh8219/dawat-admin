import { useCallback, useEffect, useState } from "react";
import { Loader2, Phone } from "lucide-react";
import { toast } from "sonner";
import { HallRefundBadge, HallStatusBadge } from "@/components/app/hall-booking-badges";
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
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { apiFieldErrors } from "@/lib/api/client";
import {
  approveHallBooking,
  completeHallBooking,
  formatDay,
  formatInr,
  formatTimestamp,
  getHallBooking,
  isForbidden,
  noShowHallBooking,
  rejectHallBooking,
  retryHallRefund,
  saveHallBookingNote,
  type HallBookingRow,
} from "@/lib/api/hall-bookings";
import { ApiError } from "@/lib/api/types";
import { withAuthRetry } from "@/lib/api/with-auth";
import { useAccess } from "@/lib/access";

type Confirm = "complete" | "no_show" | "reject" | null;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}

export function HallBookingDrawer({
  bookingId,
  onClose,
  onUpdated,
}: {
  bookingId: string | null;
  onClose: () => void;
  /** Called with the latest booking after load or any action so the list row can refresh. */
  onUpdated: (b: HallBookingRow) => void;
}) {
  const canManage = useAccess().canManage("halls");
  const [booking, setBooking] = useState<HallBookingRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [noAccess, setNoAccess] = useState(false);
  const [actionsForbidden, setActionsForbidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState("");
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");

  const load = useCallback(async () => {
    if (!bookingId) return;
    setLoading(true);
    setError("");
    setNoAccess(false);
    try {
      const b = await withAuthRetry((t) => getHallBooking(t, bookingId));
      setBooking(b);
      setNote(b.admin_note ?? "");
      onUpdated(b);
    } catch (err) {
      if (isForbidden(err)) setNoAccess(true);
      else setError(err instanceof ApiError ? err.message : "Unable to load booking.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  useEffect(() => {
    setBooking(null);
    setActionsForbidden(false);
    setConfirm(null);
    setReason("");
    setReasonError("");
    setNoteError("");
    if (bookingId) void load();
  }, [bookingId, load]);

  async function run(fn: (token: string) => Promise<HallBookingRow>, success: string) {
    setBusy(true);
    try {
      const updated = await withAuthRetry(fn);
      const merged = { ...(booking as HallBookingRow), ...updated };
      setBooking(merged);
      setNote(merged.admin_note ?? "");
      onUpdated(merged);
      toast.success(success);
      return merged;
    } catch (err) {
      if (isForbidden(err)) {
        setActionsForbidden(true);
        toast.error("You don't have permission to do this.");
      } else {
        toast.error(err instanceof ApiError ? err.message : "Action failed.");
        // A status conflict means our copy is stale.
        if (err instanceof ApiError && err.code === "hall_booking_invalid_transition") void load();
      }
      return null;
    } finally {
      setBusy(false);
    }
  }

  const id = booking?.public_id ?? "";
  const showActions = canManage && !actionsForbidden && !!booking;
  const noteDirty = (note ?? "") !== (booking?.admin_note ?? "");

  async function saveNote() {
    if (note.length > 2000) {
      setNoteError("Max 2000 characters.");
      return;
    }
    setNoteError("");
    await run((t) => saveHallBookingNote(t, id, note), "Note saved");
  }

  async function submitReject() {
    const r = reason.trim();
    if (!r) return setReasonError("A reason is required.");
    if (r.length > 500) return setReasonError("Max 500 characters.");
    setReasonError("");
    setBusy(true);
    try {
      const updated = await withAuthRetry((t) =>
        rejectHallBooking(t, id, {
          reason: r,
          ...(note.trim() ? { admin_note: note.trim() } : {}),
        }),
      );
      const merged = { ...(booking as HallBookingRow), ...updated };
      setBooking(merged);
      setNote(merged.admin_note ?? "");
      onUpdated(merged);
      setConfirm(null);
      setReason("");
      toast.success("Booking rejected. Refund started.");
    } catch (err) {
      if (isForbidden(err)) {
        setActionsForbidden(true);
        setConfirm(null);
      }
      const fields = apiFieldErrors(err);
      if (fields.reason) setReasonError(fields.reason);
      toast.error(err instanceof ApiError ? err.message : "Unable to reject booking.");
    } finally {
      setBusy(false);
    }
  }

  const b = booking;
  return (
    <>
      <Sheet open={!!bookingId} onOpenChange={(o) => !o && !busy && onClose()}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Booking details</SheetTitle>
          </SheetHeader>

          {loading && !b ? (
            <div className="mt-6 space-y-3">
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : noAccess ? (
            <p className="mt-6 text-sm text-muted-foreground">
              You don't have access to hall bookings.
            </p>
          ) : error && !b ? (
            <div className="mt-6 space-y-3">
              <p className="text-sm text-destructive">{error}</p>
              <Button onClick={() => void load()}>Try again</Button>
            </div>
          ) : b ? (
            <div className="mt-4 space-y-5 px-4 pb-6">
              <div className="flex flex-wrap items-center gap-2">
                <HallStatusBadge status={b.status} />
                <HallRefundBadge status={b.refund_status} />
              </div>

              <dl className="divide-y divide-border rounded-xl border border-border px-4">
                <Row label="Hall">{b.hall?.name}</Row>
                <Row label="Event date">{formatDay(b.booking_date)}</Row>
                <Row label="Slot">
                  {b.slot?.label} ({b.slot?.start_time?.slice(0, 5)}–{b.slot?.end_time?.slice(0, 5)}
                  )
                </Row>
                <Row label="Guests">{b.guests}</Row>
                <Row label="Occasion">{b.occasion || "—"}</Row>
                <Row label="Advance">{formatInr(b.advance_amount)}</Row>
                <Row label="Customer">{b.contact_name}</Row>
                <Row label="Phone">
                  <a
                    href={`tel:${b.contact_phone}`}
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    {b.contact_phone}
                  </a>
                </Row>
                <Row label="Booked">{formatTimestamp(b.created_at)}</Row>
                <Row label="Paid">{formatTimestamp(b.paid_at)}</Row>
                {b.approved_at && <Row label="Approved">{formatTimestamp(b.approved_at)}</Row>}
                {b.rejected_at && <Row label="Rejected">{formatTimestamp(b.rejected_at)}</Row>}
                {b.rejection_reason && <Row label="Rejection reason">{b.rejection_reason}</Row>}
                {b.refund_status && (
                  <Row label="Refund">
                    {formatInr(b.refund_amount)} · {b.refund_status}
                    {b.refunded_at ? ` · ${formatTimestamp(b.refunded_at)}` : ""}
                  </Row>
                )}
              </dl>

              {b.note && (
                <div>
                  <div className="text-xs font-medium uppercase text-muted-foreground">
                    Customer note
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{b.note}</p>
                </div>
              )}

              {showActions && (
                <div className="space-y-2">
                  <Label htmlFor="admin-note">Admin note</Label>
                  <Textarea
                    id="admin-note"
                    rows={3}
                    value={note}
                    maxLength={2000}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  {noteError && <p className="text-xs text-destructive">{noteError}</p>}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy || !noteDirty}
                    onClick={() => void saveNote()}
                  >
                    {busy && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                    Save note
                  </Button>
                </div>
              )}
              {!showActions && b.admin_note && (
                <div>
                  <div className="text-xs font-medium uppercase text-muted-foreground">
                    Admin note
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{b.admin_note}</p>
                </div>
              )}

              {showActions && (
                <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                  {b.status === "pending_approval" && (
                    <>
                      <Button
                        disabled={busy}
                        onClick={() =>
                          void run((t) => approveHallBooking(t, id), "Booking approved")
                        }
                      >
                        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Approve
                      </Button>
                      <Button
                        variant="destructive"
                        disabled={busy}
                        onClick={() => setConfirm("reject")}
                      >
                        Reject
                      </Button>
                    </>
                  )}
                  {b.status === "confirmed" && (
                    <>
                      <Button disabled={busy} onClick={() => setConfirm("complete")}>
                        Mark completed
                      </Button>
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() => setConfirm("no_show")}
                      >
                        No-show
                      </Button>
                    </>
                  )}
                  {b.refund_status === "failed" && (
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        void run((t) => retryHallRefund(t, id), "Refund retry started")
                      }
                    >
                      {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Retry refund
                    </Button>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={confirm === "complete" || confirm === "no_show"}
        onOpenChange={(o) => !o && !busy && setConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "complete" ? "Mark booking as completed?" : "Mark booking as no-show?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "complete"
                ? "Use this once the event has taken place."
                : "The customer did not turn up. This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={async (e) => {
                e.preventDefault();
                const isComplete = confirm === "complete";
                const res = await run(
                  (t) => (isComplete ? completeHallBooking(t, id) : noShowHallBooking(t, id)),
                  isComplete ? "Booking completed" : "Marked as no-show",
                );
                if (res) setConfirm(null);
              }}
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirm === "reject"}
        onOpenChange={(o) => !o && !busy && setConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject this booking?</AlertDialogTitle>
            <AlertDialogDescription>Advance will be refunded.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="reject-reason">Reason *</Label>
            <Textarea
              id="reject-reason"
              rows={3}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Hall under renovation"
            />
            {reasonError && <p className="text-xs text-destructive">{reasonError}</p>}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void submitReject();
              }}
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Reject &amp; refund
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
