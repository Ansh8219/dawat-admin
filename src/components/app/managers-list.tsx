import { useCallback, useEffect, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ChevronLeft, ChevronRight, Mail, Phone, RefreshCw, UserCog, UserPlus } from "lucide-react";
import { toast } from "sonner";
import {
  AccountStatusToggle,
  InactiveBadge,
  useIsSuperAdmin,
} from "@/components/app/account-status-toggle";
import { RowActions } from "@/components/app/row-actions";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  describeManagerPermissions,
  formatManagerPhone,
  listManagers,
  summarizeManagerModules,
  type ManagerListItem,
} from "@/lib/api/managers";
import {
  accountErrorMessage,
  classifyAccountError,
  deleteManager,
  MANAGER_IN_USE_MESSAGE,
  setAccountActive,
} from "@/lib/api/account-status";
import { ApiError } from "@/lib/api/types";
import { withAuthRetry } from "@/lib/api/with-auth";
import { cn } from "@/lib/utils";

const PAGE_SIZES = [10, 20, 50] as const;
const PENDING_TIP =
  "Manager has not logged in yet. The temporary password email may not have been delivered.";

function relativeTime(value: string | null): string {
  if (!value) return "Never";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return formatDistanceToNow(d, { addSuffix: true });
}

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function PermissionSummary({ permissions }: { permissions: string[] }) {
  const summary = summarizeManagerModules(permissions);
  const full = describeManagerPermissions(permissions);
  if (!summary) return <span className="text-xs text-muted-foreground">No permissions</span>;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className="cursor-default text-sm">
            {summary}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <ul className="space-y-0.5 text-xs">
            {full.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function StatusBadges({ m }: { m: ManagerListItem }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {m.invite_status === "pending" ? (
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                tabIndex={0}
                className="border-warning/40 bg-warning/15 text-warning"
              >
                Invite pending
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">{PENDING_TIP}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <Badge variant="outline" className="border-success/30 bg-success/15 text-success">
          Active
        </Badge>
      )}
      {m.is_active === false && <InactiveBadge />}
    </div>
  );
}

export function ManagersList({
  refreshKey,
  onAdd,
}: {
  /** Bump to reload from page 1 (e.g. after a manager is created). */
  refreshKey: number;
  onAdd?: () => void;
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [items, setItems] = useState<ManagerListItem[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadTick, setReloadTick] = useState(0);
  const lastRefreshKey = useRef(refreshKey);
  const canManage = useIsSuperAdmin();
  const [deleteTarget, setDeleteTarget] = useState<ManagerListItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [inUse, setInUse] = useState(false);

  const setActiveLocal = useCallback((id: string, isActive: boolean) => {
    setItems((prev) => prev.map((x) => (x.public_id === id ? { ...x, is_active: isActive } : x)));
  }, []);

  function closeDelete() {
    setDeleteTarget(null);
    setInUse(false);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleting(true);
    try {
      await withAuthRetry((token) => deleteManager(token, target.public_id));
      setItems((prev) => prev.filter((x) => x.public_id !== target.public_id));
      setCount((c) => Math.max(0, c - 1));
      toast.success("Manager deleted");
      closeDelete();
    } catch (err) {
      const type = classifyAccountError(err);
      if (type === "in_use") {
        setInUse(true); // keep dialog open, offer deactivate
      } else {
        toast.error(accountErrorMessage(type));
        if (type === "not_found") {
          closeDelete();
          setReloadTick((t) => t + 1);
        }
      }
    } finally {
      setDeleting(false);
    }
  }

  async function deactivateInstead() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleting(true);
    try {
      await withAuthRetry((token) => setAccountActive(token, "manager", target.public_id, false));
      setActiveLocal(target.public_id, false);
      toast.success(`${target.name || target.email} deactivated`);
      closeDelete();
    } catch (err) {
      const type = classifyAccountError(err);
      toast.error(accountErrorMessage(type));
      if (type === "not_found") {
        closeDelete();
        setReloadTick((t) => t + 1);
      }
    } finally {
      setDeleting(false);
    }
  }

  function renderControls(m: ManagerListItem) {
    if (!canManage) return null;
    return (
      <div className="flex items-center justify-end gap-2">
        <AccountStatusToggle
          kind="manager"
          publicId={m.public_id}
          name={m.name || m.email}
          isActive={m.is_active !== false}
          showLabel={false}
          onChanged={(v) => setActiveLocal(m.public_id, v)}
          onNotFound={() => setReloadTick((t) => t + 1)}
        />
        <RowActions
          items={[
            {
              label: "Delete manager",
              destructive: true,
              onClick: () => {
                setInUse(false);
                setDeleteTarget(m);
              },
            },
          ]}
        />
      </div>
    );
  }

  // New manager created → back to page 1.
  useEffect(() => {
    if (lastRefreshKey.current !== refreshKey) {
      lastRefreshKey.current = refreshKey;
      setPage(1);
      setReloadTick((t) => t + 1);
    }
  }, [refreshKey]);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError("");
    withAuthRetry((token) => listManagers(token, { page, page_size: pageSize }, ctrl.signal))
      .then((data) => {
        setItems(data.results ?? []);
        setCount(data.count ?? 0);
        const maxPage = Math.max(1, Math.ceil((data.count ?? 0) / pageSize));
        if (page > maxPage) setPage(maxPage);
      })
      .catch((err) => {
        if (ctrl.signal.aborted) return;
        setError(err instanceof ApiError ? err.message : "Unable to load managers.");
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [page, pageSize, reloadTick]);

  const retry = useCallback(() => setReloadTick((t) => t + 1), []);

  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  const safePage = Math.min(page, totalPages);
  const rangeStart = count === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safePage * pageSize, count);

  if (loading) {
    return (
      <div className="space-y-3 p-4" aria-busy="true" aria-label="Loading managers">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <div
          role="alert"
          className="max-w-md rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
        <Button type="button" variant="outline" className="rounded-xl" onClick={retry}>
          <RefreshCw className="mr-2 h-4 w-4" /> Try again
        </Button>
      </div>
    );
  }

  if (count === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-4 py-20 text-center text-muted-foreground">
        <UserCog className="h-10 w-10 opacity-40" />
        <p className="font-medium text-foreground">No managers yet</p>
        {onAdd && (
          <Button type="button" className="rounded-xl" onClick={onAdd}>
            <UserPlus className="mr-2 h-4 w-4" /> Add manager
          </Button>
        )}
      </div>
    );
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Manager</th>
              <th className="px-4 py-3 text-left font-medium">Phone</th>
              <th className="px-4 py-3 text-left font-medium">Permissions</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Last login</th>
              <th className="px-4 py-3 text-left font-medium">Created</th>
              {canManage && <th className="px-4 py-3 text-right font-medium">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((m) => (
              <tr key={m.public_id} className="border-b align-top">
                <td className="px-4 py-3">
                  <div className="font-medium">{m.name || "—"}</div>
                  <div className="text-xs text-muted-foreground">{m.email}</div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                  {formatManagerPhone(m)}
                </td>
                <td className="px-4 py-3">
                  <PermissionSummary permissions={m.permissions ?? []} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadges m={m} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                  {relativeTime(m.last_login)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                  {formatDate(m.created_at)}
                </td>
                {canManage && <td className="px-4 py-3">{renderControls(m)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="divide-y md:hidden">
        {items.map((m) => (
          <li key={m.public_id} className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-medium">{m.name || "—"}</div>
                <div className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                  <Mail className="h-3 w-3 shrink-0" /> {m.email}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Phone className="h-3 w-3 shrink-0" /> {formatManagerPhone(m)}
                </div>
              </div>
              <StatusBadges m={m} />
            </div>
            <PermissionSummary permissions={m.permissions ?? []} />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Last login: {relativeTime(m.last_login)}</span>
              <span>Created {formatDate(m.created_at)}</span>
            </div>
            {canManage && renderControls(m)}
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-2 border-t bg-muted/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>
            Showing <b className="text-foreground">{rangeStart}</b>–
            <b className="text-foreground">{rangeEnd}</b> of{" "}
            <b className="text-foreground">{count}</b>
          </span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => {
              setPageSize(Number(v));
              setPage(1);
            }}
          >
            <SelectTrigger className="h-8 w-[110px] rounded-xl text-xs" aria-label="Rows per page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((s) => (
                <SelectItem key={s} value={String(s)}>
                  {s} / page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          <span className={cn("text-xs text-muted-foreground")}>
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
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && !deleting && closeDelete()}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete manager?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `Delete ${deleteTarget.name || deleteTarget.email} permanently? This removes their account and permissions and cannot be undone. Consider deactivating instead.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {inUse && (
            <div
              role="alert"
              className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {MANAGER_IN_USE_MESSAGE}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            {inUse && (
              <Button
                type="button"
                variant="outline"
                disabled={deleting}
                onClick={() => void deactivateInstead()}
              >
                {deleting ? "Deactivating…" : "Deactivate instead"}
              </Button>
            )}
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
            >
              {deleting && !inUse ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
