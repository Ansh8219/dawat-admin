import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Loader2,
  Lock,
  Phone,
  RefreshCw,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { apiFieldErrors } from "@/lib/api/client";
import { formatDay, formatTimestamp, getHallDashboard, isForbidden } from "@/lib/api/hall-bookings";
import {
  HALL_ENQUIRY_STATUS_LABELS,
  HALL_ENQUIRY_STATUSES,
  listHallEnquiries,
  REJECTION_REASON_MAX,
  updateHallEnquiryStatus,
  type HallEnquiry,
  type HallEnquiryListData,
  type HallEnquiryStatus,
} from "@/lib/api/hall-enquiries";
import { ApiError } from "@/lib/api/types";
import { withAuthRetry } from "@/lib/api/with-auth";
import { useAccess } from "@/lib/access";
import { useHallEnquiryAlerts } from "@/lib/hall-enquiry-alerts";
import { cn } from "@/lib/utils";

const num = z.coerce.number().int().positive().optional().catch(undefined);

const searchSchema = z.object({
  // "all" is explicit so the default (no param) can be the New tab.
  status: z
    .string()
    .optional()
    .transform((v): HallEnquiryStatus | "all" =>
      v === "all"
        ? "all"
        : (HALL_ENQUIRY_STATUSES as string[]).includes(v ?? "")
          ? (v as HallEnquiryStatus)
          : "new",
    )
    .catch("new"),
  page: num,
  page_size: num.transform((v) => (v ? Math.min(v, 100) : undefined)),
});

export const Route = createFileRoute("/_app/hall-enquiries")({
  component: HallEnquiriesPage,
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Hall Enquiries — Daawat Baker's" }] }),
});

const PAGE_SIZES = [10, 20, 50, 100];

const STATUS_CLASS: Record<HallEnquiryStatus, string> = {
  new: "bg-info/15 text-info border-info/30",
  contacted: "bg-warning/15 text-warning border-warning/40",
  approved: "bg-success/15 text-success border-success/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
  closed: "bg-muted text-muted-foreground border-border",
};

const QUICK_REASONS = [
  "Hall not available on that date",
  "Hall under maintenance",
  "Guest count not supported",
];

function errorText(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    const fields = Object.values(apiFieldErrors(err));
    return fields.length ? fields.join(" ") : err.message;
  }
  return fallback;
}

function HallEnquiriesPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { canManage } = useAccess();
  const manage = canManage("halls");
  const status = search.status;
  const page = search.page ?? 1;
  const pageSize = search.page_size ?? 20;
  const alertTick = useHallEnquiryAlerts((s) => s.tick);

  const [data, setData] = useState<HallEnquiryListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [noAccess, setNoAccess] = useState(false);
  const [newCount, setNewCount] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [approveTarget, setApproveTarget] = useState<HallEnquiry | null>(null);
  const [rejectTarget, setRejectTarget] = useState<HallEnquiry | null>(null);

  const setSearch = useCallback(
    (patch: Partial<z.input<typeof searchSchema>>, opts: { keepPage?: boolean } = {}) =>
      void navigate({
        search: (prev) => ({ ...prev, ...(opts.keepPage ? {} : { page: undefined }), ...patch }),
        replace: true,
      }),
    [navigate],
  );

  const refreshNewCount = useCallback(async () => {
    try {
      const d = await withAuthRetry((t) => getHallDashboard(t));
      setNewCount(d.cards.new_enquiries);
    } catch {
      /* badge is best-effort */
    }
  }, []);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError("");
      setNoAccess(false);
      try {
        setData(
          await withAuthRetry((t) =>
            listHallEnquiries(t, {
              status: status === "all" ? undefined : status,
              page,
              page_size: pageSize,
            }),
          ),
        );
      } catch (err) {
        if (isForbidden(err)) setNoAccess(true);
        else setError(errorText(err, "Unable to load enquiries."));
      } finally {
        setLoading(false);
      }
    },
    [status, page, pageSize],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void refreshNewCount();
  }, [refreshNewCount]);

  // Realtime: hall_enquiry.created → refresh list + New badge (skip the initial mount).
  useEffect(() => {
    if (alertTick === 0) return;
    void load(true);
    void refreshNewCount();
  }, [alertTick]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Send a status change; update the row from the response (no full reload). */
  const changeStatus = useCallback(
    async (
      e: HallEnquiry,
      next: HallEnquiryStatus,
      rejection_reason?: string,
    ): Promise<boolean> => {
      setBusyId(e.public_id);
      try {
        const updated = await withAuthRetry((t) =>
          updateHallEnquiryStatus(t, e.public_id, {
            status: next,
            ...(next === "rejected" ? { rejection_reason } : {}),
          }),
        );
        setData((d) => {
          if (!d) return d;
          // On a filtered tab the row no longer belongs once its status changed.
          const stays = status === "all" || updated.status === status;
          return {
            ...d,
            count: stays ? d.count : Math.max(0, d.count - 1),
            results: stays
              ? d.results.map((r) => (r.public_id === updated.public_id ? updated : r))
              : d.results.filter((r) => r.public_id !== updated.public_id),
          };
        });
        void refreshNewCount();
        toast.success(`Enquiry ${HALL_ENQUIRY_STATUS_LABELS[updated.status].toLowerCase()}`);
        return true;
      } catch (err) {
        toast.error(errorText(err, "Couldn't update the enquiry."));
        return false;
      } finally {
        setBusyId(null);
      }
    },
    [status, refreshNewCount],
  );

  const total = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  return (
    <div>
      <PageHeader
        title="Hall Enquiries"
        crumbs={["Banquet", "Enquiries"]}
        description="Review customer enquiries — approve to let them book, or reject with a reason."
        action={
          <Button
            variant="outline"
            onClick={() => {
              void load();
              void refreshNewCount();
            }}
            disabled={loading}
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} /> Refresh
          </Button>
        }
      />
      <div className="space-y-4 p-4 sm:p-6 lg:p-8">
        {noAccess ? (
          <EmptyState
            icon={Lock}
            title="No access"
            description="You don't have permission to view hall enquiries."
          />
        ) : (
          <>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
              <Chip active={status === "all"} onClick={() => setSearch({ status: "all" })}>
                All
              </Chip>
              {HALL_ENQUIRY_STATUSES.map((s) => (
                <Chip key={s} active={status === s} onClick={() => setSearch({ status: s })}>
                  {HALL_ENQUIRY_STATUS_LABELS[s]}
                  {s === "new" && newCount != null && newCount > 0 && (
                    <span className="ml-1.5 rounded-full bg-destructive px-1.5 py-px text-[10px] font-semibold leading-none text-destructive-foreground">
                      {newCount > 99 ? "99+" : newCount}
                    </span>
                  )}
                </Chip>
              ))}
            </div>

            {loading && !data ? (
              <div className="space-y-2">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-28 w-full rounded-xl" />
                ))}
              </div>
            ) : error ? (
              <EmptyState
                icon={Inbox}
                title="Couldn't load enquiries"
                description={error}
                action={<Button onClick={() => void load()}>Try again</Button>}
              />
            ) : !data || data.results.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="No enquiries yet"
                description={
                  status === "all"
                    ? "Customer enquiries will appear here."
                    : `No ${HALL_ENQUIRY_STATUS_LABELS[status].toLowerCase()} enquiries.`
                }
              />
            ) : (
              <>
                <ul className={cn("space-y-3", loading && "opacity-60")}>
                  {data.results.map((e) => (
                    <EnquiryCard
                      key={e.public_id}
                      enquiry={e}
                      canManage={manage}
                      busy={busyId === e.public_id}
                      onApprove={() => setApproveTarget(e)}
                      onReject={() => setRejectTarget(e)}
                      onStatus={(s) => void changeStatus(e, s)}
                    />
                  ))}
                </ul>

                <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                  <span>
                    {rangeStart}–{rangeEnd} of {total}
                  </span>
                  <div className="flex items-center gap-2">
                    <Select
                      value={String(pageSize)}
                      onValueChange={(v) => setSearch({ page_size: Number(v) })}
                    >
                      <SelectTrigger className="w-[110px]" aria-label="Rows per page">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAGE_SIZES.map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n} / page
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Previous page"
                      disabled={page <= 1 || loading}
                      onClick={() => setSearch({ page: page - 1 }, { keepPage: true })}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span>
                      Page {page} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Next page"
                      disabled={page >= totalPages || loading}
                      onClick={() => setSearch({ page: page + 1 }, { keepPage: true })}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      <AlertDialog
        open={!!approveTarget}
        onOpenChange={(o) => {
          if (!o && busyId == null) setApproveTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve this enquiry?</AlertDialogTitle>
            <AlertDialogDescription>
              Customer will be notified and can book this hall for{" "}
              {approveTarget?.preferred_date
                ? formatDay(approveTarget.preferred_date)
                : "their preferred date"}
              .
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busyId != null}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busyId != null}
              onClick={async (ev) => {
                ev.preventDefault();
                if (!approveTarget) return;
                if (await changeStatus(approveTarget, "approved")) setApproveTarget(null);
              }}
            >
              {busyId != null && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Approve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <RejectDialog
        enquiry={rejectTarget}
        busy={busyId != null}
        onClose={() => setRejectTarget(null)}
        onSubmit={async (e, reason) => {
          if (await changeStatus(e, "rejected", reason)) setRejectTarget(null);
        }}
      />
    </div>
  );
}

function EnquiryCard({
  enquiry: e,
  canManage,
  busy,
  onApprove,
  onReject,
  onStatus,
}: {
  enquiry: HallEnquiry;
  canManage: boolean;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
  onStatus: (s: HallEnquiryStatus) => void;
}) {
  const reviewable = e.status === "new" || e.status === "contacted";
  const canHousekeep = e.status === "new" || e.status === "contacted" || e.status === "approved";
  return (
    <li className="rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{e.name}</span>
            <Badge variant="outline" className={cn("whitespace-nowrap", STATUS_CLASS[e.status])}>
              {HALL_ENQUIRY_STATUS_LABELS[e.status] ?? e.status}
            </Badge>
          </div>
          <a
            href={`tel:${e.phone}`}
            className="mt-1 inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <Phone className="h-3.5 w-3.5" /> {e.phone}
          </a>
        </div>
        <div className="text-xs text-muted-foreground">{formatTimestamp(e.created_at)}</div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted-foreground">Hall</dt>
          <dd className="font-medium">{e.hall?.name ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Preferred date</dt>
          <dd className="font-medium">{formatDay(e.preferred_date)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Guests</dt>
          <dd className="font-medium">{e.guests ?? "—"}</dd>
        </div>
      </dl>

      {e.message && (
        <p className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-muted/50 p-3 text-sm">
          {e.message}
        </p>
      )}

      {e.status === "rejected" && e.rejection_reason && (
        <p className="mt-3 text-sm text-destructive">
          <span className="font-medium">Rejected:</span> {e.rejection_reason}
        </p>
      )}

      {canManage && (reviewable || canHousekeep) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {reviewable && (
            <>
              <Button size="sm" disabled={busy} onClick={onApprove}>
                <Check className="mr-1.5 h-4 w-4" /> Approve
              </Button>
              <Button size="sm" variant="destructive" disabled={busy} onClick={onReject}>
                <X className="mr-1.5 h-4 w-4" /> Reject
              </Button>
            </>
          )}
          {e.status === "new" && (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => onStatus("contacted")}
            >
              Contacted
            </Button>
          )}
          {canHousekeep && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => onStatus("closed")}>
              Closed
            </Button>
          )}
          {busy && <Loader2 className="h-4 w-4 animate-spin self-center text-muted-foreground" />}
        </div>
      )}
    </li>
  );
}

function RejectDialog({
  enquiry,
  busy,
  onClose,
  onSubmit,
}: {
  enquiry: HallEnquiry | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (e: HallEnquiry, reason: string) => void | Promise<void>;
}) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (enquiry) setReason("");
  }, [enquiry]);

  const trimmed = reason.trim();
  return (
    <Dialog
      open={!!enquiry}
      onOpenChange={(o) => {
        if (!o && !busy) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject enquiry</DialogTitle>
          <DialogDescription>
            {enquiry ? `${enquiry.name}'s enquiry will be rejected and they'll be notified.` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {QUICK_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                disabled={busy}
                onClick={() => setReason(r)}
                className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted"
              >
                {r}
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="enquiry-reject-reason">
              Reason for rejection (shown to the customer)
            </Label>
            <Textarea
              id="enquiry-reject-reason"
              rows={4}
              maxLength={REJECTION_REASON_MAX}
              value={reason}
              disabled={busy}
              onChange={(ev) => setReason(ev.target.value)}
            />
            <div className="text-right text-xs text-muted-foreground">
              {reason.length}/{REJECTION_REASON_MAX}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={busy || !trimmed}
            onClick={() => enquiry && void onSubmit(enquiry, trimmed)}
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Reject enquiry
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}
