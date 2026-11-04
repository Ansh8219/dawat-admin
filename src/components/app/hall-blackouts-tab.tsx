import { useCallback, useEffect, useState } from "react";
import { CalendarOff, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/app/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFieldErrors } from "@/lib/api/client";
import {
  createHallBlackout,
  deleteHallBlackout,
  listHallBlackouts,
  type HallBlackout,
} from "@/lib/api/halls";
import { ApiError } from "@/lib/api/types";
import { withAuthRetry } from "@/lib/api/with-auth";

function todayISO() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function HallBlackoutsTab({ hallId, canManage }: { hallId: string; canManage: boolean }) {
  const [items, setItems] = useState<HallBlackout[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const rows = await withAuthRetry((t) => listHallBlackouts(t, hallId, todayISO()));
      setItems([...rows].sort((a, b) => a.date.localeCompare(b.date)));
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Unable to load blackout dates.");
    } finally {
      setLoading(false);
    }
  }, [hallId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function add() {
    const local: Record<string, string> = {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) local.date = "Pick a date.";
    if (reason.length > 255) local.reason = "Max 255 characters.";
    setErrors(local);
    if (Object.keys(local).length) return;
    setSaving(true);
    try {
      const created = await withAuthRetry((t) =>
        createHallBlackout(t, hallId, {
          date,
          ...(reason.trim() ? { reason: reason.trim() } : {}),
        }),
      );
      setItems((prev) => [...prev, created].sort((a, b) => a.date.localeCompare(b.date)));
      setDate("");
      setReason("");
      toast.success("Blackout date added");
    } catch (err) {
      setErrors(apiFieldErrors(err));
      toast.error(err instanceof ApiError ? err.message : "Unable to add blackout date.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(b: HallBlackout) {
    setDeletingId(b.public_id);
    try {
      await withAuthRetry((t) => deleteHallBlackout(t, hallId, b.public_id));
      setItems((prev) => prev.filter((x) => x.public_id !== b.public_id));
      toast.success("Blackout date removed");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to remove blackout date.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <Alert>
        <AlertDescription>
          Blackout blocks new bookings only. Existing bookings on that date stay.
        </AlertDescription>
      </Alert>

      {canManage && (
        <form
          className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-[180px_1fr_auto] sm:items-start"
          onSubmit={(e) => {
            e.preventDefault();
            if (!saving) void add();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="bo-date">Date *</Label>
            <Input
              id="bo-date"
              type="date"
              min={todayISO()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            {errors.date && <p className="text-xs text-destructive">{errors.date}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bo-reason">Reason</Label>
            <Input
              id="bo-reason"
              value={reason}
              maxLength={255}
              placeholder="Diwali"
              onChange={(e) => setReason(e.target.value)}
            />
            {errors.reason && <p className="text-xs text-destructive">{errors.reason}</p>}
          </div>
          <Button type="submit" disabled={saving} className="sm:mt-6">
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Add
          </Button>
        </form>
      )}

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : loadError ? (
        <EmptyState
          icon={CalendarOff}
          title="Couldn't load blackout dates"
          description={loadError}
          action={<Button onClick={() => void load()}>Try again</Button>}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={CalendarOff}
          title="No upcoming blackout dates"
          description="Add dates when this hall can't take new bookings."
        />
      ) : (
        <ul className="space-y-2">
          {items.map((b) => (
            <li
              key={b.public_id}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium">{b.date}</div>
                {b.reason && (
                  <div className="truncate text-sm text-muted-foreground">{b.reason}</div>
                )}
              </div>
              {canManage && (
                <Button
                  size="sm"
                  variant="outline"
                  aria-label={`Remove ${b.date}`}
                  disabled={deletingId === b.public_id}
                  onClick={() => void remove(b)}
                >
                  {deletingId === b.public_id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  )}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
