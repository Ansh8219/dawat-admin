import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ManagerBusinessTypes, ManagerPermissions } from "@/components/app/manager-permissions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BUSINESS_TYPES_REQUIRED,
  mapCreateManagerError,
  updateManagerAccess,
  type ManagerAccess,
  type ManagerFormErrors,
  type ManagerListItem,
  type UpdateManagerAccessPayload,
} from "@/lib/api/managers";
import { ApiError, type ScopedBusinessType } from "@/lib/api/types";
import { withAuthRetry } from "@/lib/api/with-auth";
import { allowedBusinessTypes, normalizeBusinessTypes } from "@/lib/business-scope";

function sameSet(a: readonly string[], b: readonly string[]) {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((x) => set.has(x));
}

/** Row's business types; a missing field (older backend) means both. */
function rowBusinessTypes(m: ManagerListItem): ScopedBusinessType[] {
  return m.business_types ? normalizeBusinessTypes(m.business_types) : allowedBusinessTypes(null);
}

/** "Edit access" for one manager: permissions + Restaurant/Bakery, pre-filled from the list row. */
export function ManagerAccessDialog({
  manager,
  onClose,
  onSaved,
  onNotFound,
}: {
  manager: ManagerListItem | null;
  onClose: () => void;
  onSaved: (access: ManagerAccess) => void;
  onNotFound: () => void;
}) {
  const [permissions, setPermissions] = useState<string[]>([]);
  const [businessTypes, setBusinessTypes] = useState<ScopedBusinessType[]>([]);
  const [errors, setErrors] = useState<ManagerFormErrors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!manager) return;
    setPermissions(manager.permissions ?? []);
    setBusinessTypes(rowBusinessTypes(manager));
    setErrors({});
  }, [manager]);

  const initialPermissions = manager?.permissions ?? [];
  const initialTypes = manager ? rowBusinessTypes(manager) : [];
  const permissionsChanged = !sameSet(permissions, initialPermissions);
  const typesChanged = !sameSet(businessTypes, initialTypes);

  async function save() {
    if (!manager) return;
    const next: ManagerFormErrors = {};
    if (permissions.length === 0) next.permissions = "Select at least one permission.";
    if (businessTypes.length === 0) next.business_types = BUSINESS_TYPES_REQUIRED;
    setErrors(next);
    if (next.permissions || next.business_types) return;

    // Send only what changed (the endpoint needs at least one field).
    const payload: UpdateManagerAccessPayload = {};
    if (permissionsChanged) payload.permissions = permissions;
    if (typesChanged) payload.business_types = businessTypes;
    if (!payload.permissions && !payload.business_types) {
      onClose();
      return;
    }

    setSaving(true);
    try {
      const updated = await withAuthRetry((token) =>
        updateManagerAccess(token, manager.public_id, payload),
      );
      toast.success(`Access updated for ${manager.name || manager.email}`);
      onSaved(updated);
    } catch (err) {
      if (err instanceof ApiError && (err.code === "manager_not_found" || err.status === 404)) {
        toast.error("Manager not found.");
        onNotFound();
        return;
      }
      const mapped = mapCreateManagerError(err);
      setErrors(mapped);
      if (mapped.general) toast.error(mapped.general);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={manager !== null} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit access</DialogTitle>
          <DialogDescription>
            {manager ? `${manager.name || manager.email}. ` : ""}Changes apply to their next
            request; they don't need to sign in again.
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Business access</h3>
          <ManagerBusinessTypes
            idPrefix="edit-biz"
            value={businessTypes}
            onChange={(next) => {
              setBusinessTypes(next);
              if (next.length) setErrors((e) => ({ ...e, business_types: undefined }));
            }}
          />
          {errors.business_types && (
            <p role="alert" className="text-xs text-destructive">
              {errors.business_types}
            </p>
          )}
        </section>

        <section className="space-y-2">
          <div>
            <h3 className="text-sm font-semibold">Permissions</h3>
            <p className="text-xs text-muted-foreground">
              Applies to the businesses above. Manage includes View.
            </p>
          </div>
          <ManagerPermissions idPrefix="edit-perm" value={permissions} onChange={setPermissions} />
          {errors.permissions && (
            <p role="alert" className="text-xs text-destructive">
              {errors.permissions}
            </p>
          )}
        </section>

        {errors.general && (
          <div
            role="alert"
            className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {errors.general}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={saving || (!permissionsChanged && !typesChanged)}
            onClick={() => void save()}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
              </>
            ) : (
              "Save access"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
