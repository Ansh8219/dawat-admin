import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { listBusinesses } from "@/lib/api/businesses";
import { invoiceFieldLabel } from "@/lib/api/invoices";
import { ApiError, type Business } from "@/lib/api/types";
import { withAuthRetry } from "@/lib/api/with-auth";
import { useAuth } from "@/lib/auth";
import { businessTypeToPanel, getPanelMeta } from "@/lib/panel";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  CircleDot,
  FileText,
  Loader2,
  RefreshCw,
  Star,
  UtensilsCrossed,
} from "lucide-react";

export const Route = createFileRoute("/_app/businesses")({
  component: BusinessesPage,
  head: () => ({ meta: [{ title: "Businesses — Daawat Baker's" }] }),
});

function typeRank(type: string): number {
  if (type === "restaurant") return 0;
  if (type === "bakery") return 1;
  if (type === "banquet_hall" || type === "banquet") return 2;
  return 9;
}

function typeLabel(type: string): string {
  const panel = businessTypeToPanel(type);
  if (panel) return getPanelMeta(panel).label;
  return type.replace(/_/g, " ");
}

function themeFor(type: string): {
  tint: string;
  accent: string;
  ring: string;
} {
  const panel = businessTypeToPanel(type);
  if (panel === "bakery") {
    return {
      tint: "bg-amber-500/15 text-amber-700",
      accent: "from-amber-500/20 via-orange-400/5 to-transparent",
      ring: "border-amber-500/25",
    };
  }
  if (panel === "banquet") {
    return {
      tint: "bg-violet-500/15 text-violet-700",
      accent: "from-violet-500/20 via-purple-300/5 to-transparent",
      ring: "border-violet-500/25",
    };
  }
  return {
    tint: "bg-primary/15 text-primary",
    accent: "from-primary/20 via-rose-400/5 to-transparent",
    ring: "border-primary/25",
  };
}

function isBanquetHall(type: string): boolean {
  return type === "banquet_hall" || type === "banquet";
}

function formatRating(rating: number | null | undefined): string {
  if (rating == null || Number.isNaN(rating)) return "No ratings yet";
  return rating.toFixed(1);
}

function BusinessesPage() {
  const navigate = useNavigate();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

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

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const data = await withAuthRetry((token) => listBusinesses(token));
      setBusinesses(
        [...data].sort(
          (a, b) =>
            typeRank(String(a.type)) - typeRank(String(b.type)) || a.name.localeCompare(b.name),
        ),
      );
    } catch (err) {
      if (handleAuthError(err)) return;
      setLoadError(err instanceof ApiError ? err.message : "Unable to load businesses.");
      setBusinesses([]);
    } finally {
      setLoading(false);
    }
  }, [handleAuthError]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => {
    const open = businesses.filter((b) => b.is_accepting_orders).length;
    const invoiceReady = businesses.filter((b) => b.is_invoice_ready).length;
    const menuItems = businesses.reduce((sum, b) => sum + (b.menu_items_count ?? 0), 0);
    return { total: businesses.length, open, invoiceReady, menuItems };
  }, [businesses]);

  return (
    <div>
      <PageHeader
        title="Businesses"
        crumbs={["Admin", "Businesses"]}
        description="Restaurant, Bakery and Banquet at a glance — orders, menu coverage and invoice readiness."
        action={
          <Button
            variant="outline"
            className="gap-2 rounded-xl"
            disabled={loading}
            onClick={() => void load()}
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Refresh
          </Button>
        }
      />

      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-primary" /> Loading businesses…
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {loadError}
            </div>
            <Button variant="outline" className="rounded-xl" onClick={() => void load()}>
              Try again
            </Button>
          </div>
        ) : businesses.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">No businesses found.</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryStat
                label="Businesses"
                value={String(summary.total)}
                hint="Across all panels"
                icon={<Building2 className="h-4 w-4" />}
              />
              <SummaryStat
                label="Accepting orders"
                value={`${summary.open}/${summary.total}`}
                hint={summary.open === summary.total ? "All open" : "Some closed"}
                icon={<CircleDot className="h-4 w-4" />}
                tone={summary.open > 0 ? "success" : "muted"}
              />
              <SummaryStat
                label="Invoice ready"
                value={`${summary.invoiceReady}/${summary.total}`}
                hint="GST details complete"
                icon={<FileText className="h-4 w-4" />}
                tone={summary.invoiceReady === summary.total ? "success" : "warn"}
              />
              <SummaryStat
                label="Menu items"
                value={String(summary.menuItems)}
                hint="Across food businesses"
                icon={<UtensilsCrossed className="h-4 w-4" />}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {businesses.map((biz) => (
                <BusinessOverviewCard key={biz.public_id} business={biz} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  hint,
  icon,
  tone = "default",
}: {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
  tone?: "default" | "success" | "warn" | "muted";
}) {
  return (
    <div className="card-elevated relative overflow-hidden p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-muted-foreground">{label}</div>
          <div
            className={cn(
              "mt-1 text-2xl font-semibold tracking-tight",
              tone === "success" && "text-success",
              tone === "warn" && "text-warning",
              tone === "muted" && "text-muted-foreground",
            )}
          >
            {value}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
        </div>
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-muted text-muted-foreground">
          {icon}
        </span>
      </div>
    </div>
  );
}

function BusinessOverviewCard({ business }: { business: Business }) {
  const theme = themeFor(String(business.type));
  const label = typeLabel(String(business.type));
  const open = business.is_accepting_orders;
  const ready = Boolean(business.is_invoice_ready);
  const missing = business.missing_fields ?? [];
  const banquet = isBanquetHall(String(business.type));
  const menuTotal = business.menu_items_count ?? 0;
  const menuAvailable = business.available_items_count ?? 0;
  const reviews = business.review_count ?? 0;
  const hasRating = business.rating != null && !Number.isNaN(business.rating);

  return (
    <article
      className={cn("card-elevated relative flex flex-col overflow-hidden border", theme.ring)}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b",
          theme.accent,
        )}
      />

      <div className="relative flex flex-col gap-4 p-5">
        <div className="flex items-start gap-3">
          {business.image ? (
            <img
              src={business.image}
              alt=""
              className="h-14 w-14 shrink-0 rounded-2xl object-cover shadow-sm"
            />
          ) : (
            <div
              className={cn(
                "grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-lg font-bold",
                theme.tint,
              )}
            >
              {label.slice(0, 1)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-semibold tracking-tight">{business.name}</div>
            <div className="mt-0.5 text-xs capitalize text-muted-foreground">{label}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <StatusBadge status={open ? "Active" : "Inactive"} />
              {ready ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
                  <CheckCircle2 className="h-3 w-3" /> Invoice ready
                </span>
              ) : (
                <Link
                  to="/settings"
                  search={{ tab: "businesses" }}
                  className="inline-flex max-w-full items-center gap-1 rounded-full border border-warning/40 bg-warning/15 px-2.5 py-0.5 text-xs font-medium text-warning hover:bg-warning/25"
                >
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  <span className="truncate">Invoice details incomplete</span>
                </Link>
              )}
            </div>
          </div>
        </div>

        {!banquet && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-sm">
              <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
              {hasRating ? (
                <span className="font-semibold">
                  {formatRating(business.rating)}{" "}
                  <span className="font-normal text-muted-foreground">({reviews})</span>
                </span>
              ) : (
                <span className="text-muted-foreground">No ratings yet</span>
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {menuAvailable} / {menuTotal}
              </span>{" "}
              items available
            </div>
          </div>
        )}

        <div className="rounded-2xl border bg-background/70 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-xs font-semibold">Invoice details</div>
            {business.invoice_prefix ? (
              <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                {business.invoice_prefix}
              </span>
            ) : (
              <span className="text-[10px] text-muted-foreground">No prefix</span>
            )}
          </div>

          {!ready && (
            <Link
              to="/settings"
              search={{ tab: "businesses" }}
              className="mb-3 block rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs leading-relaxed text-warning hover:bg-warning/15"
            >
              <span className="font-semibold">Invoice details incomplete</span>
              {missing.length > 0 ? (
                <>
                  {" — missing "}
                  <b>{missing.map(invoiceFieldLabel).join(", ")}</b>
                </>
              ) : null}
            </Link>
          )}

          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
            <dt className="text-muted-foreground">Legal name</dt>
            <dd className="truncate font-medium">{business.legal_name || "—"}</dd>
            <dt className="text-muted-foreground">GSTIN</dt>
            <dd className="truncate font-mono">{business.gst_number || "—"}</dd>
            <dt className="text-muted-foreground">Invoice prefix</dt>
            <dd className="truncate font-mono">{business.invoice_prefix || "—"}</dd>
          </dl>
        </div>

        <div className="mt-auto flex flex-wrap gap-2 pt-1">
          <Button asChild className="rounded-xl">
            <Link to="/settings" search={{ tab: "businesses" }}>
              Edit invoice details
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}
