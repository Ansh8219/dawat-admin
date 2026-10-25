import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { PageHeader } from "@/components/app/page-header";
import { RowActions } from "@/components/app/row-actions";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { banquetEvents, decorationPackages, inr } from "@/lib/mock/data";
import {
  buildPerGuestRatePatch,
  getBookingSettings,
  updateBookingSettings,
} from "@/lib/api/booking-settings";
import { getTableBooking, listTableBookings } from "@/lib/api/table-bookings";
import { ApiError } from "@/lib/api/types";
import type { BookingSettings, TableBooking, TableBookingStatus } from "@/lib/api/types";
import { withAuthRetry } from "@/lib/api/with-auth";
import { useAuth } from "@/lib/auth";
import { usePanel, usePanelMeta } from "@/lib/use-panel";
import { Calendar, ChevronLeft, ChevronRight, Loader2, Plus, Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/bookings")({
  component: BookingsPage,
  head: () => ({ meta: [{ title: "Table Bookings — Daawat Baker's" }] }),
});

const PAGE_SIZE = 20;

type StatusFilter = "all" | TableBookingStatus;

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "pending_payment", label: "Pending payment" },
  { value: "confirmed", label: "Confirmed" },
  { value: "expired", label: "Expired" },
];

function BookingsPage() {
  const panel = usePanel();
  if (panel === "banquet") return <BanquetBookings />;
  return <DiningTableBookings />;
}

function todayInKolkata(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function bookingStatusLabel(status: string): string {
  switch (status) {
    case "pending_payment":
      return "Pending payment";
    case "confirmed":
      return "Confirmed";
    case "expired":
      return "Expired";
    default:
      return status;
  }
}

function formatOccasion(value: string | null): string {
  if (!value?.trim()) return "—";
  return value
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatClock(value: string): string {
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!match) return value;
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function formatBookingDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatCreatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatRupees(amount: string): string {
  const value = Number(amount);
  if (!Number.isFinite(value)) return `₹${amount}`;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPhone(countryCode: string, phoneNumber: string): string {
  return `${countryCode} ${phoneNumber}`.trim();
}

function durationLabel(hours: number): string {
  return hours === 1 ? "1 hour" : `${hours} hours`;
}

function DiningTableBookings() {
  const navigate = useNavigate();
  const meta = usePanelMeta();
  const [tab, setTab] = useState("bookings");
  const [date, setDate] = useState(todayInKolkata);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [results, setResults] = useState<TableBooking[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selected, setSelected] = useState<TableBooking | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const handleAuthError = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.status === 401) {
        useAuth.getState().logout();
        void navigate({ to: "/login" });
        return true;
      }
      return false;
    },
    [navigate],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const data = await withAuthRetry((token) =>
        listTableBookings(token, {
          date,
          status: status === "all" ? undefined : status,
          page,
          page_size: PAGE_SIZE,
        }),
      );
      setResults(data.results ?? []);
      setCount(data.count ?? 0);
      const maxPage = Math.max(1, Math.ceil((data.count ?? 0) / (data.page_size || PAGE_SIZE)));
      if (page > maxPage) setPage(maxPage);
    } catch (err) {
      if (handleAuthError(err)) return;
      setResults([]);
      setCount(0);
      setLoadError(err instanceof ApiError ? err.message : "Unable to load bookings.");
    } finally {
      setLoading(false);
    }
  }, [date, handleAuthError, page, status]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openBooking = async (row: TableBooking) => {
    setSelected(row);
    setDetailOpen(true);
    setDetailError("");
    setDetailLoading(true);
    try {
      const data = await withAuthRetry((token) => getTableBooking(token, row.public_id));
      setSelected(data);
    } catch (err) {
      if (handleAuthError(err)) return;
      setDetailError(err instanceof ApiError ? err.message : "Unable to load booking.");
    } finally {
      setDetailLoading(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const rangeStart = count === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, count);

  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <PageHeader
        title="Table Bookings"
        crumbs={["Operations", "Table Bookings"]}
        description={`Customer dining reservations · GST ${meta.gst}. Occasion is chosen in the customer app and shown here only.`}
      />

      <div className="space-y-4 p-4 sm:p-6 lg:p-8">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="h-auto rounded-xl">
            <TabsTrigger value="bookings" className="rounded-lg">
              Bookings
            </TabsTrigger>
            <TabsTrigger value="rate" className="rounded-lg">
              Guest rate
            </TabsTrigger>
          </TabsList>

          <TabsContent value="bookings" className="mt-4 space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label htmlFor="booking-date">Date</Label>
                <Input
                  id="booking-date"
                  type="date"
                  value={date}
                  onChange={(e) => {
                    const next = e.target.value || todayInKolkata();
                    setDate(next);
                    setPage(1);
                  }}
                  className="mt-1 h-10 w-[180px] rounded-xl bg-card"
                />
              </div>
              <div>
                <Label htmlFor="booking-status">Status</Label>
                <Select
                  value={status}
                  onValueChange={(value) => {
                    setStatus(value as StatusFilter);
                    setPage(1);
                  }}
                >
                  <SelectTrigger id="booking-status" className="mt-1 h-10 w-[200px] rounded-xl bg-card">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Pending payment holds the slot until payment finishes. Confirmed blocks the table from
              arrival until the booking ends. Expired holds are free again. Amounts use the rate
              saved on each booking.
            </p>

            <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-[var(--shadow-soft)]">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading bookings…
                </div>
              ) : loadError ? (
                <div className="flex flex-col items-center gap-3 py-16 text-center">
                  <p className="text-sm text-destructive">{loadError}</p>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => void refresh()}
                  >
                    Retry
                  </Button>
                </div>
              ) : results.length === 0 ? (
                <div className="px-6 py-16 text-center">
                  <p className="font-medium">No bookings</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Nothing for {formatBookingDate(date)}
                    {status === "all" ? "" : ` with status ${bookingStatusLabel(status).toLowerCase()}`}
                    .
                  </p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[860px] text-sm">
                      <thead>
                        <tr className="border-b border-border/80 bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          <th className="px-4 py-3">Guest</th>
                          <th className="px-4 py-3">Table</th>
                          <th className="px-4 py-3">Time</th>
                          <th className="px-4 py-3">Guests</th>
                          <th className="px-4 py-3">Occasion</th>
                          <th className="px-4 py-3">Amount</th>
                          <th className="px-4 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.map((booking) => (
                          <tr
                            key={booking.public_id}
                            className="cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-muted/30"
                            onClick={() => void openBooking(booking)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                void openBooking(booking);
                              }
                            }}
                            tabIndex={0}
                          >
                            <td className="px-4 py-3">
                              <div className="font-semibold">{booking.customer.full_name}</div>
                              <div className="text-[11px] text-muted-foreground">
                                {formatPhone(
                                  booking.customer.country_code,
                                  booking.customer.phone_number,
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-medium">{booking.table.table_number}</div>
                              <div className="text-[11px] text-muted-foreground">
                                {booking.table.seats} seats
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div>
                                {formatClock(booking.arrival_time)}–{formatClock(booking.ends_at)}
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                {durationLabel(booking.duration_hours)}
                              </div>
                            </td>
                            <td className="px-4 py-3">{booking.guests}</td>
                            <td className="px-4 py-3">{formatOccasion(booking.occasion)}</td>
                            <td className="px-4 py-3 font-medium">
                              {formatRupees(booking.amount)}
                            </td>
                            <td className="px-4 py-3">
                              <StatusBadge status={bookingStatusLabel(booking.status)} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex flex-col gap-2 border-t bg-muted/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-xs text-muted-foreground">
                      Showing <b className="text-foreground">{rangeStart}</b>–
                      <b className="text-foreground">{rangeEnd}</b> of{" "}
                      <b className="text-foreground">{count}</b>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-xl"
                        disabled={safePage === 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                      >
                        <ChevronLeft className="h-4 w-4" /> Prev
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        Page {safePage} / {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-xl"
                        disabled={safePage === totalPages}
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      >
                        Next <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="rate" className="mt-4">
            {tab === "rate" ? <BookingRateForm onAuthError={handleAuthError} /> : null}
          </TabsContent>
        </Tabs>
      </div>

      <Sheet
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) {
            setDetailError("");
            setDetailLoading(false);
          }
        }}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Booking</SheetTitle>
          </SheetHeader>
          {selected ? (
            <div className="mt-6 space-y-5">
              {detailLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading booking…
                </div>
              ) : null}
              {detailError ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {detailError}
                </div>
              ) : null}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold">{selected.customer.full_name}</div>
                  <div className="text-sm text-muted-foreground">
                    {formatPhone(selected.customer.country_code, selected.customer.phone_number)}
                  </div>
                </div>
                <StatusBadge status={bookingStatusLabel(selected.status)} />
              </div>
              <dl className="space-y-3 text-sm">
                <DetailRow label="Date" value={formatBookingDate(selected.booking_date)} />
                <DetailRow
                  label="Time"
                  value={`${formatClock(selected.arrival_time)} – ${formatClock(selected.ends_at)}`}
                />
                <DetailRow label="Duration" value={durationLabel(selected.duration_hours)} />
                <DetailRow label="Guests" value={String(selected.guests)} />
                <DetailRow label="Occasion" value={formatOccasion(selected.occasion)} />
                <DetailRow
                  label="Table"
                  value={`${selected.table.table_number} · ${selected.table.seats} seats`}
                />
                <DetailRow
                  label="Rate on this booking"
                  value={`${formatRupees(selected.per_guest_rate)} / guest`}
                />
                <DetailRow label="Amount" value={formatRupees(selected.amount)} />
                <DetailRow label="Booked" value={formatCreatedAt(selected.created_at)} />
              </dl>
              <p className="text-xs text-muted-foreground">
                Amount is guests × the per-guest rate saved on this booking. Changing the current
                rate does not change it.
              </p>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

function BookingRateForm({ onAuthError }: { onAuthError: (err: unknown) => boolean }) {
  const [original, setOriginal] = useState<BookingSettings | null>(null);
  const [rate, setRate] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const applySettings = useCallback((data: BookingSettings) => {
    setOriginal(data);
    setRate(data.per_guest_rate ?? "");
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const data = await withAuthRetry((token) => getBookingSettings(token));
      applySettings(data);
    } catch (err) {
      if (onAuthError(err)) return;
      setLoadError(err instanceof ApiError ? err.message : "Unable to load booking settings.");
    } finally {
      setLoading(false);
    }
  }, [applySettings, onAuthError]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!original) return;
    setFormError("");

    const result = buildPerGuestRatePatch(rate, original.per_guest_rate);
    if (!result.ok) {
      if (result.error === "No changes to save.") {
        toast.message(result.error);
        return;
      }
      setFormError(result.error);
      toast.error(result.error);
      return;
    }

    setSaving(true);
    try {
      const updated = await withAuthRetry((token) => updateBookingSettings(token, result.payload));
      applySettings(updated);
      toast.success("Guest rate saved");
    } catch (err) {
      if (onAuthError(err)) return;
      const message = err instanceof ApiError ? err.message : "Unable to save guest rate.";
      setFormError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="card-elevated flex max-w-xl items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading booking settings…
      </div>
    );
  }

  if (loadError || !original) {
    return (
      <div className="card-elevated max-w-xl space-y-3 p-4">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {loadError || "Unable to load booking settings."}
        </div>
        <Button type="button" className="rounded-xl" onClick={() => void refresh()}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card-elevated max-w-xl space-y-4 p-4">
      <div>
        <div className="text-sm font-semibold">Per-guest rate</div>
        <p className="mt-1 text-xs text-muted-foreground">
          One restaurant-wide rate for new bookings. Past bookings keep the rate saved on that
          booking.
        </p>
      </div>

      <div>
        <Label htmlFor="per-guest-rate">Per-guest rate (₹)</Label>
        <Input
          id="per-guest-rate"
          inputMode="decimal"
          value={rate}
          onChange={(e) => {
            setRate(e.target.value);
            if (formError) setFormError("");
          }}
          placeholder="200.00"
          className="mt-1 rounded-xl"
        />
        <p className="mt-1 text-[11px] text-muted-foreground">
          Decimal amount in rupees, 0 or greater, at most 2 decimal places.
        </p>
      </div>

      {formError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {formError}
        </div>
      ) : null}

      <Button type="submit" className="rounded-xl" disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Save rate
      </Button>
    </form>
  );
}

function BanquetBookings() {
  const meta = usePanelMeta();
  const [open, setOpen] = useState(false);
  const [pkg, setPkg] = useState(decorationPackages[0]?.name ?? "");

  return (
    <div>
      <PageHeader
        title="Banquet Bookings"
        crumbs={["Operations", "Bookings"]}
        description={`Banquet hall calendar & contracts · GST ${meta.gst}`}
        action={
          <Button className="rounded-xl gap-2" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> New Booking
          </Button>
        }
      />

      <div className="space-y-4 p-4 sm:p-6 lg:p-8">
        <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <div className="card-elevated p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold">July 2026</div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" /> Month view
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase text-muted-foreground">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {Array.from({ length: 31 }).map((_, i) => {
                const day = i + 1;
                const ev = banquetEvents.find((e) => e.date === day);
                return (
                  <div
                    key={day}
                    className={`aspect-square rounded-lg border p-1.5 text-left text-xs ${
                      ev ? "border-primary/40 bg-primary/5" : "border-border/60"
                    }`}
                  >
                    <div className="font-medium">{day}</div>
                    {ev && (
                      <div className="mt-0.5 truncate text-[9px] font-medium text-primary">
                        {ev.title.split(" ").slice(0, 2).join(" ")}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card-elevated p-4">
            <div className="text-sm font-semibold">Upcoming Events</div>
            <div className="mt-3 space-y-2">
              {banquetEvents.map((e) => (
                <div key={e.date} className="rounded-xl border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold">{e.title}</div>
                    <div className="flex items-center gap-1">
                      <div className="text-xs font-medium text-primary">{e.date} Jul</div>
                      <RowActions
                        items={[
                          { label: "View contract", onClick: () => toast.message(e.title) },
                          { label: "Edit event", onClick: () => toast.message(`Edit · ${e.title}`) },
                          {
                            label: "Collect advance",
                            onClick: () => toast.success(`Advance reminder sent for ${e.title}`),
                          },
                          { separator: true, label: "", onClick: () => {} },
                          {
                            label: "Cancel event",
                            onClick: () => toast.message(`${e.title} cancelled`),
                            destructive: true,
                          },
                        ]}
                      />
                    </div>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3 w-3" /> {e.guests}
                    </span>
                    <span>{e.pkg}</span>
                  </div>
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Advance {e.advance}%</span>
                      <span className="font-semibold">
                        {inr((e.total * e.advance) / 100)} / {inr(e.total)}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${e.advance}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>New Banquet Booking</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Event Type</Label>
              <Input placeholder="Wedding / Birthday…" className="mt-1 rounded-xl" />
            </div>
            <div>
              <Label>Date & Time</Label>
              <Input type="datetime-local" className="mt-1 rounded-xl" />
            </div>
            <div>
              <Label>Guest Count</Label>
              <Input type="number" placeholder="150" className="mt-1 rounded-xl" />
            </div>
            <div>
              <Label>Contact</Label>
              <Input placeholder="+91 98…" className="mt-1 rounded-xl" />
            </div>
          </div>
          <div>
            <Label>Decoration Package</Label>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {decorationPackages.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => setPkg(p.name)}
                  className={`rounded-xl border p-3 text-left hover:border-primary hover:bg-primary/5 ${
                    pkg === p.name ? "border-primary bg-primary/10" : ""
                  }`}
                >
                  <div className="text-sm font-semibold">{p.name}</div>
                  <div className="mt-0.5 text-xs font-bold text-primary">{inr(p.price)}</div>
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    {p.features.join(" · ")}
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-xl bg-primary/5 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span>Estimated Total</span>
              <span className="font-bold text-primary">{inr(280000)}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Advance (25%) required</span>
              <span className="font-semibold">{inr(70000)}</span>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                toast.success(`Contract generated · ${pkg || "package"}`);
                setOpen(false);
              }}
            >
              Generate Contract
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
