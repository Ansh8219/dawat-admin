import { useState } from "react";
import { Clock, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/app/empty-state";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { apiFieldErrors } from "@/lib/api/client";
import {
  createHallSlot,
  deleteHallSlot,
  updateHallSlot,
  type HallSlot,
  type UpdateSlotFields,
} from "@/lib/api/halls";
import { ApiError } from "@/lib/api/types";
import { withAuthRetry } from "@/lib/api/with-auth";

type SlotForm = {
  code: string;
  label: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
  sort_order: string;
};

const EMPTY: SlotForm = {
  code: "",
  label: "",
  start_time: "12:00",
  end_time: "16:00",
  is_active: true,
  sort_order: "0",
};

function validate(f: SlotForm, creating: boolean) {
  const e: Record<string, string> = {};
  if (creating) {
    if (!f.code) e.code = "Code is required.";
    else if (f.code.length > 32) e.code = "Max 32 characters.";
    else if (!/^[a-z0-9_]+$/.test(f.code))
      e.code = "Lowercase letters, digits and underscores only.";
  }
  if (!f.label.trim()) e.label = "Label is required.";
  else if (f.label.length > 64) e.label = "Max 64 characters.";
  if (!f.start_time) e.start_time = "Required.";
  if (!f.end_time) e.end_time = "Required.";
  if (f.start_time && f.end_time && f.end_time <= f.start_time)
    e.end_time = "End time must be after start time.";
  if (f.sort_order.trim() && !/^-?\d+$/.test(f.sort_order.trim())) e.sort_order = "Whole number.";
  return e;
}

export function HallSlotsTab({
  hallId,
  slots,
  onChange,
  canManage,
}: {
  hallId: string;
  slots: HallSlot[];
  onChange: (next: HallSlot[]) => void;
  canManage: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<HallSlot | null>(null);
  const [form, setForm] = useState<SlotForm>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HallSlot | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [inUse, setInUse] = useState<HallSlot | null>(null);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setErrors({});
    setOpen(true);
  }
  function openEdit(s: HallSlot) {
    setEditing(s);
    setForm({
      code: s.code,
      label: s.label,
      start_time: s.start_time,
      end_time: s.end_time,
      is_active: s.is_active,
      sort_order: String(s.sort_order),
    });
    setErrors({});
    setOpen(true);
  }

  async function save() {
    const local = validate(form, !editing);
    setErrors(local);
    if (Object.keys(local).length) return;
    setSaving(true);
    try {
      if (editing) {
        const patch: UpdateSlotFields = {};
        if (form.label.trim() !== editing.label) patch.label = form.label.trim();
        if (form.start_time !== editing.start_time) patch.start_time = form.start_time;
        if (form.end_time !== editing.end_time) patch.end_time = form.end_time;
        if (form.is_active !== editing.is_active) patch.is_active = form.is_active;
        const order = form.sort_order.trim() ? Number(form.sort_order) : 0;
        if (order !== editing.sort_order) patch.sort_order = order;
        if (Object.keys(patch).length === 0) {
          setOpen(false);
          return;
        }
        const updated = await withAuthRetry((t) =>
          updateHallSlot(t, hallId, editing.public_id, patch),
        );
        onChange(slots.map((s) => (s.public_id === updated.public_id ? updated : s)));
        toast.success("Slot updated");
      } else {
        const created = await withAuthRetry((t) =>
          createHallSlot(t, hallId, {
            code: form.code,
            label: form.label.trim(),
            start_time: form.start_time,
            end_time: form.end_time,
          }),
        );
        onChange([...slots, created]);
        toast.success("Slot added");
      }
      setOpen(false);
    } catch (err) {
      setErrors(apiFieldErrors(err));
      toast.error(err instanceof ApiError ? err.message : "Unable to save slot.");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(s: HallSlot, next: boolean) {
    setTogglingId(s.public_id);
    try {
      const updated = await withAuthRetry((t) =>
        updateHallSlot(t, hallId, s.public_id, { is_active: next }),
      );
      onChange(slots.map((x) => (x.public_id === s.public_id ? updated : x)));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to update slot.");
    } finally {
      setTogglingId(null);
    }
  }

  async function remove() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleting(true);
    try {
      await withAuthRetry((t) => deleteHallSlot(t, hallId, target.public_id));
      onChange(slots.filter((s) => s.public_id !== target.public_id));
      toast.success("Slot deleted");
      setDeleteTarget(null);
    } catch (err) {
      if (err instanceof ApiError && err.code === "hall_slot_in_use") {
        setDeleteTarget(null);
        setInUse(target);
      } else {
        toast.error(err instanceof ApiError ? err.message : "Unable to delete slot.");
      }
    } finally {
      setDeleting(false);
    }
  }

  const sorted = [...slots].sort(
    (a, b) => a.sort_order - b.sort_order || a.start_time.localeCompare(b.start_time),
  );
  const err = (k: string) => errors[k] && <p className="text-xs text-destructive">{errors[k]}</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Bookable time windows, e.g. lunch and dinner.
        </p>
        {canManage && (
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> Add slot
          </Button>
        )}
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No slots yet"
          description="Add at least one slot (e.g. lunch) so customers can book this hall."
        />
      ) : (
        <ul className="space-y-2">
          {sorted.map((s) => (
            <li
              key={s.public_id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 font-medium">
                  {s.label}
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {s.code}
                  </Badge>
                  {!s.is_active && <Badge variant="secondary">Inactive</Badge>}
                </div>
                <div className="text-sm text-muted-foreground">
                  {s.start_time} – {s.end_time} · Sort {s.sort_order}
                </div>
              </div>
              {canManage && (
                <div className="flex items-center gap-2">
                  <Switch
                    aria-label="Active"
                    checked={s.is_active}
                    disabled={togglingId === s.public_id}
                    onCheckedChange={(v) => void toggle(s, v)}
                  />
                  <Button size="sm" variant="outline" onClick={() => openEdit(s)}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setDeleteTarget(s)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={(o) => !saving && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit slot" : "Add slot"}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!saving) void save();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="slot-code">Code *</Label>
              <Input
                id="slot-code"
                value={form.code}
                maxLength={32}
                disabled={!!editing}
                placeholder="lunch"
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
              {err("code")}
              {editing && <p className="text-xs text-muted-foreground">Code cannot be changed.</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="slot-label">Label *</Label>
              <Input
                id="slot-label"
                value={form.label}
                maxLength={64}
                placeholder="12:00 PM – 4:00 PM"
                onChange={(e) => setForm({ ...form, label: e.target.value })}
              />
              {err("label")}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="slot-start">Start time *</Label>
                <Input
                  id="slot-start"
                  type="time"
                  value={form.start_time}
                  onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                />
                {err("start_time")}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="slot-end">End time *</Label>
                <Input
                  id="slot-end"
                  type="time"
                  value={form.end_time}
                  onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                />
                {err("end_time")}
              </div>
            </div>
            {editing && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="slot-sort">Sort order</Label>
                  <Input
                    id="slot-sort"
                    inputMode="numeric"
                    value={form.sort_order}
                    onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
                  />
                  {err("sort_order")}
                </div>
                <div className="flex items-center gap-2 self-end pb-2">
                  <Switch
                    id="slot-active"
                    checked={form.is_active}
                    onCheckedChange={(v) => setForm({ ...form, is_active: v })}
                  />
                  <Label htmlFor="slot-active">Active</Label>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editing ? "Save" : "Add slot"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && !deleting && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete slot “{deleteTarget?.label}”?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void remove();
              }}
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!inUse} onOpenChange={(o) => !o && setInUse(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>This slot has bookings</AlertDialogTitle>
            <AlertDialogDescription>
              This slot has bookings and can't be deleted. Deactivate it instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const s = inUse;
                setInUse(null);
                if (s) void toggle(s, false);
              }}
            >
              Deactivate slot
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
