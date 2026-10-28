import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { PageHeader } from "@/components/app/page-header";
import { RowActions, type RowActionItem } from "@/components/app/row-actions";
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
import { Textarea } from "@/components/ui/textarea";
import { apiFieldErrors } from "@/lib/api/client";
import {
  createRewardTier,
  deleteRewardTier,
  listRewardTiers,
  REWARD_TIER_DESCRIPTION_MAX,
  REWARD_TIER_KEY_MAX,
  REWARD_TIER_KEY_PATTERN,
  REWARD_TIER_NAME_MAX,
  suggestTierKey,
  updateRewardTier,
} from "@/lib/api/reward-tiers";
import { ApiError } from "@/lib/api/types";
import type { RewardTier, UpdateRewardTierPayload } from "@/lib/api/types";
import { withAuthRetry } from "@/lib/api/with-auth";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/customer-levels")({
  component: CustomerLevelsPage,
  head: () => ({ meta: [{ title: "Customer Levels — Daawat Baker's" }] }),
});

type FormField = "name" | "key" | "min_lifetime_coins" | "description";
type FieldErrors = Partial<Record<FormField, string>>;

type FormState = {
  name: string;
  key: string;
  min_lifetime_coins: string;
  description: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  key: "",
  min_lifetime_coins: "",
  description: "",
};

const FIELD_ERROR_BY_CODE: Record<string, { field: FormField; message: string }> = {
  reward_tier_key_taken: { field: "key", message: "A level with this key already exists." },
  reward_tier_threshold_taken: {
    field: "min_lifetime_coins",
    message: "Another level already starts at this many coins.",
  },
  reward_tier_base_threshold_locked: {
    field: "min_lifetime_coins",
    message: "The starting level must stay at 0 coins.",
  },
};

const DELETE_ERROR_BY_CODE: Record<string, string> = {
  reward_tier_base_protected: "The starting level cannot be deleted.",
  reward_tier_in_use: "Customers are on this level, so it cannot be deleted.",
};

const NOT_FOUND_MESSAGE = "Level not found.";

function formatCoins(n: number): string {
  return n.toLocaleString("en-IN");
}

function validate(form: FormState, isBase: boolean): FieldErrors {
  const errors: FieldErrors = {};
  const name = form.name.trim();
  const key = form.key.trim();
  const description = form.description.trim();

  if (!name) errors.name = "Name is required.";
  else if (name.length > REWARD_TIER_NAME_MAX)
    errors.name = `Name must be at most ${REWARD_TIER_NAME_MAX} characters.`;

  if (!key) errors.key = "Key is required.";
  else if (key.length > REWARD_TIER_KEY_MAX)
    errors.key = `Key must be at most ${REWARD_TIER_KEY_MAX} characters.`;
  else if (!REWARD_TIER_KEY_PATTERN.test(key))
    errors.key = "Use lowercase letters, numbers and underscores, starting with a letter.";

  if (!isBase) {
    const raw = form.min_lifetime_coins.trim();
    const coins = Number(raw);
    if (!raw) errors.min_lifetime_coins = "Coins are required.";
    else if (!Number.isInteger(coins) || coins < 0)
      errors.min_lifetime_coins = "Enter a whole number of 0 or more.";
  }

  if (description.length > REWARD_TIER_DESCRIPTION_MAX)
    errors.description = `Description must be at most ${REWARD_TIER_DESCRIPTION_MAX} characters.`;

  return errors;
}

function CustomerLevelsPage() {
  const navigate = useNavigate();
  const [levels, setLevels] = useState<RewardTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<RewardTier | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [keyTouched, setKeyTouched] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [reassignConfirmOpen, setReassignConfirmOpen] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<RewardTier | null>(null);
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
    async (options?: { showLoading?: boolean }) => {
      const showLoading = options?.showLoading ?? false;
      if (showLoading) {
        setLoading(true);
        setLoadError("");
      }
      try {
        const data = await withAuthRetry((token) => listRewardTiers(token));
        setLevels(data.results ?? []);
      } catch (err) {
        if (handleAuthError(err)) return;
        const message = err instanceof ApiError ? err.message : "Unable to load levels.";
        if (showLoading) setLoadError(message);
        else toast.error(message);
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [handleAuthError],
  );

  useEffect(() => {
    void refresh({ showLoading: true });
  }, [refresh]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setKeyTouched(false);
    setFieldErrors({});
    setSheetOpen(true);
  }

  function openEdit(level: RewardTier) {
    setEditing(level);
    setForm({
      name: level.name,
      key: level.key,
      min_lifetime_coins: String(level.min_lifetime_coins),
      description: level.description ?? "",
    });
    setKeyTouched(true);
    setFieldErrors({});
    setSheetOpen(true);
  }

  function setField(field: FormField, value: string) {
    const autoKey = field === "name" && !editing && !keyTouched;
    setForm((f) => {
      const next = { ...f, [field]: value };
      if (autoKey) next.key = suggestTierKey(value);
      return next;
    });
    setFieldErrors((e) => {
      const next = { ...e };
      delete next[field];
      if (autoKey) delete next.key;
      return next;
    });
  }

  function buildPatch(level: RewardTier): UpdateRewardTierPayload {
    const patch: UpdateRewardTierPayload = {};
    const name = form.name.trim();
    const key = form.key.trim();
    const description = form.description.trim();
    if (name !== level.name) patch.name = name;
    if (key !== level.key) patch.key = key;
    if (!level.is_base) {
      const coins = Number(form.min_lifetime_coins.trim());
      if (coins !== level.min_lifetime_coins) patch.min_lifetime_coins = coins;
    }
    const original = level.description ?? "";
    if (description !== original) patch.description = description || null;
    return patch;
  }

  function submitForm() {
    const isBase = editing?.is_base ?? false;
    const errors = validate(form, isBase);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const reassigns = editing ? buildPatch(editing).min_lifetime_coins !== undefined : true;
    if (reassigns) {
      setReassignConfirmOpen(true);
      return;
    }
    void saveForm();
  }

  async function saveForm() {
    setReassignConfirmOpen(false);
    setSaving(true);
    try {
      if (editing) {
        const patch = buildPatch(editing);
        if (Object.keys(patch).length === 0) {
          setSheetOpen(false);
          return;
        }
        const updated = await withAuthRetry((token) =>
          updateRewardTier(token, editing.public_id, patch),
        );
        toast.success(`${updated.name} updated`);
      } else {
        const description = form.description.trim();
        const created = await withAuthRetry((token) =>
          createRewardTier(token, {
            name: form.name.trim(),
            key: form.key.trim(),
            min_lifetime_coins: Number(form.min_lifetime_coins.trim()),
            ...(description ? { description } : {}),
          }),
        );
        toast.success(`${created.name} created`);
      }
      setSheetOpen(false);
      await refresh({ showLoading: false });
    } catch (err) {
      if (handleAuthError(err)) return;
      if (err instanceof ApiError) {
        if (err.code === "reward_tier_not_found") {
          toast.error(NOT_FOUND_MESSAGE);
          setSheetOpen(false);
          await refresh({ showLoading: false });
          return;
        }
        const mapped = FIELD_ERROR_BY_CODE[err.code];
        if (mapped) {
          setFieldErrors((e) => ({ ...e, [mapped.field]: mapped.message }));
          return;
        }
        const fromApi = apiFieldErrors(err);
        const inline: FieldErrors = {};
        let hasOther = false;
        for (const [field, message] of Object.entries(fromApi)) {
          if (field in EMPTY_FORM) inline[field as FormField] = message;
          else hasOther = true;
        }
        if (Object.keys(inline).length > 0) setFieldErrors(inline);
        if (hasOther || Object.keys(inline).length === 0) toast.error(err.message);
        return;
      }
      toast.error("Unable to save level");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await withAuthRetry((token) => deleteRewardTier(token, deleteTarget.public_id));
      toast.success(`${deleteTarget.name} deleted`);
      setDeleteTarget(null);
      await refresh({ showLoading: false });
    } catch (err) {
      if (handleAuthError(err)) return;
      if (err instanceof ApiError && err.code === "reward_tier_not_found") {
        toast.error(NOT_FOUND_MESSAGE);
        setDeleteTarget(null);
        await refresh({ showLoading: false });
        return;
      }
      if (err instanceof ApiError && DELETE_ERROR_BY_CODE[err.code]) {
        toast.error(DELETE_ERROR_BY_CODE[err.code]);
        setDeleteTarget(null);
        return;
      }
      toast.error(err instanceof ApiError ? err.message : "Unable to delete level");
    } finally {
      setDeleting(false);
    }
  }

  const isBaseEditing = editing?.is_base ?? false;

  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <PageHeader
        title="Customer Levels"
        crumbs={["Growth", "Customer Levels"]}
        description="Levels customers unlock as they earn lifetime coins. Every new customer starts on the starting level."
        action={
          <Button type="button" onClick={openCreate} className="rounded-xl">
            <Plus className="mr-1.5 h-4 w-4" />
            Add level
          </Button>
        }
      />

      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6 lg:p-8">
        <p className="text-sm text-muted-foreground">
          {levels.length} level{levels.length === 1 ? "" : "s"}
        </p>

        <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-[var(--shadow-soft)]">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading levels…
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
          ) : levels.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              No levels yet. Add one to start rewarding customers.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border/80 bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Key</th>
                    <th className="px-4 py-3 text-right">Unlocks at (coins)</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {levels.map((level) => {
                    const actions: RowActionItem[] = [
                      {
                        label: "Edit",
                        icon: <Pencil className="mr-2 h-3.5 w-3.5" />,
                        onClick: () => openEdit(level),
                      },
                    ];
                    if (!level.is_base) {
                      actions.push(
                        { separator: true, label: "", onClick: () => {} },
                        {
                          label: "Delete",
                          destructive: true,
                          icon: <Trash2 className="mr-2 h-3.5 w-3.5" />,
                          onClick: () => setDeleteTarget(level),
                        },
                      );
                    }
                    return (
                      <tr
                        key={level.public_id}
                        className="border-b border-border/60 last:border-0 hover:bg-muted/30"
                      >
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-foreground">{level.name}</span>
                            {level.is_base ? (
                              <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                                Starting level
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">
                            {level.key}
                          </code>
                        </td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums">
                          {formatCoins(level.min_lifetime_coins)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          <div className="line-clamp-2 max-w-[320px] text-xs">
                            {level.description || "—"}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <RowActions items={actions} />
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

      <Sheet
        open={sheetOpen}
        onOpenChange={(open) => {
          if (!saving) setSheetOpen(open);
        }}
      >
        <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
          <SheetHeader className="border-b px-6 py-4 text-left">
            <SheetTitle>{editing ? "Edit level" : "Add level"}</SheetTitle>
          </SheetHeader>

          <form
            className="flex flex-1 flex-col overflow-hidden"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              submitForm();
            }}
          >
            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
              <FormRow id="lvl-name" label="Name" error={fieldErrors.name}>
                <Input
                  id="lvl-name"
                  value={form.name}
                  maxLength={REWARD_TIER_NAME_MAX}
                  onChange={(e) => setField("name", e.target.value)}
                  placeholder="Elite+"
                  aria-invalid={!!fieldErrors.name}
                  className={cn("rounded-xl", fieldErrors.name && "border-destructive")}
                />
              </FormRow>

              <FormRow
                id="lvl-key"
                label="Key"
                error={fieldErrors.key}
                hint={
                  <>
                    Lowercase letters, numbers and underscores, starting with a letter (e.g.{" "}
                    <code>elite_plus</code>).
                  </>
                }
              >
                <Input
                  id="lvl-key"
                  value={form.key}
                  maxLength={REWARD_TIER_KEY_MAX}
                  onChange={(e) => {
                    setKeyTouched(true);
                    setField("key", e.target.value.toLowerCase());
                  }}
                  placeholder="elite_plus"
                  aria-invalid={!!fieldErrors.key}
                  className={cn(
                    "rounded-xl font-mono text-sm",
                    fieldErrors.key && "border-destructive",
                  )}
                />
              </FormRow>

              <FormRow
                id="lvl-coins"
                label="Unlocks at (lifetime coins)"
                error={fieldErrors.min_lifetime_coins}
                hint={isBaseEditing ? "The starting level always unlocks at 0 coins." : undefined}
              >
                <Input
                  id="lvl-coins"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  value={isBaseEditing ? "0" : form.min_lifetime_coins}
                  disabled={isBaseEditing}
                  onChange={(e) => setField("min_lifetime_coins", e.target.value)}
                  placeholder="2000"
                  aria-invalid={!!fieldErrors.min_lifetime_coins}
                  className={cn(
                    "rounded-xl",
                    fieldErrors.min_lifetime_coins && "border-destructive",
                  )}
                />
              </FormRow>

              <FormRow
                id="lvl-description"
                label={
                  <>
                    Description{" "}
                    <span className="font-normal text-muted-foreground">(optional)</span>
                  </>
                }
                error={fieldErrors.description}
                hint={`${form.description.trim().length}/${REWARD_TIER_DESCRIPTION_MAX}`}
              >
                <Textarea
                  id="lvl-description"
                  value={form.description}
                  maxLength={REWARD_TIER_DESCRIPTION_MAX}
                  onChange={(e) => setField("description", e.target.value)}
                  placeholder="Top foodies"
                  aria-invalid={!!fieldErrors.description}
                  className={cn(
                    "min-h-[80px] rounded-xl",
                    fieldErrors.description && "border-destructive",
                  )}
                />
              </FormRow>
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
              <Button type="submit" className="rounded-xl" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : editing ? (
                  "Save changes"
                ) : (
                  "Create level"
                )}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={reassignConfirmOpen}
        onOpenChange={(open) => !open && setReassignConfirmOpen(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {editing ? "Change coins threshold?" : "Create level?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Customers will be moved to the matching level based on their lifetime coins.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void saveForm();
              }}
            >
              {editing ? "Save changes" : "Create level"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete level?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes{" "}
              <span className="font-medium text-foreground">{deleteTarget?.name}</span>. Levels that
              customers are on cannot be deleted.
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

function FormRow({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p className="text-[11px] font-medium text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
