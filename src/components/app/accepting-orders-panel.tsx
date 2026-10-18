import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Switch } from "@/components/ui/switch";
import { listBusinesses, setBusinessAcceptingOrders } from "@/lib/api/businesses";
import { ApiError, type Business } from "@/lib/api/types";
import { withAuthRetry } from "@/lib/api/with-auth";
import { useAuth } from "@/lib/auth";
import { businessTypeToPanel } from "@/lib/panel";
import { cn } from "@/lib/utils";
import { CircleDot, Loader2 } from "lucide-react";
import { toast } from "sonner";

const ORDERABLE_TYPES = new Set(["restaurant", "bakery"]);

function typeLabel(type: string): string {
  const panel = businessTypeToPanel(type);
  if (panel === "restaurant") return "Restaurant";
  if (panel === "bakery") return "Bakery";
  return type;
}

function sortOrderable(a: Business, b: Business): number {
  const rank = (t: string) => (t === "restaurant" ? 0 : t === "bakery" ? 1 : 2);
  return rank(a.type) - rank(b.type) || a.name.localeCompare(b.name);
}

type Props = {
  /** Compact strip for dashboard header; default is card list. */
  variant?: "header" | "cards";
  className?: string;
};

export function AcceptingOrdersPanel({ variant = "cards", className }: Props) {
  const navigate = useNavigate();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);

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

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const data = await withAuthRetry((token) => listBusinesses(token));
      setBusinesses(
        data
          .filter((b) => ORDERABLE_TYPES.has(String(b.type)))
          .map((b) => ({
            ...b,
            is_accepting_orders: Boolean(b.is_accepting_orders),
          }))
          .sort(sortOrderable),
      );
    } catch (err) {
      if (handleAuthError(err)) return;
      setLoadError(err instanceof ApiError ? err.message : "Unable to load businesses.");
    } finally {
      setLoading(false);
    }
  }, [handleAuthError]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const anyOpen = useMemo(
    () => businesses.some((b) => b.is_accepting_orders),
    [businesses],
  );

  async function toggleAccepting(biz: Business, next: boolean) {
    const previous = biz.is_accepting_orders;
    setTogglingId(biz.public_id);
    setBusinesses((prev) =>
      prev.map((b) =>
        b.public_id === biz.public_id ? { ...b, is_accepting_orders: next } : b,
      ),
    );
    try {
      const updated = await withAuthRetry((token) =>
        setBusinessAcceptingOrders(token, biz.public_id, next),
      );
      setBusinesses((prev) =>
        prev.map((b) => (b.public_id === biz.public_id ? { ...b, ...updated } : b)),
      );
      const label = typeLabel(updated.type || biz.type);
      toast.success(
        next ? `${label} — Accepting orders` : `${label} — Closed`,
      );
    } catch (err) {
      setBusinesses((prev) =>
        prev.map((b) =>
          b.public_id === biz.public_id ? { ...b, is_accepting_orders: previous } : b,
        ),
      );
      if (handleAuthError(err)) return;
      toast.error(err instanceof ApiError ? err.message : "Unable to update accepting orders");
    } finally {
      setTogglingId(null);
    }
  }

  if (loading) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 text-xs text-muted-foreground",
          variant === "cards" && "rounded-2xl border bg-card px-4 py-6",
          className,
        )}
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading outlet status…
      </div>
    );
  }

  if (loadError) {
    return (
      <div
        className={cn(
          "rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive",
          className,
        )}
      >
        {loadError}{" "}
        <button type="button" className="font-semibold underline" onClick={() => void refresh()}>
          Retry
        </button>
      </div>
    );
  }

  if (businesses.length === 0) {
    return (
      <p className={cn("text-xs text-muted-foreground", className)}>
        No restaurant or bakery outlets found.
      </p>
    );
  }

  if (variant === "header") {
    return (
      <div className={cn("flex flex-wrap items-center gap-2", className)}>
        {businesses.map((biz) => {
          const open = biz.is_accepting_orders;
          const label = typeLabel(biz.type);
          return (
            <label
              key={biz.public_id}
              className={cn(
                "flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-medium",
                open ? "border-success/40" : "border-border",
              )}
            >
              <CircleDot
                className={cn("h-3 w-3 shrink-0", open ? "text-success animate-pulse" : "text-muted-foreground")}
              />
              <span className="whitespace-nowrap">
                {label} — {open ? "Accepting orders" : "Closed"}
              </span>
              <Switch
                checked={open}
                disabled={togglingId === biz.public_id}
                onCheckedChange={(checked) => void toggleAccepting(biz, checked)}
              />
            </label>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
            anyOpen ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
          )}
        >
          <CircleDot className={cn("h-3 w-3", anyOpen && "animate-pulse")} />
          {anyOpen ? "At least one outlet open" : "All outlets closed"}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {businesses.map((biz) => {
          const open = biz.is_accepting_orders;
          const label = typeLabel(biz.type);
          return (
            <article
              key={biz.public_id}
              className={cn(
                "flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-soft",
                open ? "border-success/30" : "border-border",
              )}
            >
              {biz.image ? (
                <img
                  src={biz.image}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-xl object-cover"
                />
              ) : (
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-muted text-xs font-bold text-muted-foreground">
                  {label.slice(0, 1)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold">{biz.name || label}</div>
                <div
                  className={cn(
                    "mt-0.5 text-xs font-medium",
                    open ? "text-success" : "text-muted-foreground",
                  )}
                >
                  {label} — {open ? "Accepting orders" : "Closed"}
                </div>
              </div>
              <Switch
                checked={open}
                disabled={togglingId === biz.public_id}
                onCheckedChange={(checked) => void toggleAccepting(biz, checked)}
                aria-label={`${label} accepting orders`}
              />
            </article>
          );
        })}
      </div>
    </div>
  );
}
