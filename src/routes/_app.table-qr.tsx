import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Copy,
  Download,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  QrCode,
  RotateCcw,
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
  listTables,
  rotateTableQrToken,
  updateTable,
} from "@/lib/api/tables";
import { ApiError } from "@/lib/api/types";
import type { RestaurantTable } from "@/lib/api/types";
import { withAuthRetry } from "@/lib/api/with-auth";
import { useAuth } from "@/lib/auth";
import { ORDER_WEB_BASE_URL, qrImageUrl, tableOrderUrl } from "@/lib/order-web";
import { usePanel, usePanelMeta } from "@/lib/use-panel";
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

function TablesPage() {
  const navigate = useNavigate();
  const panel = usePanel();
  const meta = usePanelMeta();
  const business = useAuth((s) => s.business);
  const businessPublicId = business?.publicId ?? "biz_restaurant_local";

  const [results, setResults] = useState<RestaurantTable[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [rotating, setRotating] = useState(false);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<RestaurantTable | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<RestaurantTable | null>(null);
  const [deleting, setDeleting] = useState(false);

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
    async (options?: { showLoading?: boolean; keepSelection?: boolean }) => {
      const showLoading = options?.showLoading ?? false;
      if (showLoading) {
        setLoading(true);
        setLoadError("");
      }
      try {
        const data = await withAuthRetry((token) =>
          listTables(token, {
            business_public_id: businessPublicId,
            is_active: activeFilter === "all" ? undefined : activeFilter === "active",
          }),
        );
        setResults(data.results ?? []);
        setCount(data.count ?? 0);
        setSelectedId((prev) => {
          if (options?.keepSelection === false) return data.results[0]?.public_id ?? null;
          if (prev && data.results.some((t) => t.public_id === prev)) return prev;
          return data.results[0]?.public_id ?? null;
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
    [activeFilter, businessPublicId, handleAuthError],
  );

  useEffect(() => {
    if (panel !== "restaurant") return;
    void refresh({ showLoading: true });
  }, [panel, refresh]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return results;
    return results.filter(
      (t) =>
        t.table_number.toLowerCase().includes(needle) ||
        t.qr_token.toLowerCase().includes(needle),
    );
  }, [q, results]);

  const selected = useMemo(
    () => filtered.find((t) => t.public_id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId],
  );

  const activeCount = useMemo(() => results.filter((t) => t.is_active).length, [results]);
  const seatTotal = useMemo(() => results.reduce((sum, t) => sum + t.seats, 0), [results]);

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

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await withAuthRetry((token) => deleteTable(token, deleteTarget.public_id));
      toast.success(`${deleteTarget.table_number} deleted`);
      setDeleteTarget(null);
      await refresh({ showLoading: false });
    } catch (err) {
      if (handleAuthError(err)) return;
      toast.error(err instanceof ApiError ? err.message : "Unable to delete table");
    } finally {
      setDeleting(false);
    }
  }

  async function saveForm() {
    const tableNumber = form.table_number.trim();
    const seats = Number.parseInt(form.seats, 10);

    if (!tableNumber) {
      toast.error("Table number is required");
      return;
    }
    if (!Number.isFinite(seats) || seats < 1 || seats > 24) {
      toast.error("Seats must be between 1 and 24");
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
            business_public_id: businessPublicId,
            table_number: tableNumber,
            seats,
            is_active: form.is_active,
          }),
        );
        toast.success(`${created.table_number} created`);
        setSelectedId(created.public_id);
        await refresh({ showLoading: false, keepSelection: true });
      }
      setSheetOpen(false);
    } catch (err) {
      if (handleAuthError(err)) return;
      toast.error(err instanceof ApiError ? err.message : "Unable to save table");
    } finally {
      setSaving(false);
    }
  }

  async function rotateSelected() {
    if (!selected) return;
    setRotating(true);
    try {
      const updated = await withAuthRetry((token) =>
        rotateTableQrToken(token, selected.public_id),
      );
      setResults((prev) =>
        prev.map((r) => (r.public_id === selected.public_id ? { ...r, ...updated } : r)),
      );
      toast.success(`QR rotated for ${updated.table_number}`);
    } catch (err) {
      if (handleAuthError(err)) return;
      toast.error(err instanceof ApiError ? err.message : "Unable to rotate QR");
    } finally {
      setRotating(false);
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

  if (panel !== "restaurant") {
    return (
      <div className="flex min-h-full flex-col bg-muted/20">
        <PageHeader
          title="Tables"
          crumbs={["Operations", "Tables"]}
          description="Table QR ordering is available for the Restaurant panel."
        />
        <div className="p-6 text-sm text-muted-foreground">
          Switch to Restaurant to add tables and print guest QR codes.
        </div>
      </div>
    );
  }

  const selectedUrl = selected ? tableOrderUrl(selected.qr_token) : "";

  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <PageHeader
        title="Tables"
        crumbs={["Operations", "Tables"]}
        description={`Add restaurant tables and print QR codes for ${meta.label}. Guests scan, pay online, then kitchen receives the order.`}
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
          <StatChip label="Tables" value={String(results.length)} hint={activeFilter === "all" ? "In this list" : "Filtered"} />
          <StatChip label="QR active" value={String(activeCount)} hint="Ready for guests" />
          <StatChip label="Total seats" value={String(seatTotal)} hint="Across listed tables" />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] print:grid-cols-1">
          <div className="space-y-4 print:hidden">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search table number or token…"
                  className="h-10 rounded-xl bg-card pl-9"
                />
              </div>
              <Select value={activeFilter} onValueChange={(v) => setActiveFilter(v as ActiveFilter)}>
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
                    <p className="font-medium">{results.length === 0 ? "No tables yet" : "No matching tables"}</p>
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
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="border-b border-border/80 bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <th className="px-4 py-3">Table</th>
                        <th className="px-4 py-3">Seats</th>
                        <th className="px-4 py-3">Status</th>
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
                                  <div className="font-semibold tracking-tight">{table.table_number}</div>
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
                            <td className="max-w-[180px] truncate px-4 py-3 font-mono text-[11px] text-muted-foreground">
                              {table.qr_token}
                            </td>
                            <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                              <RowActions
                                items={[
                                  {
                                    label: "Edit",
                                    icon: <Pencil className="mr-2 h-4 w-4" />,
                                    onClick: () => openEdit(table),
                                  },
                                  {
                                    label: "View QR",
                                    icon: <QrCode className="mr-2 h-4 w-4" />,
                                    onClick: () => setSelectedId(table.public_id),
                                  },
                                  { label: "", onClick: () => {}, separator: true },
                                  {
                                    label: "Delete",
                                    icon: <Trash2 className="mr-2 h-4 w-4" />,
                                    destructive: true,
                                    onClick: () => setDeleteTarget(table),
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
                    "relative flex justify-center rounded-2xl p-5",
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
                  <img
                    src={qrImageUrl(selectedUrl, 220)}
                    alt={`QR for table ${selected.table_number}`}
                    className="h-[220px] w-[220px] rounded-xl bg-white p-2 shadow-[var(--shadow-soft)]"
                  />
                </div>

                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Guest order link
                  </p>
                  <p className="break-all rounded-xl bg-muted/50 px-3 py-2 font-mono text-[11px] text-muted-foreground">
                    {selectedUrl}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Hosted on {ORDER_WEB_BASE_URL.replace(/^https?:\/\//, "")}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => void copyUrl(selectedUrl)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy link
                  </Button>
                  <Button type="button" size="sm" variant="outline" className="rounded-xl" asChild>
                    <a href={selectedUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open
                    </a>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-xl"
                    disabled={rotating}
                    onClick={() => void rotateSelected()}
                  >
                    {rotating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="h-3.5 w-3.5" />
                    )}
                    Rotate token
                  </Button>
                </div>

                <p className="text-xs leading-relaxed text-muted-foreground">
                  Print this card and place it on the table. Rotating the token invalidates old printed
                  codes — reprint after rotating.
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

        {/* Printable grid of active tables */}
        <div className="hidden print:grid print:grid-cols-3 print:gap-6">
          {results
            .filter((t) => t.is_active)
            .map((t) => {
              const link = tableOrderUrl(t.qr_token);
              return (
                <div
                  key={t.public_id}
                  className="flex flex-col items-center gap-2 border border-border p-4 text-center"
                >
                  <p className="text-lg font-bold">Daawat · {t.table_number}</p>
                  <img src={qrImageUrl(link, 160)} alt="" className="h-40 w-40" />
                  <p className="text-xs">Scan to order & pay</p>
                </div>
              );
            })}
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
                placeholder="e.g. T04"
                className="rounded-xl"
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground">Shown to guests on the order screen.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="seats">Seats</Label>
              <Input
                id="seats"
                type="number"
                min={1}
                max={24}
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

            {!editing ? (
              <p className="rounded-xl bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                A unique QR token is generated automatically when you create the table.
              </p>
            ) : null}

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

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete table {deleteTarget?.table_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              Printed QR codes for this table will stop working. This cannot be undone.
            </AlertDialogDescription>
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
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
