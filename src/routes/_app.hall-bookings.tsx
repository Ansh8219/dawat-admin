import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { CalendarX, ChevronLeft, ChevronRight, Lock, RefreshCw, Search, X } from "lucide-react";
import { z } from "zod";
import { EmptyState } from "@/components/app/empty-state";
import { HallRefundBadge, HallStatusBadge } from "@/components/app/hall-booking-badges";
import { HallBookingDrawer } from "@/components/app/hall-booking-drawer";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listHalls, type Hall } from "@/lib/api/halls";
import {
  formatDay,
  formatInr,
  HALL_BOOKING_STATUS_LABELS,
  HALL_BOOKING_STATUSES,
  isForbidden,
  listHallBookings,
  type HallBookingListData,
  type HallBookingRow,
} from "@/lib/api/hall-bookings";
import { ApiError } from "@/lib/api/types";
import { withAuthRetry } from "@/lib/api/with-auth";
import { cn } from "@/lib/utils";

// The router JSON-parses search values, so numeric-looking strings (phone numbers) arrive as numbers.
const str = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v) => (v == null || v === "" ? undefined : String(v)))
  .catch(undefined);
const isoDate = str.transform((v) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined));
const num = z.coerce.number().int().positive().optional().catch(undefined);

const searchSchema = z.object({
  status: str.transform((v) =>
    v && (HALL_BOOKING_STATUSES as string[]).includes(v)
      ? (v as (typeof HALL_BOOKING_STATUSES)[number])
      : undefined,
  ),
  date: isoDate,
  from: isoDate,
  to: isoDate,
  when: str.transform((v) => (v === "upcoming" || v === "past" ? v : undefined)),
  q: str.transform((v) => v?.slice(0, 100)),
  hall: str,
  page: num,
  page_size: num.transform((v) => (v ? Math.min(v, 100) : undefined)),
  booking: str,
});

export const Route = createFileRoute("/_app/hall-bookings")({
  component: HallBookingsPage,
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Hall Bookings — Daawat Baker's" }] }),
});

const PAGE_SIZES = [10, 20, 50, 100];
const ALL = "__all__";

function HallBookingsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const page = search.page ?? 1;
  const pageSize = search.page_size ?? 20;

  const [data, setData] = useState<HallBookingListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [noAccess, setNoAccess] = useState(false);
  const [halls, setHalls] = useState<Hall[]>([]);
  const [qInput, setQInput] = useState(search.q ?? "");

  const setSearch = useCallback(
    (patch: Partial<z.input<typeof searchSchema>>, opts: { keepPage?: boolean } = {}) =>
      void navigate({
        search: (prev) => ({ ...prev, ...(opts.keepPage ? {} : { page: undefined }), ...patch }),
        replace: true,
      }),
    [navigate],
  );

  // Debounced search box → URL.
  useEffect(() => {
    if ((search.q ?? "") === qInput.trim()) return;
    const t = setTimeout(() => setSearch({ q: qInput.trim() || undefined }), 400);
    return () => clearTimeout(t);
  }, [qInput, search.q, setSearch]);

  // Keep the box in sync when the URL changes elsewhere (e.g. back button).
  useEffect(() => {
    setQInput(search.q ?? "");
  }, [search.q]);

  useEffect(() => {
    withAuthRetry((t) => listHalls(t))
      .then(setHalls)
      .catch(() => setHalls([]));
  }, []);

  const { status, date, from, to, when, q, hall } = search;
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setNoAccess(false);
    try {
      setData(
        await withAuthRetry((t) =>
          listHallBookings(t, {
            status,
            date,
            from,
            to,
            when,
            q,
            hall_public_id: hall,
            page,
            page_size: pageSize,
          }),
        ),
      );
    } catch (err) {
      if (isForbidden(err)) setNoAccess(true);
      else setError(err instanceof ApiError ? err.message : "Unable to load bookings.");
    } finally {
      setLoading(false);
    }
  }, [status, date, from, to, when, q, hall, page, pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  const patchRow = useCallback((b: HallBookingRow) => {
    setData((d) =>
      d
        ? {
            ...d,
            results: d.results.map((r) => (r.public_id === b.public_id ? { ...r, ...b } : r)),
          }
        : d,
    );
  }, []);

  const total = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);
  const hasFilters = !!(status || date || from || to || q || hall);

  return (
    <div>
      <PageHeader
        title="Hall Bookings"
        crumbs={["Banquet", "Bookings"]}
        description="Review, approve and manage hall bookings."
        action={
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} /> Refresh
          </Button>
        }
      />
      <div className="space-y-4 p-4 sm:p-6 lg:p-8">
        {noAccess ? (
          <EmptyState
            icon={Lock}
            title="No access"
            description="You don't have permission to view hall bookings."
          />
        ) : (
          <>
            <Tabs
              value={when ?? "all"}
              onValueChange={(v) =>
                setSearch({ when: v === "all" ? undefined : (v as "upcoming" | "past") })
              }
            >
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
                <TabsTrigger value="past">Past</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex flex-wrap gap-2">
              <Chip active={!status} onClick={() => setSearch({ status: undefined })}>
                All statuses
              </Chip>
              {HALL_BOOKING_STATUSES.map((s) => (
                <Chip key={s} active={status === s} onClick={() => setSearch({ status: s })}>
                  {HALL_BOOKING_STATUS_LABELS[s]}
                </Chip>
              ))}
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  aria-label="Search by customer name or phone"
                  className="pl-9"
                  placeholder="Search name or phone"
                  maxLength={100}
                  value={qInput}
                  onChange={(e) => setQInput(e.target.value)}
                />
              </div>
              <Select
                value={hall ?? ALL}
                onValueChange={(v) => setSearch({ hall: v === ALL ? undefined : v })}
              >
                <SelectTrigger className="w-[200px]" aria-label="Hall">
                  <SelectValue placeholder="All halls" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All halls</SelectItem>
                  {halls.map((h) => (
                    <SelectItem key={h.public_id} value={h.public_id}>
                      {h.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                From
                <Input
                  type="date"
                  value={from ?? ""}
                  max={to}
                  onChange={(e) =>
                    setSearch({ from: e.target.value || undefined, date: undefined })
                  }
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                To
                <Input
                  type="date"
                  value={to ?? ""}
                  min={from}
                  onChange={(e) => setSearch({ to: e.target.value || undefined, date: undefined })}
                />
              </label>
              {date && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSearch({ date: undefined })}
                >
                  Event date {formatDay(date)} <X className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              )}
              {hasFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setQInput("");
                    setSearch({
                      status: undefined,
                      date: undefined,
                      from: undefined,
                      to: undefined,
                      q: undefined,
                      hall: undefined,
                    });
                  }}
                >
                  Clear filters
                </Button>
              )}
            </div>

            {loading && !data ? (
              <div className="space-y-2">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-xl" />
                ))}
              </div>
            ) : error ? (
              <EmptyState
                icon={CalendarX}
                title="Couldn't load bookings"
                description={error}
                action={<Button onClick={() => void load()}>Try again</Button>}
              />
            ) : !data || data.results.length === 0 ? (
              <EmptyState
                icon={CalendarX}
                title="No bookings found"
                description={
                  hasFilters || when
                    ? "Try changing or clearing the filters."
                    : "Bookings will appear here."
                }
              />
            ) : (
              <>
                <div
                  className={cn(
                    "overflow-x-auto rounded-2xl border border-border bg-card",
                    loading && "opacity-60",
                  )}
                >
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Event</TableHead>
                        <TableHead>Hall</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead className="text-right">Guests</TableHead>
                        <TableHead>Occasion</TableHead>
                        <TableHead className="text-right">Advance</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.results.map((b) => (
                        <TableRow
                          key={b.public_id}
                          className="cursor-pointer"
                          tabIndex={0}
                          onClick={() => setSearch({ booking: b.public_id }, { keepPage: true })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter")
                              setSearch({ booking: b.public_id }, { keepPage: true });
                          }}
                        >
                          <TableCell>
                            <div className="font-medium">{formatDay(b.booking_date)}</div>
                            <div className="text-xs text-muted-foreground">{b.slot?.label}</div>
                          </TableCell>
                          <TableCell>{b.hall?.name}</TableCell>
                          <TableCell>
                            <div>{b.contact_name}</div>
                            <a
                              href={`tel:${b.contact_phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs text-primary hover:underline"
                            >
                              {b.contact_phone}
                            </a>
                          </TableCell>
                          <TableCell className="text-right">{b.guests}</TableCell>
                          <TableCell>{b.occasion || "—"}</TableCell>
                          <TableCell className="text-right">
                            {formatInr(b.advance_amount)}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              <HallStatusBadge status={b.status} />
                              <HallRefundBadge status={b.refund_status} />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

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

      <HallBookingDrawer
        bookingId={search.booking ?? null}
        onClose={() => setSearch({ booking: undefined }, { keepPage: true })}
        onUpdated={patchRow}
      />
    </div>
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
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}
