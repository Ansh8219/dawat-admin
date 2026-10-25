import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  QrCode,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { RowActions } from "@/components/app/row-actions";
import { StatusBadge } from "@/components/app/status-badge";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import {
  createTable,
  deleteTable,
  downloadBlob,
  getTableQrPng,
  listTables,
  updateTable,
} from "@/lib/api/tables";
import { ApiError } from "@/lib/api/types";
import type { RestaurantTable } from "@/lib/api/types";
import { withAuthRetry } from "@/lib/api/with-auth";
import { useAuth } from "@/lib/auth";
import { qrImageUrl } from "@/lib/order-web";
import { usePanel } from "@/lib/use-panel";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/table-qr")({
  component: TablesPage,
  head: () => ({ meta: [{ title: "Tables — Daawat Baker's" }] }),
});

type ActiveFilter = "all" | "active" | "inactive";

type FormState = {
  table_number: string;
  seats: string;
  is_active: boolean;
};

const EMPTY_FORM: FormState = {
  table_number: "",
  seats: "4",
  is_active: true,
};

const SEAT_PRESETS = [2, 4, 6, 8];
const PAGE_SIZE = 20;

function TablesPage() {
  const navigate = useNavigate();
  const panel = usePanel();

  const [results, setResults] = useState<RestaurantTable[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<RestaurantTable | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [qrPreviewUrl, setQrPreviewUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<RestaurantTable | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

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

  const refresh = useCallback(
    async (options?: { showLoading?: boolean; keepSelection?: boolean; selectId?: string }) => {
      const showLoading = options?.showLoading ?? false;
      if (showLoading) {
        setLoading(true);
        setLoadError("");
      }
      try {
        const data = await withAuthRetry((token) =>
          listTables(token, {
            page,
            page_size: PAGE_SIZE,
            is_active: activeFilter === "all" ? undefined : activeFilter === "active",
          }),
        );
        const list = data.results ?? [];
        setResults(list);
        setCount(data.count ?? 0);
        const maxPage = Math.max(1, Math.ceil((data.count ?? 0) / (data.page_size || PAGE_SIZE)));
        if (page > maxPage) {
          setPage(maxPage);
          return;
        }
        setSelectedId((prev) => {
          if (options?.selectId && list.some((t) => t.public_id === options.selectId)) {
            return options.selectId;
          }
          if (options?.keepSelection === false) return list[0]?.public_id ?? null;
          if (prev && list.some((t) => t.public_id === prev)) return prev;
          return list[0]?.public_id ?? null;
        });
      } catch (err) {
        if (handleAuthError(err)) return;
        const message = err instanceof ApiError ? err.message : "Unable to load tables.";
        if (showLoading) setLoadError(message);
        else toast.error(message);
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [activeFilter, handleAuthError, page],
  );

  useEffect(() => {
    if (panel === "banquet") return;
    void refresh({ showLoading: true });
  }, [panel, refresh]);

  useEffect(() => {
    setPage(1);
  }, [activeFilter]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return results;
    return results.filter(
      (t) =>
        t.table_number.toLowerCase().includes(needle) ||
        t.qr_url.toLowerCase().includes(needle),
    );
  }, [q, results]);

  const selected = useMemo(
    () => filtered.find((t) => t.public_id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId],
  );

  const activeCount = useMemo(() => results.filter((t) => t.is_active).length, [results]);
  const seatTotal = useMemo(() => results.reduce((sum, t) => sum + t.seats, 0), [results]);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const rangeStart = count === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, count);

  useEffect(() => {
    if (!selected) {
      setQrPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setQrError("");
      setQrLoading(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    setQrLoading(true);
    setQrError("");
    setQrPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });

    void (async () => {
      try {
        const blob = await withAuthRetry((token) =>
          getTableQrPng(token, selected.public_id, controller.signal),
        );
        if (cancelled) return;
        setQrPreviewUrl(URL.createObjectURL(blob));
      } catch (err) {
        if (cancelled || controller.signal.aborted) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (handleAuthError(err)) return;
        setQrError(err instanceof ApiError ? err.message : "Unable to load QR image.");
      } finally {
        if (!cancelled) setQrLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [handleAuthError, selected]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setSheetOpen(true);
  }

  function openEdit(table: RestaurantTable) {
    setEditing(table);
    setForm({
      table_number: table.table_number,
      seats: String(table.seats),
      is_active: table.is_active,
    });
    setSheetOpen(true);
  }

  async function downloadQr(table: RestaurantTable) {
    setDownloadingId(table.public_id);
    try {
      const blob = await withAuthRetry((token) => getTableQrPng(token, table.public_id));
      downloadBlob(blob, `${table.table_number}-qr.png`);
      toast.success(`Downloaded ${table.table_number}-qr.png`);
    } catch (err) {
      if (handleAuthError(err)) return;
      toast.error(err instanceof ApiError ? err.message : "Unable to download QR");
    } finally {
      setDownloadingId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleting(true);
    setDeleteError("");
    try {
      await withAuthRetry((token) => deleteTable(token, target.public_id));
      toast.success(`${target.table_number} deleted`);
      setDeleteTarget(null);
      if (selectedId === target.public_id) setSelectedId(null);
      await refresh({ showLoading: false });
    } catch (err) {
      if (handleAuthError(err)) return;
      if (err instanceof ApiError && (err.status === 404 || err.code === "dining_table_not_found")) {
        toast.error("That table is already gone.");
        setDeleteTarget(null);
        await refresh({ showLoading: false });
        return;
      }
      const message =
        err instanceof ApiError ? err.message : "Unable to delete table";
      setDeleteError(message);
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  }

  async function toggleActive(table: RestaurantTable, next: boolean) {
    setTogglingId(table.public_id);
    try {
      const updated = await withAuthRetry((token) =>
        updateTable(token, table.public_id, { is_active: next }),
      );
      setResults((prev) => {
        const nextList = prev.map((r) => (r.public_id === table.public_id ? { ...r, ...updated } : r));
        if (activeFilter === "active" && !next) {
          return nextList.filter((r) => r.public_id !== table.public_id);
        }
        if (activeFilter === "inactive" && next) {
          return nextList.filter((r) => r.public_id !== table.public_id);
        }
        return nextList;
      });
      setCount((c) => {
        if (activeFilter === "active" && !next) return Math.max(0, c - 1);
        if (activeFilter === "inactive" && next) return Math.max(0, c - 1);
        return c;
      });
      toast.success(next ? `${table.table_number} activated` : `${table.table_number} deactivated`);
    } catch (err) {
      if (handleAuthError(err)) return;
      toast.error(err instanceof ApiError ? err.message : "Unable to update table");
    } finally {
      setTogglingId(null);
    }
  }

  async function saveForm() {
    const tableNumber = form.table_number.trim();
    const seats = Number.parseInt(form.seats, 10);

    if (!tableNumber) {
      toast.error("Table number is required");
      return;
    }
    if (tableNumber.length > 64) {
      toast.error("Table number must be 64 characters or fewer");
      return;
    }
    if (!Number.isFinite(seats) || seats < 1) {
      toast.error("Seats must be at least 1");
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        const updated = await withAuthRetry((token) =>
          updateTable(token, editing.public_id, {
            table_number: tableNumber,
            seats,
            is_active: form.is_active,
          }),
        );
        setResults((prev) =>
          prev.map((r) => (r.public_id === editing.public_id ? { ...r, ...updated } : r)),
        );
        setSelectedId(updated.public_id);
        toast.success(`${updated.table_number} updated`);
      } else {
        const created = await withAuthRetry((token) =>
          createTable(token, {
            table_number: tableNumber,
            seats,
            is_active: form.is_active,
          }),
        );
        setSelectedId(created.public_id);
        toast.success(`${created.table_number} created`, {
          action: {
            label: "Download QR",
            onClick: () => void downloadQr(created),
          },
        });
        await refresh({ showLoading: false, keepSelection: true, selectId: created.public_id });
      }
      setSheetOpen(false);
    } catch (err) {
      if (handleAuthError(err)) return;
      toast.error(err instanceof ApiError ? err.message : "Unable to save table");
    } finally {
      setSaving(false);
    }
  }

  const copyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Order link copied");
    } catch {
      toast.error("Could not copy");
    }
  };

  if (panel === "banquet") {
    return (
      <div className="flex min-h-full flex-col bg-muted/20">
        <PageHeader
          title="Tables"
          crumbs={["Operations", "Tables"]}
          description="Dining table QR codes are managed from the Restaurant or Bakery panel."
        />
        <div className="p-6 text-sm text-muted-foreground">
          Switch to Restaurant or Bakery to manage dining tables and print guest QR codes.
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <PageHeader
        title="Tables"
        crumbs={["Operations", "Tables"]}
        description="Add dining tables and print QR codes for guest ordering. Tables are shared across restaurant and bakery. Inactive tables are not offered for new bookings; existing bookings stay visible."
        action={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => window.print()}
              disabled={activeCount === 0}
            >
              <Download className="mr-1.5 h-4 w-4" />
              Print QR sheet
            </Button>
            <Button type="button" className="rounded-xl" onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add table
            </Button>
          </div>
        }
      />

      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6 lg:p-8">
        <div className="grid gap-3 sm:grid-cols-3 print:hidden">
          <StatChip
            label="Tables"
            value={String(count)}
            hint={activeFilter === "all" ? "Total" : "Filtered"}
          />
          <StatChip label="QR active" value={String(activeCount)} hint="On this page" />
          <StatChip label="Total seats" value={String(seatTotal)} hint="On this page" />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] print:grid-cols-1">
          <div className="space-y-4 print:hidden">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search table number or QR URL…"
                  className="h-10 rounded-xl bg-card pl-9"
                />
              </div>
              <Select
                value={activeFilter}
                onValueChange={(v) => setActiveFilter(v as ActiveFilter)}
              >
                <SelectTrigger className="h-10 w-[160px] rounded-xl bg-card">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All tables</SelectItem>
                  <SelectItem value="active">Active only</SelectItem>
                  <SelectItem value="inactive">Inactive only</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                {filtered.length} of {count}
              </p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-[var(--shadow-soft)]">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading tables…
                </div>
              ) : loadError ? (
                <div className="flex flex-col items-center gap-3 py-16 text-center">
                  <p className="text-sm text-destructive">{loadError}</p>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => void refresh({ showLoading: true })}
                  >
                    Retry
                  </Button>
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <QrCode className="h-7 w-7" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium">
                      {results.length === 0 ? "No tables yet" : "No matching tables"}
                    </p>
                    <p className="max-w-sm text-sm text-muted-foreground">
                      {results.length === 0
                        ? "Create a table with number and seats. We’ll generate a QR guests can scan to order."
                        : "Try a different search or status filter."}
                    </p>
                  </div>
                  {results.length === 0 ? (
                    <Button type="button" className="rounded-xl" onClick={openCreate}>
                      <Plus className="mr-1.5 h-4 w-4" />
                      Create first table
                    </Button>
                  ) : null}
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-sm">
                      <thead>
                        <tr className="border-b border-border/80 bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          <th className="px-4 py-3">Table</th>
                          <th className="px-4 py-3">Seats</th>
                          <th className="px-4 py-3">Active</th>
                          <th className="px-4 py-3">QR</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((table) => {
                          const active = selected?.public_id === table.public_id;
                          return (
                            <tr
                              key={table.public_id}
                              className={cn(
                                "cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-muted/30",
                                active && "bg-primary/5",
                              )}
                              onClick={() => setSelectedId(table.public_id)}
                            >
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div
                                    className={cn(
                                      "flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold",
                                      table.is_active
                                        ? "bg-primary/10 text-primary"
                                        : "bg-muted text-muted-foreground",
                                    )}
                                  >
                                    {table.table_number.replace(/^T/i, "") || "·"}
                                  </div>
                                  <div>
                                    <div className="font-semibold tracking-tight">
                                      {table.table_number}
                                    </div>
                                    <div className="text-[11px] text-muted-foreground">
                                      {table.is_active ? "Ready for guest scans" : "QR disabled"}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                                  <Users className="h-3.5 w-3.5" />
                                  {table.seats}
                                </span>
                              </td>
                              <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center gap-2">
                                  <StatusBadge status={table.is_active ? "Active" : "Inactive"} />
                                  <Switch
                                    checked={table.is_active}
                                    disabled={togglingId === table.public_id}
                                    onCheckedChange={(v) => void toggleActive(table, v)}
                                    aria-label={`Toggle ${table.table_number}`}
                                  />
                                </div>
                              </td>
                              <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="rounded-xl"
                                  disabled={downloadingId === table.public_id}
                                  onClick={() => void downloadQr(table)}
                                >
                                  {downloadingId === table.public_id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Download className="h-3.5 w-3.5" />
                                  )}
                                  View / Download
                                </Button>
                              </td>
                              <td
                                className="px-4 py-3 text-right"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <RowActions
                                  items={[
                                    {
                                      label: "Edit",
                                      icon: <Pencil className="mr-2 h-4 w-4" />,
                                      onClick: () => openEdit(table),
                                    },
                                    {
                                      label: "Download QR",
                                      icon: <QrCode className="mr-2 h-4 w-4" />,
                                      onClick: () => void downloadQr(table),
                                    },
                                    { label: "", onClick: () => {}, separator: true },
                                    {
                                      label: "Delete",
                                      icon: <Trash2 className="mr-2 h-4 w-4" />,
                                      destructive: true,
                                      onClick: () => {
                                        setDeleteError("");
                                        setDeleteTarget(table);
                                      },
                                    },
                                  ]}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {count > 0 ? (
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
                  ) : null}
                </>
              )}
            </div>
          </div>

          <aside className="print:hidden">
            {selected ? (
              <div className="sticky top-4 space-y-5 rounded-2xl border border-border/80 bg-card p-5 shadow-[var(--shadow-soft)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                      <QrCode className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold tracking-tight">
                        Table {selected.table_number}
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        {selected.seats} seats · {selected.is_active ? "Active" : "Inactive"}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="rounded-xl"
                    onClick={() => openEdit(selected)}
                    aria-label="Edit table"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>

                <div
                  className={cn(
                    "relative flex min-h-[260px] items-center justify-center rounded-2xl p-5",
                    selected.is_active
                      ? "bg-[radial-gradient(ellipse_at_center,var(--primary-soft),transparent_70%)]"
                      : "bg-muted/50",
                  )}
                >
                  {!selected.is_active ? (
                    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-background/70 backdrop-blur-[1px]">
                      <StatusBadge status="Inactive" />
                    </div>
                  ) : null}
                  {qrLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading QR…
                    </div>
                  ) : qrError ? (
                    <p className="px-4 text-center text-sm text-destructive">{qrError}</p>
                  ) : qrPreviewUrl ? (
                    <img
                      src={qrPreviewUrl}
                      alt={`QR for table ${selected.table_number}`}
                      className="h-[220px] w-[220px] rounded-xl bg-white p-2 shadow-[var(--shadow-soft)]"
                    />
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Guest order link
                  </p>
                  <p className="break-all rounded-xl bg-muted/50 px-3 py-2 font-mono text-[11px] text-muted-foreground">
                    {selected.qr_url}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => void copyUrl(selected.qr_url)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy link
                  </Button>
                  <Button type="button" size="sm" variant="outline" className="rounded-xl" asChild>
                    <a href={selected.qr_url} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open
                    </a>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-xl"
                    disabled={downloadingId === selected.public_id}
                    onClick={() => void downloadQr(selected)}
                  >
                    {downloadingId === selected.public_id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    Download QR
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => {
                      setDeleteError("");
                      setDeleteTarget(selected);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                </div>

                <p className="text-xs leading-relaxed text-muted-foreground">
                  Print this card and place it on the table. The QR URL is fixed when the table is
                  created and does not change on edit. Prefer deactivating a table to hide it; delete
                  permanently removes it.
                </p>
              </div>
            ) : (
              <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/80 bg-card/60 p-8 text-center">
                <QrCode className="h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">Select a table to preview its QR code.</p>
              </div>
            )}
          </aside>
        </div>

        <div className="hidden print:grid print:grid-cols-3 print:gap-6">
          {results
            .filter((t) => t.is_active)
            .map((t) => (
              <div
                key={t.public_id}
                className="flex flex-col items-center gap-2 border border-border p-4 text-center"
              >
                <p className="text-lg font-bold">Daawat · {t.table_number}</p>
                <img src={qrImageUrl(t.qr_url, 160)} alt="" className="h-40 w-40" />
                <p className="text-xs">Scan to order & pay</p>
              </div>
            ))}
        </div>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{editing ? `Edit ${editing.table_number}` : "Add table"}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="table_number">Table number</Label>
              <Input
                id="table_number"
                value={form.table_number}
                onChange={(e) => setForm((f) => ({ ...f, table_number: e.target.value }))}
                placeholder="e.g. table01"
                maxLength={64}
                className="rounded-xl"
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground">
                Unique label shown to guests. Max 64 characters.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="seats">Seats</Label>
              <Input
                id="seats"
                type="number"
                min={1}
                value={form.seats}
                onChange={(e) => setForm((f) => ({ ...f, seats: e.target.value }))}
                className="rounded-xl"
              />
              <div className="flex flex-wrap gap-2">
                {SEAT_PRESETS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, seats: String(n) }))}
                    className={cn(
                      "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                      form.seats === String(n)
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {n} seats
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border px-3 py-3">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-[11px] text-muted-foreground">Guests can scan and order</p>
              </div>
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
              />
            </div>

            {editing ? (
              <div className="space-y-1.5 rounded-xl bg-muted/50 px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  QR URL
                </p>
                <p className="break-all font-mono text-[11px] text-muted-foreground">
                  {editing.qr_url}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Read-only. Generated on create and never changes.
                </p>
              </div>
            ) : (
              <p className="rounded-xl bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                A unique QR code is generated automatically when you create the table.
              </p>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 rounded-xl"
                onClick={() => setSheetOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="flex-1 rounded-xl"
                onClick={() => void saveForm()}
                disabled={saving}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {editing ? "Save changes" : "Create table"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setDeleteError("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.table_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. Printed QR codes for this table will stop working. A table
              that already has bookings cannot be deleted — turn it off instead so it is not
              offered for new bookings. Existing bookings stay on the bookings list.
            </AlertDialogDescription>
            {deleteError ? (
              <p className="text-sm text-destructive">{deleteError}</p>
            ) : null}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatChip({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-border/80 bg-card px-4 py-3 shadow-[var(--shadow-soft)]">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
