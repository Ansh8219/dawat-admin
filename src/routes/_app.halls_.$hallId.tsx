import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/app/empty-state";
import {
  buildPatchPayload,
  HallForm,
  hallToForm,
  validateHallForm,
  type HallFormState,
} from "@/components/app/hall-form";
import { HallBlackoutsTab } from "@/components/app/hall-blackouts-tab";
import { HallImagesTab } from "@/components/app/hall-images-tab";
import { HallSlotsTab } from "@/components/app/hall-slots-tab";
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
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFieldErrors } from "@/lib/api/client";
import { deleteHall, getHall, updateHall, type Hall } from "@/lib/api/halls";
import { ApiError } from "@/lib/api/types";
import { withAuthRetry } from "@/lib/api/with-auth";
import { useAccess } from "@/lib/access";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/halls_/$hallId")({
  component: EditHallPage,
  head: () => ({ meta: [{ title: "Edit Hall — Daawat Baker's" }] }),
});

function EditHallPage() {
  const { hallId } = Route.useParams();
  const navigate = useNavigate();
  const manage = useAccess().canManage("halls");

  const [hall, setHall] = useState<Hall | null>(null);
  const [form, setForm] = useState<HallFormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [hasBookings, setHasBookings] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

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

  const load = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!opts.silent) {
        setLoading(true);
        setLoadError("");
      }
      try {
        const h = await withAuthRetry((t) => getHall(t, hallId));
        setHall(h);
        if (!opts.silent) setForm(hallToForm(h));
      } catch (err) {
        if (handleAuth(err)) return;
        const msg = err instanceof ApiError ? err.message : "Unable to load hall.";
        if (opts.silent) toast.error(msg);
        else setLoadError(msg);
      } finally {
        if (!opts.silent) setLoading(false);
      }
    },
    [hallId, handleAuth],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const patch = useMemo(() => (hall && form ? buildPatchPayload(form, hall) : {}), [hall, form]);
  const dirty = Object.keys(patch).length > 0;

  async function save() {
    if (!hall || !form) return;
    const local = validateHallForm(form, "edit");
    setErrors(local);
    if (Object.keys(local).length) return;
    setSaving(true);
    try {
      const updated = await withAuthRetry((t) => updateHall(t, hall.public_id, patch));
      // Keep images/slots from local state in case the PATCH response omits them.
      const merged = {
        ...updated,
        images: updated.images.length ? updated.images : hall.images,
        slots: updated.slots.length ? updated.slots : hall.slots,
      };
      setHall(merged);
      setForm(hallToForm(merged));
      toast.success("Hall updated");
    } catch (err) {
      if (handleAuth(err)) return;
      setErrors(apiFieldErrors(err));
      toast.error(err instanceof ApiError ? err.message : "Unable to update hall.");
    } finally {
      setSaving(false);
    }
  }

  async function doDelete() {
    if (!hall) return;
    setDeleting(true);
    try {
      await withAuthRetry((t) => deleteHall(t, hall.public_id));
      toast.success(`${hall.name} deleted`);
      void navigate({ to: "/halls" });
    } catch (err) {
      if (handleAuth(err)) return;
      setConfirmDelete(false);
      if (err instanceof ApiError && err.code === "hall_has_bookings") {
        setHasBookings(true);
      } else {
        toast.error(err instanceof ApiError ? err.message : "Unable to delete hall.");
      }
    } finally {
      setDeleting(false);
    }
  }

  async function deactivate() {
    if (!hall) return;
    setDeactivating(true);
    try {
      const updated = await withAuthRetry((t) =>
        updateHall(t, hall.public_id, { is_active: false }),
      );
      setHall({ ...hall, is_active: updated.is_active });
      setForm((f) => (f ? { ...f, is_active: false } : f));
      setHasBookings(false);
      toast.success(`${hall.name} deactivated`);
    } catch (err) {
      if (handleAuth(err)) return;
      toast.error(err instanceof ApiError ? err.message : "Unable to deactivate hall.");
    } finally {
      setDeactivating(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={hall?.name ?? "Edit Hall"}
        crumbs={["Banquet", "Halls", "Edit"]}
        action={
          manage && hall ? (
            <Button variant="outline" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="mr-2 h-4 w-4 text-destructive" /> Delete
            </Button>
          ) : undefined
        }
      />
      <div className="max-w-4xl space-y-4 p-4 sm:p-6 lg:p-8">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/halls">
            <ArrowLeft className="mr-1.5 h-4 w-4" /> All halls
          </Link>
        </Button>

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-72" />
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
        ) : loadError || !hall || !form ? (
          <EmptyState
            title="Couldn't load hall"
            description={loadError || "Hall not found."}
            icon={ArrowLeft}
            action={<Button onClick={() => void load()}>Try again</Button>}
          />
        ) : (
          <Tabs defaultValue="details">
            <TabsList>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="images">Images ({hall.images.length})</TabsTrigger>
              <TabsTrigger value="slots">Slots ({hall.slots.length})</TabsTrigger>
              <TabsTrigger value="blackouts">Blackout dates</TabsTrigger>
            </TabsList>
            <TabsContent value="details" className="pt-4">
              <fieldset disabled={!manage} className="contents">
                <HallForm
                  mode="edit"
                  value={form}
                  onChange={setForm}
                  errors={errors}
                  saving={saving}
                  dirty={dirty && manage}
                  onSubmit={() => void save()}
                  submitLabel="Save changes"
                />
              </fieldset>
            </TabsContent>
            <TabsContent value="images" className="pt-4">
              <HallImagesTab
                hallId={hall.public_id}
                images={hall.images}
                canManage={manage}
                onChange={(images) => setHall((h) => (h ? { ...h, images } : h))}
                onReload={() => load({ silent: true })}
              />
            </TabsContent>
            <TabsContent value="slots" className="pt-4">
              <HallSlotsTab
                hallId={hall.public_id}
                slots={hall.slots}
                canManage={manage}
                onChange={(slots) => setHall((h) => (h ? { ...h, slots } : h))}
              />
            </TabsContent>
            <TabsContent value="blackouts" className="pt-4">
              <HallBlackoutsTab hallId={hall.public_id} canManage={manage} />
            </TabsContent>
          </Tabs>
        )}
      </div>

      <AlertDialog
        open={confirmDelete}
        onOpenChange={(o) => !o && !deleting && setConfirmDelete(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {hall?.name}?</AlertDialogTitle>
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
                void doDelete();
              }}
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={hasBookings}
        onOpenChange={(o) => !o && !deactivating && setHasBookings(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>This hall has bookings</AlertDialogTitle>
            <AlertDialogDescription>
              This hall has bookings. Deactivate it instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deactivating}>Close</AlertDialogCancel>
            <AlertDialogAction
              disabled={deactivating || hall?.is_active === false}
              onClick={(e) => {
                e.preventDefault();
                void deactivate();
              }}
            >
              {deactivating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {hall?.is_active === false ? "Already inactive" : "Deactivate hall"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
