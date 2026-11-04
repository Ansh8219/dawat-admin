import { useState } from "react";
import { toast } from "sonner";
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
import { Switch } from "@/components/ui/switch";
import {
  accountErrorMessage,
  classifyAccountError,
  setAccountActive,
  type AccountKind,
} from "@/lib/api/account-status";
import { withAuthRetry } from "@/lib/api/with-auth";
import { isSuperAdmin, useAuth } from "@/lib/auth";

/** Grey badge shown on deactivated accounts (visible to every role). */
export function InactiveBadge() {
  return (
    <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
      Inactive
    </Badge>
  );
}

/** Missing flag (older API) is treated as active. */
export function isAccountActive(item: { is_active?: boolean } | null | undefined): boolean {
  return item?.is_active !== false;
}

export function useIsSuperAdmin(): boolean {
  return isSuperAdmin(useAuth((s) => s.user));
}

function deactivateMessage(kind: AccountKind, name: string): string {
  return kind === "driver"
    ? `Deactivate ${name}? They will be taken offline and cannot sign in until reactivated.`
    : `Deactivate ${name}? They will be logged out and cannot sign in until reactivated.`;
}

/**
 * Active/Inactive switch for manager, store keeper and driver accounts.
 * Renders nothing unless the signed-in user is super_admin.
 */
export function AccountStatusToggle({
  kind,
  publicId,
  name,
  isActive,
  onChanged,
  onNotFound,
  showLabel = true,
}: {
  kind: AccountKind;
  publicId: string;
  name: string;
  isActive: boolean;
  /** Called with the server-confirmed state after a successful change. */
  onChanged: (isActive: boolean) => void;
  /** Called after a 404 so the parent can refresh its list. */
  onNotFound?: () => void;
  showLabel?: boolean;
}) {
  const canManage = useIsSuperAdmin();
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!canManage) return null;

  async function apply(next: boolean) {
    setBusy(true);
    try {
      const res = await withAuthRetry((token) => setAccountActive(token, kind, publicId, next));
      const state = typeof res?.is_active === "boolean" ? res.is_active : next;
      onChanged(state);
      toast.success(`${name} ${state ? "activated" : "deactivated"}`);
      setConfirmOpen(false);
    } catch (err) {
      const type = classifyAccountError(err);
      toast.error(accountErrorMessage(type));
      if (type === "not_found") {
        setConfirmOpen(false);
        onNotFound?.();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <Switch
          checked={isActive}
          disabled={busy}
          aria-label={isActive ? `Deactivate ${name}` : `Activate ${name}`}
          onCheckedChange={(next) => {
            if (next) void apply(true);
            else setConfirmOpen(true);
          }}
        />
        {showLabel && (
          <span className="text-xs text-muted-foreground">{isActive ? "Active" : "Inactive"}</span>
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={(o) => !busy && setConfirmOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate account?</AlertDialogTitle>
            <AlertDialogDescription>{deactivateMessage(kind, name)}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void apply(false);
              }}
            >
              {busy ? "Deactivating…" : "Deactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
