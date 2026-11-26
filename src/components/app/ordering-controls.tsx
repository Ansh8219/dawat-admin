import { useState, type ReactNode } from "react";
import { ChevronDown, CircleDot, Info } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { updateBusinessOrdering } from "@/lib/api/businesses";
import {
  ApiError,
  type BusinessOrderingCard,
  type BusinessOrderingSwitches,
} from "@/lib/api/types";
import { withAuthRetry } from "@/lib/api/with-auth";
import { useAccess } from "@/lib/access";
import {
  ORDER_CHANNELS,
  businessLabel,
  closedChannels,
  hasOrderChannels,
  normalizeOrdering,
  orderingStatusLabel,
  type OrderingField,
} from "@/lib/order-channels";
import { cn } from "@/lib/utils";

export interface OrderingBusiness extends Partial<BusinessOrderingSwitches> {
  public_id: string;
  type: string;
  name: string;
}

interface PendingClose {
  field: OrderingField;
  title: string;
  description: string;
  action: string;
}

/** Whether the signed-in user may change ordering switches (backend enforces too). */
function useCanManageOrdering(): boolean {
  return useAccess().canManage("orders");
}

/**
 * Master "Accepting orders" switch plus Delivery / Takeaway / Dine-in switches for one business.
 * Not optimistic: each toggle sends one PATCH with only that field and the UI takes the server
 * response. Renders nothing for users without `orders:manage`.
 */
export function OrderingControls({
  business,
  onUpdated,
  className,
}: {
  business: OrderingBusiness;
  onUpdated: (card: BusinessOrderingCard) => void;
  className?: string;
}) {
  const canManage = useCanManageOrdering();
  const [saving, setSaving] = useState<OrderingField | null>(null);
  const [pending, setPending] = useState<PendingClose | null>(null);

  if (!canManage) return null;

  const state = normalizeOrdering(business);
  const label = businessLabel(business.type, business.name);
  const withChannels = hasOrderChannels(business.type);
  const masterOn = state.is_accepting_orders;

  async function apply(field: OrderingField, next: boolean) {
    setSaving(field);
    try {
      const card = await withAuthRetry((token) =>
        updateBusinessOrdering(token, business.public_id, { [field]: next }),
      );
      onUpdated(card);
      toast.success(successMessage(field, next, label));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to update ordering");
    } finally {
      setSaving(null);
    }
  }

  function request(field: OrderingField, next: boolean) {
    if (next) {
      void apply(field, true);
      return;
    }
    if (field === "is_accepting_orders") {
      setPending({
        field,
        title: `Stop all orders for ${label}?`,
        description:
          "Customers won't be able to place any new orders — delivery, takeaway, dine-in or QR — until you turn it back on. Orders already placed and POS counter orders are not affected.",
        action: "Pause orders",
      });
      return;
    }
    const channel = ORDER_CHANNELS.find((c) => c.field === field);
    if (!channel) return;
    setPending({
      field,
      title: `Stop ${channel.label} orders for ${label}?`,
      description: `${channel.closeWarning} Orders already placed are not affected.`,
      action: `Close ${channel.label}`,
    });
  }

  return (
    <div className={cn("space-y-3", className)}>
      <SwitchRow
        label="Accepting orders"
        hint={masterOn ? "Master switch for all channels" : "Orders are paused"}
        checked={masterOn}
        disabled={saving !== null}
        busy={saving === "is_accepting_orders"}
        onChange={(checked) => request("is_accepting_orders", checked)}
        emphasis
      />

      {withChannels && (
        <div className="space-y-2 border-l-2 border-border pl-3">
          {ORDER_CHANNELS.map((c) => (
            <SwitchRow
              key={c.field}
              label={c.label}
              hint={c.hint}
              // Keep the saved value visible; it comes back when the master switch is on.
              checked={state[c.field]}
              disabled={!masterOn || saving !== null}
              busy={saving === c.field}
              muted={!masterOn}
              onChange={(checked) => request(c.field, checked)}
            />
          ))}
          {!masterOn && (
            <p className="flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground">
              <Info className="mt-px h-3 w-3 shrink-0" />
              All channels closed because orders are paused. Channel settings are kept and apply
              again when you resume.
            </p>
          )}
        </div>
      )}

      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent className="rounded-2xl sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>{pending?.title}</AlertDialogTitle>
            <AlertDialogDescription>{pending?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => pending && void apply(pending.field, false)}
            >
              {pending?.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function successMessage(field: OrderingField, next: boolean, label: string): string {
  if (field === "is_accepting_orders") {
    return next ? `${label} — Accepting orders` : `${label} — Orders paused`;
  }
  const channel = ORDER_CHANNELS.find((c) => c.field === field)?.label ?? "Channel";
  return next ? `${label} — ${channel} reopened` : `${label} — ${channel} closed`;
}

function SwitchRow({
  label,
  hint,
  checked,
  disabled,
  busy,
  muted,
  emphasis,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled: boolean;
  busy: boolean;
  muted?: boolean;
  emphasis?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "flex items-center justify-between gap-3",
        muted && "opacity-50",
        disabled ? "cursor-not-allowed" : "cursor-pointer",
      )}
    >
      <span className="min-w-0">
        <span className={cn("block text-sm", emphasis ? "font-semibold" : "font-medium")}>
          {label}
          {busy && (
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">Saving…</span>
          )}
        </span>
        <span className="block text-[11px] text-muted-foreground">{hint}</span>
      </span>
      <Switch checked={checked} disabled={disabled} aria-label={label} onCheckedChange={onChange} />
    </label>
  );
}

/** Badges for closed channels ("Delivery closed") or "Orders paused" when the master is off. */
export function OrderingStatusBadges({
  business,
  className,
}: {
  business: OrderingBusiness;
  className?: string;
}) {
  const state = normalizeOrdering(business);
  const closed = closedChannels(state, business.type);
  if (state.is_accepting_orders && closed.length === 0) return null;
  return (
    <span className={cn("inline-flex flex-wrap gap-1.5", className)}>
      {!state.is_accepting_orders ? (
        <ClosedBadge>Orders paused</ClosedBadge>
      ) : (
        closed.map((c) => <ClosedBadge key={c.field}>{c.label} closed</ClosedBadge>)
      )}
    </span>
  );
}

function ClosedBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-warning/40 bg-warning/15 px-2.5 py-0.5 text-xs font-medium text-warning">
      {children}
    </span>
  );
}

/**
 * Compact status pill (topbar / dashboard header). With `orders:manage` it opens a popover
 * holding the full control group; otherwise it only shows the status.
 */
export function OrderingStatusPill({
  business,
  onUpdated,
  hideLabelOnMobile,
}: {
  business: OrderingBusiness;
  onUpdated: (card: BusinessOrderingCard) => void;
  hideLabelOnMobile?: boolean;
}) {
  const canManage = useCanManageOrdering();
  const status = orderingStatusLabel(business, business.type);

  const pill = (
    <span
      className={cn(
        "flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-medium",
        status.tone === "open" && "border-success/40",
        status.tone === "partial" && "border-warning/50",
        status.tone === "closed" && "border-border",
      )}
    >
      <CircleDot
        className={cn(
          "h-3 w-3 shrink-0",
          status.tone === "open" && "animate-pulse text-success",
          status.tone === "partial" && "text-warning",
          status.tone === "closed" && "text-muted-foreground",
        )}
      />
      <span className={cn("whitespace-nowrap", hideLabelOnMobile && "hidden sm:inline")}>
        {status.label}
      </span>
      {canManage && <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />}
    </span>
  );

  if (!canManage) return pill;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label={`Ordering: ${status.label}`} className="rounded-full">
          {pill}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 rounded-2xl p-4">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {businessLabel(business.type, business.name)} ordering
        </div>
        <OrderingControls business={business} onUpdated={onUpdated} />
      </PopoverContent>
    </Popover>
  );
}
