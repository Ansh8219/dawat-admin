import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CircleDot } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
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
import { listBusinesses, setBusinessAcceptingOrders } from "@/lib/api/businesses";
import { ApiError } from "@/lib/api/types";
import { withAuthRetry } from "@/lib/api/with-auth";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

/** Header switch: open/close the currently selected outlet for new customer orders. */
export function OutletToggle() {
  const queryClient = useQueryClient();
  const business = useAuth((s) => s.business);
  const publicId = business?.publicId;
  const [confirmClose, setConfirmClose] = useState(false);
  const [saving, setSaving] = useState(false);
  const queryKey = ["outlet-accepting", publicId];

  const { data: accepting } = useQuery({
    queryKey,
    enabled: !!publicId,
    refetchInterval: 30_000,
    queryFn: async () => {
      const list = await withAuthRetry((token) => listBusinesses(token));
      return Boolean(list.find((b) => b.public_id === publicId)?.is_accepting_orders);
    },
  });

  if (!publicId || accepting === undefined) return null;

  async function apply(next: boolean) {
    if (!publicId) return;
    setSaving(true);
    queryClient.setQueryData(queryKey, next);
    try {
      await withAuthRetry((token) => setBusinessAcceptingOrders(token, publicId, next));
      toast.success(next ? "Now accepting orders" : "Outlet closed for new orders");
    } catch (err) {
      queryClient.setQueryData(queryKey, !next);
      toast.error(err instanceof ApiError ? err.message : "Unable to update accepting orders");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <label
        className={cn(
          "flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-medium",
          accepting ? "border-success/40" : "border-border",
        )}
      >
        <CircleDot
          className={cn(
            "h-3 w-3 shrink-0",
            accepting ? "animate-pulse text-success" : "text-muted-foreground",
          )}
        />
        <span className="hidden whitespace-nowrap sm:inline">
          {accepting ? "Accepting orders" : "Closed"}
        </span>
        <Switch
          checked={accepting}
          disabled={saving}
          aria-label="Accepting orders"
          onCheckedChange={(checked) => (checked ? void apply(true) : setConfirmClose(true))}
        />
      </label>

      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent className="rounded-2xl sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Stop accepting orders?</AlertDialogTitle>
            <AlertDialogDescription>
              {business?.name ?? "This outlet"} will stop receiving new customer orders until you
              turn it back on.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void apply(false)}
            >
              Close outlet
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
