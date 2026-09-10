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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createMenuCategory,
  deleteMenuCategory,
  listMenuCategories,
  updateMenuCategory,
} from "@/lib/api/menu-categories";
import { ApiError } from "@/lib/api/types";
import type { MenuCategory } from "@/lib/api/types";
import { withAuthRetry } from "@/lib/api/with-auth";
import { useAuth } from "@/lib/auth";
import { usePanelMeta } from "@/lib/use-panel";
import { cn } from "@/lib/utils";
import { ImagePlus, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/menu-categories")({
  component: MenuCategoriesPage,
  head: () => ({ meta: [{ title: "Menu Categories — Daawat Baker's" }] }),
});

type ActiveFilter = "all" | "active" | "inactive";

type FormState = {
  name: string;
  sort_order: string;
  is_active: boolean;
};

const EMPTY_FORM: FormState = {
  name: "",
  sort_order: "0",
  is_active: true,
};

function MenuCategoriesPage() {
  const navigate = useNavigate();
  const meta = usePanelMeta();
  const business = useAuth((s) => s.business);
  const businessPublicId = business?.publicId ?? null;

  const [results, setResults] = useState<MenuCategory[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MenuCategory | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<MenuCategory | null>(null);
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
      if (!businessPublicId) {
        if (showLoading) {
          setLoadError("No business selected. Please choose a business first.");
          setLoading(false);
        }
        return;
      }
      if (showLoading) {
        setLoading(true);
        setLoadError("");
      }
      try {
        const data = await withAuthRetry((token) =>
          listMenuCategories(token, {
            business_public_id: businessPublicId,
            is_active: activeFilter === "all" ? undefined : activeFilter === "active",
          }),
        );
        setResults(data.results ?? []);
        setCount(data.count ?? 0);
      } catch (err) {
        if (handleAuthError(err)) return;
        const message = err instanceof ApiError ? err.message : "Unable to load menu categories.";
        if (showLoading) setLoadError(message);
        else toast.error(message);
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [activeFilter, businessPublicId, handleAuthError],
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
    () => [...results].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
    [results],
  );

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setImageFile(null);
    setImagePreview(null);
    setSheetOpen(true);
  }

  function openEdit(item: MenuCategory) {
    setEditing(item);
    setForm({
      name: item.name,
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

  async function toggleActive(item: MenuCategory, next: boolean) {
    setTogglingId(item.public_id);
    try {
      const updated = await withAuthRetry((token) =>
        updateMenuCategory(token, item.public_id, { is_active: next }),
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
      toast.error(err instanceof ApiError ? err.message : "Unable to update category");
    } finally {
      setTogglingId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await withAuthRetry((token) => deleteMenuCategory(token, deleteTarget.public_id));
      toast.success(`${deleteTarget.name} deleted`);
      setDeleteTarget(null);
      await refresh({ showLoading: false });
    } catch (err) {
      if (handleAuthError(err)) return;
      toast.error(err instanceof ApiError ? err.message : "Unable to delete category");
    } finally {
      setDeleting(false);
    }
  }

  async function saveForm() {
    if (!businessPublicId) {
      toast.error("No business selected");
      return;
    }
    const name = form.name.trim();
    const sortOrder = Number.parseInt(form.sort_order, 10);

    if (!name) {
      toast.error("Name is required");
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
          updateMenuCategory(
            token,
            editing.public_id,
            {
              name,
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
          createMenuCategory(
            token,
            {
              business_public_id: businessPublicId,
              name,
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
      toast.error(err instanceof ApiError ? err.message : "Unable to save category");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <PageHeader
        title="Menu Categories"
        crumbs={["Operations", "Menu Categories"]}
        description={`Organize ${meta.label} menu sections with images, sort order, and active state.`}
        action={
          <Button type="button" onClick={openCreate} className="rounded-xl">
            <Plus className="mr-1.5 h-4 w-4" />
            Add category
          </Button>
        }
      />

      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Select value={activeFilter} onValueChange={(v) => setActiveFilter(v as ActiveFilter)}>
            <SelectTrigger className="h-9 w-[180px] rounded-xl bg-card">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              <SelectItem value="active">Active only</SelectItem>
              <SelectItem value="inactive">Inactive only</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            {count} categor{count === 1 ? "y" : "ies"}
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-[var(--shadow-soft)]">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading menu categories…
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
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <p className="max-w-md text-sm text-muted-foreground">
                No menu categories yet. Create categories here before adding items on the Menu page.
              </p>
              <Button type="button" className="rounded-xl" onClick={openCreate}>
                <Plus className="mr-1.5 h-4 w-4" />
                Create first category
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border/80 bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">Image</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Items</th>
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
                        {item.menu_type ? (
                          <div className="mt-0.5 text-xs capitalize text-muted-foreground">
                            {item.menu_type.replace(/_/g, " ")}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">
                        {item.item_count}
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
            <SheetTitle>{editing ? "Edit menu category" : "Add menu category"}</SheetTitle>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
            <div className="space-y-1.5">
              <Label htmlFor="mc-name">Name</Label>
              <Input
                id="mc-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Pizza"
                className="rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="mc-sort">Sort order</Label>
                <Input
                  id="mc-sort"
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
                    onCheckedChange={(checked) => setForm((f) => ({ ...f, is_active: checked }))}
                  />
                  <span className="text-sm text-muted-foreground">
                    {form.is_active ? "Visible" : "Hidden"}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>
                Image{" "}
                {editing ? (
                  <span className="font-normal text-muted-foreground">(optional)</span>
                ) : null}
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
                  <div className="text-xs text-muted-foreground">
                    {editing ? "Optional on update" : "Required for new categories"}
                  </div>
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
            <Button
              type="button"
              className="rounded-xl"
              disabled={saving}
              onClick={() => void saveForm()}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : editing ? (
                "Save changes"
              ) : (
                "Create category"
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
            <AlertDialogTitle>Delete menu category?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes{" "}
              <span className="font-medium text-foreground">{deleteTarget?.name}</span>
              {deleteTarget && deleteTarget.item_count > 0
                ? `. It currently has ${deleteTarget.item_count} menu item${deleteTarget.item_count === 1 ? "" : "s"} — delete will fail until those are moved.`
                : ". Prefer deactivating if you only want to hide it."}
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
