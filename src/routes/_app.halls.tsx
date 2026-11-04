import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Landmark, Loader2, Pencil, Plus, Power, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  deleteHall,
  HALL_CATEGORY_LABELS,
  listHalls,
  updateHall,
  type Hall,
} from "@/lib/api/halls";
import { ApiError } from "@/lib/api/types";
import { withAuthRetry } from "@/lib/api/with-auth";
import { useAccess } from "@/lib/access";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/halls")({
  component: HallsPage,
  head: () => ({ meta: [{ title: "Halls — Daawat Baker's" }] }),
});

export function formatRupees(v: string) {
  const n = Number(v);
  return Number.isFinite(n)
    ? `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
    : `₹${v}`;
}

function HallsPage() {
  const navigate = useNavigate();
  const { canManage } = useAccess();
  const manage = canManage("halls");
  const [halls, setHalls] = useState<Hall[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Hall | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [hasBookings, setHasBookings] = useState(false);

  const handleAuth = useCallback(
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

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setHalls(await withAuthRetry((t) => listHalls(t)));
    } catch (err) {
      if (handleAuth(err)) return;
      setError(err instanceof ApiError ? err.message : "Unable to load halls.");
    } finally {
      setLoading(false);
    }
  }, [handleAuth]);

  useEffect(() => {
    void load();
  }, [load]);

  async function setActive(h: Hall, next: boolean) {
    setTogglingId(h.public_id);
    try {
      const updated = await withAuthRetry((t) => updateHall(t, h.public_id, { is_active: next }));
      setHalls((prev) =>
        prev.map((x) => (x.public_id === h.public_id ? { ...x, is_active: updated.is_active } : x)),
      );
      toast.success(next ? `${h.name} activated` : `${h.name} deactivated`);
    } catch (err) {
      if (handleAuth(err)) return;
      toast.error(err instanceof ApiError ? err.message : "Unable to update hall.");
    } finally {
      setTogglingId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleting(true);
    try {
      await withAuthRetry((t) => deleteHall(t, target.public_id));
      toast.success(`${target.name} deleted`);
      setDeleteTarget(null);
      setHalls((prev) => prev.filter((h) => h.public_id !== target.public_id));
    } catch (err) {
      if (handleAuth(err)) return;
      if (err instanceof ApiError && err.code === "hall_has_bookings") {
        setHasBookings(true);
      } else {
        toast.error(err instanceof ApiError ? err.message : "Unable to delete hall.");
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Halls"
        crumbs={["Banquet", "Halls"]}
        description="Create and manage banquet and kitty-party halls."
        actionModule="halls"
        action={
          <Button asChild>
            <Link to="/halls/new">
              <Plus className="mr-2 h-4 w-4" /> Add Hall
            </Link>
          </Button>
        }
      />
      <div className="p-4 sm:p-6 lg:p-8">
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-2xl" />
            ))}
          </div>
        ) : error ? (
          <EmptyState
            icon={Landmark}
            title="Couldn't load halls"
            description={error}
            action={<Button onClick={() => void load()}>Try again</Button>}
          />
        ) : halls.length === 0 ? (
          <EmptyState
            icon={Landmark}
            title="No halls yet"
            description="Add your first hall to start taking bookings."
            action={
              manage ? (
                <Button asChild>
                  <Link to="/halls/new">Add Hall</Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="space-y-3">
            {halls.map((h) => (
              <li
                key={h.public_id}
                className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center"
              >
                <div className="h-20 w-full shrink-0 overflow-hidden rounded-xl bg-muted sm:w-32">
                  {h.images[0]?.url ? (
                    <img
                      src={h.images[0].url}
                      alt={h.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="grid h-full place-items-center text-muted-foreground">
                      <Landmark className="h-6 w-6" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to="/halls/$hallId"
                      params={{ hallId: h.public_id }}
                      className="truncate font-semibold hover:underline"
                    >
                      {h.name}
                    </Link>
                    <Badge variant="secondary">
                      {HALL_CATEGORY_LABELS[h.category] ?? h.category}
                    </Badge>
                    {!h.is_active && <Badge variant="outline">Inactive</Badge>}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {h.min_guests}–{h.max_guests} guests · Advance {formatRupees(h.advance_amount)}{" "}
                    · Sort {h.sort_order}
                  </div>
                </div>
                {manage && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Switch
                      aria-label={h.is_active ? "Deactivate" : "Activate"}
                      checked={h.is_active}
                      disabled={togglingId === h.public_id}
                      onCheckedChange={(v) => void setActive(h, v)}
                    />
                    <Button asChild size="sm" variant="outline">
                      <Link to="/halls/$hallId" params={{ hallId: h.public_id }}>
                        <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={togglingId === h.public_id}
                      onClick={() => void setActive(h, !h.is_active)}
                    >
                      <Power className="mr-1.5 h-3.5 w-3.5" />
                      {h.is_active ? "Deactivate" : "Activate"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setDeleteTarget(h)}>
                      <Trash2 className="mr-1.5 h-3.5 w-3.5 text-destructive" /> Delete
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && !deleting && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the hall, its images, slots and blackout dates.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={hasBookings}
        onOpenChange={(o) => {
          if (!o) {
            setHasBookings(false);
            setDeleteTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>This hall has bookings</AlertDialogTitle>
            <AlertDialogDescription>
              This hall has bookings. Deactivate it instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const t = deleteTarget;
                setHasBookings(false);
                setDeleteTarget(null);
                if (t) void setActive(t, false);
              }}
            >
              Deactivate hall
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
