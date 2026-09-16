import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { RowActions } from "@/components/app/row-actions";
import { StatusBadge } from "@/components/app/status-badge";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  deleteCustomer,
  formatCustomerPhone,
  listCustomers,
  tierLabel,
  updateCustomer,
} from "@/lib/api/customers";
import { ApiError } from "@/lib/api/types";
import type {
  Customer,
  CustomerSort,
  CustomerSummary,
  CustomerTier,
} from "@/lib/api/types";
import { withAuthRetry } from "@/lib/api/with-auth";
import { useAuth } from "@/lib/auth";
import { inr } from "@/lib/mock/data";
import { cn } from "@/lib/utils";
import {
  Search,
  Users,
  Star,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Sparkles,
  UserX,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/customers")({
  component: CustomersPage,
  head: () => ({ meta: [{ title: "Customers — Daawat Baker's" }] }),
});

const PAGE_SIZE = 20;

const tierOptions: CustomerTier[] = ["silver", "gold", "platinum"];

const SORT_OPTIONS: { value: CustomerSort; label: string }[] = [
  { value: "name_asc", label: "Name (A → Z)" },
  { value: "name_desc", label: "Name (Z → A)" },
  { value: "orders_desc", label: "Orders (High → Low)" },
  { value: "orders_asc", label: "Orders (Low → High)" },
];

const EMPTY_SUMMARY: CustomerSummary = {
  total_customers: 0,
  silver_customers: 0,
  gold_customers: 0,
  platinum_customers: 0,
};

function displayName(name: string | null | undefined): string {
  const trimmed = name?.trim();
  return trimmed || "Unnamed";
}

function initials(name: string | null | undefined): string {
  const trimmed = name?.trim();
  if (!trimmed) return "?";
  return trimmed
    .split(/\s+/)
    .filter(Boolean)
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatLastOrder(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function CustomersPage() {
  const navigate = useNavigate();
  const [results, setResults] = useState<Customer[]>([]);
  const [summary, setSummary] = useState<CustomerSummary>(EMPTY_SUMMARY);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [sel, setSel] = useState<Customer | null>(null);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [tier, setTier] = useState<"all" | CustomerTier>("all");
  const [sort, setSort] = useState<CustomerSort>("name_asc");
  const [page, setPage] = useState(1);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, tier, sort]);

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

  const refresh = useCallback(
    async (options?: { showLoading?: boolean }) => {
      const showLoading = options?.showLoading ?? false;
      if (showLoading) {
        setLoading(true);
        setLoadError("");
      }
      try {
        const data = await withAuthRetry((token) =>
          listCustomers(token, {
            search: debouncedQ || undefined,
            tier: tier === "all" ? undefined : tier,
            sort,
            page,
            page_size: PAGE_SIZE,
          }),
        );
        setResults(data.results ?? []);
        setSummary(data.summary ?? EMPTY_SUMMARY);
        setCount(data.count ?? 0);
        const maxPage = Math.max(1, Math.ceil((data.count ?? 0) / (data.page_size || PAGE_SIZE)));
        if (page > maxPage) {
          setPage(maxPage);
          return;
        }
        setSel((prev) => {
          if (!prev) return null;
          return (data.results ?? []).find((c) => c.public_id === prev.public_id) ?? prev;
        });
      } catch (err) {
        if (handleAuthError(err)) return;
        const message = err instanceof ApiError ? err.message : "Unable to load customers.";
        if (showLoading) setLoadError(message);
        else toast.error(message);
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [debouncedQ, tier, sort, page, handleAuthError],
  );

  useEffect(() => {
    void refresh({ showLoading: true });
  }, [refresh]);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const rangeStart = count === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, count);

  const tierCounts = useMemo(
    () => ({
      all: summary.total_customers,
      silver: summary.silver_customers,
      gold: summary.gold_customers,
      platinum: summary.platinum_customers,
    }),
    [summary],
  );

  async function toggleActive(customer: Customer, next: boolean) {
    setTogglingId(customer.public_id);
    try {
      const updated = await withAuthRetry((token) =>
        updateCustomer(token, customer.public_id, { is_active: next }),
      );
      setResults((prev) =>
        prev.map((c) => (c.public_id === customer.public_id ? { ...c, ...updated } : c)),
      );
      setSel((prev) =>
        prev?.public_id === customer.public_id ? { ...prev, ...updated } : prev,
      );
      toast.success(
        next
          ? `${displayName(customer.full_name)} activated`
          : `${displayName(customer.full_name)} deactivated — cannot log in`,
      );
    } catch (err) {
      if (handleAuthError(err)) return;
      toast.error(err instanceof ApiError ? err.message : "Unable to update customer");
    } finally {
      setTogglingId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await withAuthRetry((token) => deleteCustomer(token, deleteTarget.public_id));
      toast.success(`${displayName(deleteTarget.full_name)} deleted`);
      if (sel?.public_id === deleteTarget.public_id) setSel(null);
      setDeleteTarget(null);
      await refresh({ showLoading: false });
    } catch (err) {
      if (handleAuthError(err)) return;
      toast.error(err instanceof ApiError ? err.message : "Unable to delete customer");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <PageHeader
        title="Customers"
        crumbs={["Growth", "Customers"]}
        description="CRM with loyalty tiers. Summary cards show all customers; the table reflects search, filters, and sort."
      />

      <div className="space-y-5 p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi
            label="Customers"
            value={String(summary.total_customers)}
            hint={`${summary.silver_customers} Silver`}
            icon={Users}
          />
          <Kpi
            label="Silver"
            value={String(summary.silver_customers)}
            hint="Entry tier"
            tone="border-primary/40 bg-primary/5 text-primary"
            icon={Star}
          />
          <Kpi
            label="Gold"
            value={String(summary.gold_customers)}
            hint="Loyal tier"
            tone="border-gold/30 bg-gold/10 text-gold"
            icon={Star}
          />
          <Kpi
            label="Platinum"
            value={String(summary.platinum_customers)}
            hint="Top tier"
            tone="border-warning/30 bg-warning/10 text-warning"
            icon={Star}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="card-elevated overflow-hidden">
            <div className="border-b p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full sm:max-w-xs">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search customers…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    className="rounded-xl pl-9"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Sort</Label>
                  <Select value={sort} onValueChange={(v) => setSort(v as CustomerSort)}>
                    <SelectTrigger className="h-9 w-56 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SORT_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <TierChip
                  active={tier === "all"}
                  label="All"
                  count={tierCounts.all}
                  onClick={() => setTier("all")}
                />
                {tierOptions.map((t) => (
                  <TierChip
                    key={t}
                    active={tier === t}
                    label={tierLabel(t)}
                    count={tierCounts[t]}
                    onClick={() => setTier(t)}
                  />
                ))}
              </div>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm">Loading customers…</p>
              </div>
            ) : loadError ? (
              <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
                <div className="max-w-md rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {loadError}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => void refresh({ showLoading: true })}
                >
                  Try again
                </Button>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">Customer</th>
                        <th className="px-4 py-3 text-left font-medium">Contact</th>
                        <th className="px-4 py-3 text-right font-medium">Orders</th>
                        <th className="px-4 py-3 text-right font-medium">LTV</th>
                        <th className="px-4 py-3 text-left font-medium">Tier</th>
                        <th className="px-4 py-3 text-left font-medium">Last Order</th>
                        <th className="px-4 py-3 text-left font-medium">Status</th>
                        <th className="px-4 py-3 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.length === 0 ? (
                        <tr>
                          <td
                            colSpan={8}
                            className="px-4 py-16 text-center text-sm text-muted-foreground"
                          >
                            No customers found.
                            <div className="mt-1 text-xs">
                              Try clearing filters or searching by name/phone.
                            </div>
                          </td>
                        </tr>
                      ) : (
                        results.map((c) => (
                          <tr
                            key={c.public_id}
                            onClick={() => setSel(c)}
                            className={cn(
                              "cursor-pointer border-b hover:bg-muted/40",
                              sel?.public_id === c.public_id && "bg-primary/5 hover:bg-primary/5",
                            )}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-8 w-8">
                                  {c.profile_picture_url ? (
                                    <AvatarImage src={c.profile_picture_url} alt={displayName(c.full_name)} />
                                  ) : null}
                                  <AvatarFallback className="bg-primary/10 text-xs text-primary">
                                    {initials(c.full_name)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="font-medium">{displayName(c.full_name)}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {c.public_id ? `${c.public_id.slice(0, 8)}…` : "—"}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">
                              {formatCustomerPhone(c)}
                            </td>
                            <td className="px-4 py-3 text-right font-medium">
                              {c.orders_count ?? "—"}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold">
                              {c.ltv == null ? "—" : inr(c.ltv)}
                            </td>
                            <td className="px-4 py-3">
                              <StatusBadge status={tierLabel(c.tier)} />
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">
                              {formatLastOrder(c.last_order_date)}
                            </td>
                            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={c.is_active}
                                  disabled={togglingId === c.public_id}
                                  onCheckedChange={(v) => void toggleActive(c, v)}
                                />
                                <span className="text-xs text-muted-foreground">
                                  {c.is_active ? "Active" : "Inactive"}
                                </span>
                              </div>
                            </td>
                            <td
                              className="px-4 py-3 text-right"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <RowActions
                                items={[
                                  { label: "View profile", onClick: () => setSel(c) },
                                  {
                                    label: c.is_active ? "Deactivate" : "Activate",
                                    onClick: () => void toggleActive(c, !c.is_active),
                                  },
                                  { separator: true, label: "", onClick: () => {} },
                                  {
                                    label: "Delete",
                                    onClick: () => setDeleteTarget(c),
                                    destructive: true,
                                  },
                                ]}
                              />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {count > 0 && (
                  <div className="flex flex-col gap-2 border-t bg-muted/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-xs text-muted-foreground">
                      Showing <b className="text-foreground">{rangeStart}</b>–
                      <b className="text-foreground">{rangeEnd}</b> of{" "}
                      <b className="text-foreground">{count}</b>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-xl"
                        disabled={safePage === 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                      >
                        <ChevronLeft className="h-4 w-4" /> Prev
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        Page {safePage} / {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-xl"
                        disabled={safePage === totalPages}
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      >
                        Next <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="card-elevated p-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <div className="text-sm font-semibold">Loyalty Program</div>
            </div>
            <div className="mt-3 space-y-3">
              <div>
                <Label className="text-xs">Points per ₹100 spent</Label>
                <Input defaultValue="10" className="mt-1 rounded-xl" />
              </div>
              <div>
                <Label className="text-xs">Redemption Value</Label>
                <Input defaultValue="1 point = ₹1" className="mt-1 rounded-xl" />
              </div>
              <div>
                <Label className="text-xs">Points Expiry</Label>
                <Input defaultValue="12 months" className="mt-1 rounded-xl" />
              </div>
              <div className="mt-2 space-y-1.5 rounded-xl border p-3 text-xs">
                <div className="font-semibold uppercase text-muted-foreground">Tier Thresholds</div>
                <div className="flex justify-between">
                  <span>Silver</span>
                  <span>₹0 – ₹15,000</span>
                </div>
                <div className="flex justify-between">
                  <span>Gold</span>
                  <span>₹15,001 – ₹30,000</span>
                </div>
                <div className="flex justify-between">
                  <span>Platinum</span>
                  <span>₹30,000+</span>
                </div>
              </div>
              <Button
                className="w-full rounded-xl"
                onClick={() => toast.success("Loyalty settings saved")}
              >
                Save Settings
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Sheet open={!!sel} onOpenChange={(v) => !v && setSel(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {sel && (
            <>
              <SheetHeader>
                <SheetTitle>{displayName(sel.full_name)}</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-14 w-14">
                    {sel.profile_picture_url ? (
                      <AvatarImage src={sel.profile_picture_url} alt={displayName(sel.full_name)} />
                    ) : null}
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {initials(sel.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="text-sm text-muted-foreground">
                      {formatCustomerPhone(sel)}
                    </div>
                    <div className="mt-1">
                      <StatusBadge status={sel.is_active ? "Active" : "Inactive"} />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Stat label="Orders" value={sel.orders_count == null ? "—" : String(sel.orders_count)} />
                  <Stat label="LTV" value={sel.ltv == null ? "—" : inr(sel.ltv)} />
                  <Stat label="Tier" value={tierLabel(sel.tier)} />
                </div>
                <div className="rounded-xl border p-3 text-sm">
                  <div className="text-xs font-semibold uppercase text-muted-foreground">
                    Last order
                  </div>
                  <div className="mt-1">{formatLastOrder(sel.last_order_date)}</div>
                </div>
                <div className="flex items-center justify-between rounded-xl border p-3">
                  <div>
                    <div className="text-sm font-medium">Account active</div>
                    <div className="text-xs text-muted-foreground">
                      Inactive customers cannot log in
                    </div>
                  </div>
                  <Switch
                    checked={sel.is_active}
                    disabled={togglingId === sel.public_id}
                    onCheckedChange={(v) => void toggleActive(sel, v)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 rounded-xl"
                    onClick={() => void toggleActive(sel, !sel.is_active)}
                    disabled={togglingId === sel.public_id}
                  >
                    {sel.is_active ? "Deactivate" : "Activate"}
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1 rounded-xl gap-2"
                    onClick={() => setDeleteTarget(sel)}
                  >
                    <UserX className="h-4 w-4" /> Delete
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete customer?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `"${displayName(deleteTarget.full_name)}" and their profile will be permanently deleted. This cannot be undone.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TierChip({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground",
      )}
    >
      {label}
      <span
        className={cn(
          "inline-flex min-w-6 items-center justify-center rounded-full px-1 text-[10px] font-bold",
          active ? "bg-background/20 text-background" : "bg-muted text-muted-foreground",
        )}
      >
        {count}
      </span>
    </button>
  );
}

function Kpi({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof Users;
  tone?: string;
}) {
  return (
    <div className={cn("rounded-2xl border bg-card p-4 shadow-soft", tone)}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-muted text-current">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight">{value}</div>
      <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-2 text-center">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-bold">{value}</div>
    </div>
  );
}
