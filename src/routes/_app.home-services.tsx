import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createHomeService,
  deleteHomeService,
  HOME_SERVICE_KEY_PATTERN,
  listHomeServices,
  updateHomeService,
} from "@/lib/api/home-services";
import { ApiError } from "@/lib/api/types";
import type { HomeService } from "@/lib/api/types";
import { withAuthRetry } from "@/lib/api/with-auth";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { ImagePlus, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/home-services")({
  component: HomeServicesPage,
  head: () => ({ meta: [{ title: "Home Services — Daawat Baker's" }] }),
});

type ActiveFilter = "all" | "active" | "inactive";

type FormState = {
  key: string;
  name: string;
  description: string;
  sort_order: string;
  is_active: boolean;
};

const EMPTY_FORM: FormState = {
  key: "",
  name: "",
  description: "",
  sort_order: "0",
  is_active: true,
};

function HomeServicesPage() {
  const navigate = useNavigate();
  const [results, setResults] = useState<HomeService[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HomeService | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<HomeService | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    async (options?: { showLoading?: boolean }) => {
      const showLoading = options?.showLoading ?? false;
      if (showLoading) {
        setLoading(true);
        setLoadError("");
      }
      try {
        const data = await withAuthRetry((token) =>
          listHomeServices(token, {
            is_active:
              activeFilter === "all" ? undefined : activeFilter === "active",
          }),
        );
        setResults(data.results ?? []);
        setCount(data.count ?? 0);
      } catch (err) {
        if (handleAuthError(err)) return;
        const message = err instanceof ApiError ? err.message : "Unable to load home services.";
        if (showLoading) setLoadError(message);
        else toast.error(message);
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [activeFilter, handleAuthError],
  );

  useEffect(() => {
    void refresh({ showLoading: true });
  }, [refresh]);

  useEffect(() => {
    return () => {
      if (imagePreview?.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const sorted = useMemo(
    () => [...results].sort((a, b) => a.sort_order - b.sort_order),
    [results],
  );

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setImageFile(null);
    setImagePreview(null);
    setSheetOpen(true);
  }

  function openEdit(item: HomeService) {
    setEditing(item);
    setForm({
      key: item.key,
      name: item.name,
      description: item.description ?? "",
      sort_order: String(item.sort_order ?? 0),
      is_active: item.is_active,
    });
    setImageFile(null);
    setImagePreview(item.image);
    setSheetOpen(true);
  }

  function onPickImage(file: File | null) {
    if (imagePreview?.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
    if (!file) {
      setImageFile(null);
      setImagePreview(editing?.image ?? null);
      return;
    }
    if (!/^image\/(jpeg|png)$/i.test(file.type) && !/\.(jpe?g|png)$/i.test(file.name)) {
      toast.error("Image must be JPEG or PNG");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function toggleActive(item: HomeService, next: boolean) {
    setTogglingId(item.public_id);
    try {
      const updated = await withAuthRetry((token) =>
        updateHomeService(token, item.public_id, { is_active: next }),
      );
      setResults((prev) => {
        const nextList = prev.map((r) =>
          r.public_id === item.public_id ? { ...r, ...updated } : r,
        );
        if (activeFilter === "active" && !next) {
          return nextList.filter((r) => r.public_id !== item.public_id);
        }
        if (activeFilter === "inactive" && next) {
          return nextList.filter((r) => r.public_id !== item.public_id);
        }
        return nextList;
      });
      setCount((c) => {
        if (activeFilter === "active" && !next) return Math.max(0, c - 1);
        if (activeFilter === "inactive" && next) return Math.max(0, c - 1);
        return c;
      });
      toast.success(next ? `${item.name} activated` : `${item.name} deactivated`);
    } catch (err) {
      if (handleAuthError(err)) return;
      toast.error(err instanceof ApiError ? err.message : "Unable to update service");
    } finally {
      setTogglingId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await withAuthRetry((token) => deleteHomeService(token, deleteTarget.public_id));
      toast.success(`${deleteTarget.name} deleted`);
      setDeleteTarget(null);
      await refresh({ showLoading: false });
    } catch (err) {
      if (handleAuthError(err)) return;
      toast.error(err instanceof ApiError ? err.message : "Unable to delete service");
    } finally {
      setDeleting(false);
    }
  }

  async function saveForm() {
    const key = form.key.trim();
    const name = form.name.trim();
    const description = form.description.trim();
    const sortOrder = Number.parseInt(form.sort_order, 10);

    if (!name) {
      toast.error("Name is required");
      return;
    }
    if (!HOME_SERVICE_KEY_PATTERN.test(key)) {
      toast.error("Key must match a-z, then a-z / 0-9 / _ (e.g. bakery)");
      return;
    }
    if (!Number.isFinite(sortOrder)) {
      toast.error("Sort order must be a number");
      return;
    }
    if (!editing && !imageFile) {
      toast.error("Image is required");
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        const updated = await withAuthRetry((token) =>
          updateHomeService(
            token,
            editing.public_id,
            {
              key,
              name,
              description,
              sort_order: sortOrder,
              is_active: form.is_active,
            },
            imageFile,
          ),
        );
        setResults((prev) =>
          prev.map((r) => (r.public_id === editing.public_id ? { ...r, ...updated } : r)),
        );
        toast.success(`${updated.name} updated`);
      } else {
        const created = await withAuthRetry((token) =>
          createHomeService(
            token,
            {
              key,
              name,
              description: description || undefined,
              sort_order: sortOrder,
              is_active: form.is_active,
            },
            imageFile!,
          ),
        );
        toast.success(`${created.name} created`);
        await refresh({ showLoading: false });
      }
      setSheetOpen(false);
    } catch (err) {
      if (handleAuthError(err)) return;
      toast.error(err instanceof ApiError ? err.message : "Unable to save home service");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <PageHeader
        title="Home Services"
        crumbs={["Admin", "Home Services"]}
        description="Manage customer-app home tiles (image, key, sort order, active state)."
        action={
          <Button type="button" onClick={openCreate} className="rounded-xl">
            <Plus className="mr-1.5 h-4 w-4" />
            Add service
          </Button>
        }
      />

      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Select
            value={activeFilter}
            onValueChange={(v) => setActiveFilter(v as ActiveFilter)}
          >
            <SelectTrigger className="h-9 w-[180px] rounded-xl bg-card">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All services</SelectItem>
              <SelectItem value="active">Active only</SelectItem>
              <SelectItem value="inactive">Inactive only</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            {count} service{count === 1 ? "" : "s"}
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-[var(--shadow-soft)]">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading home services…
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
          ) : sorted.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              No home services yet. Add one to show tiles on the customer app.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border/80 bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">Image</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Key</th>
                    <th className="px-4 py-3">Sort</th>
                    <th className="px-4 py-3">Active</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((item) => (
                    <tr
                      key={item.public_id}
                      className="border-b border-border/60 last:border-0 hover:bg-muted/30"
                    >
                      <td className="px-4 py-3">
                        <div className="h-12 w-12 overflow-hidden rounded-xl border border-border/70 bg-muted">
                          {item.image ? (
                            <img
                              src={item.image}
                              alt={item.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="grid h-full place-items-center text-[10px] text-muted-foreground">
                              N/A
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{item.name}</div>
                        {item.description ? (
                          <div className="mt-0.5 line-clamp-1 max-w-[240px] text-xs text-muted-foreground">
                            {item.description}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">
                          {item.key}
                        </code>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">
                        {item.sort_order}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={item.is_active}
                            disabled={togglingId === item.public_id}
                            onCheckedChange={(checked) => void toggleActive(item, checked)}
                            aria-label={`Toggle ${item.name}`}
                          />
                          <StatusBadge status={item.is_active ? "Active" : "Inactive"} />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <RowActions
                          items={[
                            {
                              label: "Edit",
                              icon: <Pencil className="mr-2 h-3.5 w-3.5" />,
                              onClick: () => openEdit(item),
                            },
                            { separator: true, label: "", onClick: () => {} },
                            {
                              label: "Delete",
                              destructive: true,
                              icon: <Trash2 className="mr-2 h-3.5 w-3.5" />,
                              onClick: () => setDeleteTarget(item),
                            },
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Sheet
        open={sheetOpen}
        onOpenChange={(open) => {
          if (!saving) setSheetOpen(open);
        }}
      >
        <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
          <SheetHeader className="border-b px-6 py-4 text-left">
            <SheetTitle>{editing ? "Edit home service" : "Add home service"}</SheetTitle>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
            <div className="space-y-1.5">
              <Label htmlFor="hs-name">Name</Label>
              <Input
                id="hs-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Bakery"
                className="rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="hs-key">Key</Label>
              <Input
                id="hs-key"
                value={form.key}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""),
                  }))
                }
                placeholder="bakery"
                className="rounded-xl font-mono text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                Unique slug for app routing later. Pattern: <code>^[a-z][a-z0-9_]*$</code>
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="hs-description">Description</Label>
              <Textarea
                id="hs-description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Optional short description"
                className="min-h-[80px] rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="hs-sort">Sort order</Label>
                <Input
                  id="hs-sort"
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Active</Label>
                <div className="flex h-9 items-center gap-2 rounded-xl border border-input px-3">
                  <Switch
                    checked={form.is_active}
                    onCheckedChange={(checked) =>
                      setForm((f) => ({ ...f, is_active: checked }))
                    }
                  />
                  <span className="text-sm text-muted-foreground">
                    {form.is_active ? "Visible" : "Hidden"}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>
                Image {editing ? <span className="font-normal text-muted-foreground">(optional)</span> : null}
              </Label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 p-3 text-left transition-colors hover:bg-muted/50",
                )}
              >
                <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-border/70 bg-card">
                  {imagePreview ? (
                    <img src={imagePreview} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ImagePlus className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium">
                    {imageFile?.name ?? (editing ? "Replace image" : "Upload JPEG or PNG")}
                  </div>
                  <div className="text-xs text-muted-foreground">Click to choose a file</div>
                </div>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                className="hidden"
                onChange={(e) => onPickImage(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t px-6 py-4">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              disabled={saving}
              onClick={() => setSheetOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" className="rounded-xl" disabled={saving} onClick={() => void saveForm()}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : editing ? (
                "Save changes"
              ) : (
                "Create service"
              )}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete home service?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes{" "}
              <span className="font-medium text-foreground">{deleteTarget?.name}</span>. Prefer
              deactivating if you only want to hide it from the app.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
