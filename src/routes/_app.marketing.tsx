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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  createOffer,
  deleteOffer,
  getOffer,
  listOfferRedemptions,
  listOffers,
  toggleOfferActive,
  updateOffer,
} from "@/lib/api/offers";
import { ApiError } from "@/lib/api/types";
import type {
  CreateOfferPayload,
  Offer,
  OfferChannel,
  OfferDiscountType,
  OfferRedemption,
  UpdateOfferPayload,
} from "@/lib/api/types";
import { withAuthRetry } from "@/lib/api/with-auth";
import { useAuth } from "@/lib/auth";
import { inr } from "@/lib/mock/data";
import { usePanelMeta } from "@/lib/use-panel";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  IndianRupee,
  Loader2,
  Percent,
  Plus,
  Search,
  Ticket,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/marketing")({
  component: MarketingPage,
  head: () => ({ meta: [{ title: "Coupons & Offers — Daawat Baker's" }] }),
});

const PAGE_SIZE = 20;
const REDEMPTION_PAGE_SIZE = 20;

type ActiveFilter = "all" | "active" | "inactive";
type ChannelFilter = "all" | OfferChannel;

type OfferForm = {
  code: string;
  title: string;
  description: string;
  terms: string;
  discount_type: OfferDiscountType;
  discount_value: string;
  max_discount: string;
  min_order_amount: string;
  usage_limit: string;
  per_user_limit: string;
  valid_from: string;
  valid_until: string;
  channels: OfferChannel[];
  is_active: boolean;
  sort_order: string;
};

const CHANNEL_OPTIONS: { value: OfferChannel; label: string }[] = [
  { value: "delivery", label: "Delivery" },
  { value: "pickup", label: "Pickup / Takeaway" },
  { value: "dine_in", label: "Dine-in" },
];

const ACTIVE_FILTERS: { id: ActiveFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "inactive", label: "Inactive" },
];

function emptyForm(): OfferForm {
  const today = new Date().toISOString().slice(0, 10);
  const end = new Date();
  end.setMonth(end.getMonth() + 1);
  return {
    code: "",
    title: "",
    description: "",
    terms: "",
    discount_type: "percentage",
    discount_value: "",
    max_discount: "",
    min_order_amount: "0",
    usage_limit: "",
    per_user_limit: "1",
    valid_from: today,
    valid_until: end.toISOString().slice(0, 10),
    channels: ["delivery", "pickup"],
    is_active: true,
    sort_order: "0",
  };
}

function formFromOffer(o: Offer): OfferForm {
  return {
    code: o.code,
    title: o.title,
    description: o.description ?? "",
    terms: o.terms ?? "",
    discount_type: o.discount_type,
    discount_value: String(o.discount_value),
    max_discount: o.max_discount != null ? String(o.max_discount) : "",
    min_order_amount: String(o.min_order_amount ?? 0),
    usage_limit: o.usage_limit != null ? String(o.usage_limit) : "",
    per_user_limit: String(o.per_user_limit ?? 1),
    valid_from: o.valid_from?.slice(0, 10) ?? "",
    valid_until: o.valid_until?.slice(0, 10) ?? "",
    channels: [...(o.channels ?? [])],
    is_active: o.is_active,
    sort_order: String(o.sort_order ?? 0),
  };
}

function discountLabel(o: Pick<Offer, "discount_type" | "discount_value">) {
  if (o.discount_type === "percentage") return `${o.discount_value}% OFF`;
  return `${inr(o.discount_value)} OFF`;
}

function formatDate(iso: string) {
  const raw = iso?.slice(0, 10);
  if (!raw) return "—";
  const d = new Date(raw + "T00:00:00");
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso || "—";
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function channelLabel(ch: string) {
  return CHANNEL_OPTIONS.find((c) => c.value === ch)?.label ?? ch.replace(/_/g, " ");
}

function customerName(c: OfferRedemption["customer"]) {
  const name = c?.full_name?.trim();
  return name || "Customer";
}

function customerPhone(c: OfferRedemption["customer"]) {
  const code = c?.country_code?.trim() || "";
  const phone = c?.phone_number?.trim() || "";
  if (!code) return phone || "—";
  if (!phone) return code;
  return `${code} ${phone}`;
}

function buildCreatePayload(form: OfferForm): CreateOfferPayload | { error: string } {
  const code = form.code.trim().toUpperCase().replace(/\s+/g, "");
  if (!code) return { error: "Coupon code is required" };
  if (!form.title.trim()) return { error: "Title is required" };

  const discount_value = Number(form.discount_value);
  if (!Number.isFinite(discount_value) || discount_value <= 0) {
    return { error: "Enter a valid discount value" };
  }
  if (form.discount_type === "percentage" && discount_value > 100) {
    return { error: "Percentage cannot exceed 100" };
  }
  if (form.channels.length === 0) {
    return { error: "Select at least one channel" };
  }
  if (!form.valid_from || !form.valid_until) {
    return { error: "Valid from and valid until are required" };
  }
  if (form.valid_until < form.valid_from) {
    return { error: "Valid until must be on or after valid from" };
  }

  const payload: CreateOfferPayload = {
    code,
    title: form.title.trim(),
    description: form.description.trim(),
    terms: form.terms.trim() || null,
    image: null,
    discount_type: form.discount_type,
    discount_value,
    min_order_amount: Number(form.min_order_amount) || 0,
    usage_limit: form.usage_limit.trim() ? Number(form.usage_limit) : null,
    per_user_limit: Number(form.per_user_limit) || 1,
    valid_from: form.valid_from,
    valid_until: form.valid_until,
    channels: form.channels,
    is_active: form.is_active,
    sort_order: Number(form.sort_order) || 0,
  };

  if (form.discount_type === "percentage") {
    payload.max_discount = form.max_discount.trim() ? Number(form.max_discount) : null;
  }

  return payload;
}

function patchDiff(original: Offer, form: OfferForm): UpdateOfferPayload | { error: string } {
  const created = buildCreatePayload(form);
  if ("error" in created) return created;

  const patch: UpdateOfferPayload = {};

  if (created.code !== original.code) patch.code = created.code;
  if (created.title !== original.title) patch.title = created.title;
  if (created.description !== (original.description ?? "")) patch.description = created.description;
  if ((created.terms ?? null) !== (original.terms ?? null)) patch.terms = created.terms ?? null;
  if (created.discount_type !== original.discount_type) patch.discount_type = created.discount_type;
  if (created.discount_value !== original.discount_value) patch.discount_value = created.discount_value;
  if (created.min_order_amount !== original.min_order_amount) {
    patch.min_order_amount = created.min_order_amount;
  }
  if (created.usage_limit !== original.usage_limit) patch.usage_limit = created.usage_limit;
  if (created.per_user_limit !== original.per_user_limit) {
    patch.per_user_limit = created.per_user_limit;
  }
  if (created.valid_from !== original.valid_from?.slice(0, 10)) patch.valid_from = created.valid_from;
  if (created.valid_until !== original.valid_until?.slice(0, 10)) {
    patch.valid_until = created.valid_until;
  }
  if (created.is_active !== original.is_active) patch.is_active = created.is_active;
  if ((created.sort_order ?? 0) !== (original.sort_order ?? 0)) {
    patch.sort_order = created.sort_order ?? 0;
  }

  const channelsChanged =
    created.channels.length !== original.channels.length ||
    created.channels.some((c) => !original.channels.includes(c));
  if (channelsChanged) patch.channels = created.channels;

  if (created.discount_type === "percentage") {
    const nextMax = created.max_discount ?? null;
    if (nextMax !== (original.max_discount ?? null)) patch.max_discount = nextMax;
  } else if (original.max_discount != null || original.discount_type === "percentage") {
    // Switching to flat or clearing leftover cap — omit max_discount on flat creates;
    // on update, clear if it was set.
    if (original.max_discount != null) patch.max_discount = null;
  }

  return patch;
}

function MarketingPage() {
  const navigate = useNavigate();
  const meta = usePanelMeta();

  const [results, setResults] = useState<Offer[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Offer | null>(null);
  const [form, setForm] = useState<OfferForm>(() => emptyForm());
  const [saving, setSaving] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Offer | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [redemptionsOffer, setRedemptionsOffer] = useState<Offer | null>(null);
  const [redemptions, setRedemptions] = useState<OfferRedemption[]>([]);
  const [redemptionsCount, setRedemptionsCount] = useState(0);
  const [redemptionsPage, setRedemptionsPage] = useState(1);
  const [redemptionsLoading, setRedemptionsLoading] = useState(false);
  const [redemptionsError, setRedemptionsError] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, activeFilter, channelFilter]);

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
          listOffers(token, {
            search: debouncedQ || undefined,
            is_active:
              activeFilter === "all" ? undefined : activeFilter === "active",
            channel: channelFilter === "all" ? undefined : channelFilter,
            page,
            page_size: PAGE_SIZE,
          }),
        );
        setResults(data.results ?? []);
        setCount(data.count ?? 0);
        const maxPage = Math.max(1, Math.ceil((data.count ?? 0) / (data.page_size || PAGE_SIZE)));
        if (page > maxPage) {
          setPage(maxPage);
        }
      } catch (err) {
        if (handleAuthError(err)) return;
        const message = err instanceof ApiError ? err.message : "Unable to load offers.";
        if (showLoading) setLoadError(message);
        else toast.error(message);
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [debouncedQ, activeFilter, channelFilter, page, handleAuthError],
  );

  useEffect(() => {
    void refresh({ showLoading: true });
  }, [refresh]);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const rangeStart = count === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, count);

  const stats = useMemo(() => {
    const active = results.filter((o) => o.is_active).length;
    const redemptionsTotal = results.reduce((s, o) => s + (o.redemption_count ?? 0), 0);
    return { shown: results.length, active, redemptionsTotal, count };
  }, [results, count]);

  function setField<K extends keyof OfferForm>(key: K, value: OfferForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleChannel(ch: OfferChannel) {
    setForm((f) => ({
      ...f,
      channels: f.channels.includes(ch)
        ? f.channels.filter((c) => c !== ch)
        : [...f.channels, ch],
    }));
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setSheetOpen(true);
  }

  async function openEdit(o: Offer) {
    setEditing(o);
    setForm(formFromOffer(o));
    setSheetOpen(true);
    setLoadingDetail(true);
    try {
      const detail = await withAuthRetry((token) => getOffer(token, o.public_id));
      setEditing(detail);
      setForm(formFromOffer(detail));
    } catch (err) {
      if (handleAuthError(err)) return;
      toast.error(err instanceof ApiError ? err.message : "Unable to load offer");
    } finally {
      setLoadingDetail(false);
    }
  }

  async function saveOffer() {
    if (editing) {
      const diff = patchDiff(editing, form);
      if ("error" in diff) {
        toast.error(diff.error);
        return;
      }
      if (Object.keys(diff).length === 0) {
        toast.message("No changes to save");
        setSheetOpen(false);
        return;
      }
      setSaving(true);
      try {
        await withAuthRetry((token) => updateOffer(token, editing.public_id, diff));
        toast.success(`${(diff.code ?? editing.code).toUpperCase()} updated`);
        setSheetOpen(false);
        await refresh({ showLoading: false });
      } catch (err) {
        if (handleAuthError(err)) return;
        toast.error(err instanceof ApiError ? err.message : "Unable to update offer");
      } finally {
        setSaving(false);
      }
      return;
    }

    const payload = buildCreatePayload(form);
    if ("error" in payload) {
      toast.error(payload.error);
      return;
    }
    setSaving(true);
    try {
      const created = await withAuthRetry((token) => createOffer(token, payload));
      toast.success(`${created.code} created`);
      setSheetOpen(false);
      setPage(1);
      await refresh({ showLoading: false });
    } catch (err) {
      if (handleAuthError(err)) return;
      toast.error(err instanceof ApiError ? err.message : "Unable to create offer");
    } finally {
      setSaving(false);
    }
  }

  async function onToggleActive(o: Offer, next: boolean) {
    setTogglingId(o.public_id);
    try {
      const updated = await withAuthRetry((token) =>
        toggleOfferActive(token, o.public_id, { is_active: next }),
      );
      setResults((prev) =>
        prev.map((x) => (x.public_id === o.public_id ? { ...x, ...updated } : x)),
      );
      toast.success(next ? `${updated.code} activated` : `${updated.code} deactivated`);
    } catch (err) {
      if (handleAuthError(err)) return;
      toast.error(err instanceof ApiError ? err.message : "Unable to update status");
    } finally {
      setTogglingId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await withAuthRetry((token) => deleteOffer(token, deleteTarget.public_id));
      toast.success(`${deleteTarget.code} deleted`);
      setDeleteTarget(null);
      await refresh({ showLoading: false });
    } catch (err) {
      if (handleAuthError(err)) return;
      if (err instanceof ApiError && err.code === "offer_has_redemptions") {
        toast.error(err.message || "Cannot delete — deactivate this offer instead.");
        setDeleteTarget(null);
        return;
      }
      toast.error(err instanceof ApiError ? err.message : "Unable to delete offer");
    } finally {
      setDeleting(false);
    }
  }

  function copyCode(code: string) {
    void navigator.clipboard.writeText(code);
    toast.success(`${code} copied`);
  }

  async function openRedemptions(o: Offer) {
    setRedemptionsOffer(o);
    setRedemptionsPage(1);
    setRedemptions([]);
    setRedemptionsCount(0);
    setRedemptionsError("");
  }

  const redemptionsOfferId = redemptionsOffer?.public_id ?? null;

  const loadRedemptions = useCallback(
    async (options?: { showLoading?: boolean }) => {
      if (!redemptionsOfferId) return;
      const showLoading = options?.showLoading ?? true;
      if (showLoading) {
        setRedemptionsLoading(true);
        setRedemptionsError("");
      }
      try {
        const data = await withAuthRetry((token) =>
          listOfferRedemptions(token, redemptionsOfferId, {
            page: redemptionsPage,
            page_size: REDEMPTION_PAGE_SIZE,
          }),
        );
        setRedemptions(data.results ?? []);
        setRedemptionsCount(data.count ?? 0);
      } catch (err) {
        if (handleAuthError(err)) return;
        const message = err instanceof ApiError ? err.message : "Unable to load redemptions.";
        if (showLoading) setRedemptionsError(message);
        else toast.error(message);
      } finally {
        if (showLoading) setRedemptionsLoading(false);
      }
    },
    [redemptionsOfferId, redemptionsPage, handleAuthError],
  );

  useEffect(() => {
    if (!redemptionsOfferId) return;
    void loadRedemptions({ showLoading: true });
  }, [redemptionsOfferId, redemptionsPage, loadRedemptions]);

  const redemptionPages = Math.max(1, Math.ceil(redemptionsCount / REDEMPTION_PAGE_SIZE));

  return (
    <div>
      <PageHeader
        title="Coupons & Offers"
        crumbs={["Growth", "Marketing"]}
        description={`Create discount coupons for ${meta.label} — customers redeem at checkout.`}
        action={
          <Button className="rounded-xl gap-2" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Create coupon
          </Button>
        }
      />

      <div className="space-y-5 p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total offers", value: stats.count },
            { label: "On this page", value: stats.shown },
            { label: "Active (page)", value: stats.active },
            { label: "Redemptions (page)", value: stats.redemptionsTotal },
          ].map((s) => (
            <div key={s.label} className="card-elevated px-4 py-3">
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</div>
            </div>
          ))}
        </div>

        <div className="card-elevated overflow-hidden">
          <div className="border-b p-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full sm:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search code or title…"
                  className="rounded-xl pl-9"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap gap-1.5">
                  {ACTIVE_FILTERS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setActiveFilter(f.id)}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-sm transition-colors",
                        activeFilter === f.id
                          ? "border-primary bg-primary/10 font-medium text-primary"
                          : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <Select
                  value={channelFilter}
                  onValueChange={(v) => setChannelFilter(v as ChannelFilter)}
                >
                  <SelectTrigger className="h-9 w-44 rounded-xl">
                    <SelectValue placeholder="Channel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All channels</SelectItem>
                    {CHANNEL_OPTIONS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm">Loading offers…</p>
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
              <div className="max-w-md rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {loadError}
              </div>
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => void refresh({ showLoading: true })}
              >
                Retry
              </Button>
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Ticket className="h-6 w-6" />
              </div>
              <div>
                <div className="font-semibold">No coupons found</div>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Create a coupon code customers can enter when placing an order.
                </p>
              </div>
              <Button className="mt-2 rounded-xl gap-2" onClick={openCreate}>
                <Plus className="h-4 w-4" /> Create coupon
              </Button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px] text-left text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-3 font-medium">Coupon</th>
                      <th className="px-4 py-3 font-medium">Discount</th>
                      <th className="px-4 py-3 font-medium">Channels</th>
                      <th className="px-4 py-3 font-medium">Validity</th>
                      <th className="px-4 py-3 font-medium">Usage</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((o) => (
                      <tr key={o.public_id} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="px-4 py-3 align-top">
                          <button
                            type="button"
                            onClick={() => copyCode(o.code)}
                            className="group flex items-center gap-1.5 font-mono text-base font-bold tracking-wide"
                            title="Copy code"
                          >
                            {o.code}
                            <Copy className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-50" />
                          </button>
                          <div className="mt-0.5 font-medium">{o.title}</div>
                          <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                            {o.description || "—"}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="flex items-center gap-1.5 font-semibold text-primary">
                            {o.discount_type === "percentage" ? (
                              <Percent className="h-3.5 w-3.5" />
                            ) : (
                              <IndianRupee className="h-3.5 w-3.5" />
                            )}
                            {discountLabel(o)}
                          </div>
                          {o.discount_type === "percentage" && o.max_discount != null && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              Cap {inr(o.max_discount)}
                            </div>
                          )}
                          <div className="mt-1 text-xs text-muted-foreground">
                            Min{" "}
                            {o.min_order_amount > 0 ? inr(o.min_order_amount) : "none"}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="flex flex-wrap gap-1">
                            {(o.channels ?? []).map((ch) => (
                              <span
                                key={ch}
                                className="rounded-md border bg-background px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground"
                              >
                                {ch.replace("_", " ")}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top text-xs">
                          <div>{formatDate(o.valid_from)}</div>
                          <div className="text-muted-foreground">
                            → {formatDate(o.valid_until)}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="font-semibold tabular-nums">
                            {o.redemption_count ?? 0}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {o.remaining_redemptions != null
                              ? `${o.remaining_redemptions} left`
                              : o.usage_limit != null
                                ? `of ${o.usage_limit}`
                                : "Unlimited"}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="flex flex-col gap-2">
                            <StatusBadge status={o.is_active ? "Active" : "Inactive"} />
                            {o.is_currently_valid ? (
                              <span className="inline-flex w-fit rounded-full border border-success/30 bg-success/15 px-2 py-0.5 text-[10px] font-medium text-success">
                                Currently valid
                              </span>
                            ) : (
                              <span className="inline-flex w-fit rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                Outside window
                              </span>
                            )}
                            <Switch
                              checked={o.is_active}
                              disabled={togglingId === o.public_id}
                              onCheckedChange={(v) => void onToggleActive(o, v)}
                              aria-label={`Toggle ${o.code}`}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top text-right">
                          <RowActions
                            items={[
                              { label: "Edit", onClick: () => void openEdit(o) },
                              {
                                label: "View redemptions",
                                onClick: () => void openRedemptions(o),
                              },
                              { label: "Copy code", onClick: () => copyCode(o.code) },
                              { separator: true, label: "", onClick: () => {} },
                              {
                                label: "Delete",
                                onClick: () => setDeleteTarget(o),
                                destructive: true,
                              },
                            ]}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 border-t px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <div>
                  Showing{" "}
                  <span className="font-medium text-foreground">
                    {rangeStart}–{rangeEnd}
                  </span>{" "}
                  of <span className="font-medium text-foreground">{count}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg"
                    disabled={safePage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="tabular-nums">
                    {safePage} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg"
                    disabled={safePage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{editing ? "Edit coupon" : "Create coupon"}</SheetTitle>
          </SheetHeader>

          {loadingDetail ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading…
            </div>
          ) : (
            <div className="mt-6 space-y-5 pb-8">
              <section className="space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Basics
                </div>
                <div>
                  <Label htmlFor="coupon-code">Coupon code</Label>
                  <Input
                    id="coupon-code"
                    value={form.code}
                    onChange={(e) => setField("code", e.target.value.toUpperCase())}
                    placeholder="e.g. SAVE20"
                    className="mt-1 rounded-xl font-mono tracking-wider"
                    maxLength={32}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Unique code — backend uppercases it. Customers enter this at checkout.
                  </p>
                </div>
                <div>
                  <Label htmlFor="coupon-title">Title</Label>
                  <Input
                    id="coupon-title"
                    value={form.title}
                    onChange={(e) => setField("title", e.target.value)}
                    placeholder="e.g. Save 20%"
                    className="mt-1 rounded-xl"
                  />
                </div>
                <div>
                  <Label htmlFor="coupon-desc">Description</Label>
                  <Textarea
                    id="coupon-desc"
                    value={form.description}
                    onChange={(e) => setField("description", e.target.value)}
                    placeholder="Short offer description"
                    className="mt-1 min-h-[72px] rounded-xl"
                  />
                </div>
                <div>
                  <Label htmlFor="coupon-terms">Terms (optional)</Label>
                  <Textarea
                    id="coupon-terms"
                    value={form.terms}
                    onChange={(e) => setField("terms", e.target.value)}
                    placeholder="e.g. Once per user"
                    className="mt-1 min-h-[64px] rounded-xl"
                  />
                </div>
              </section>

              <section className="space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Discount
                </div>
                <div>
                  <Label>Type</Label>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    {(
                      [
                        { value: "percentage" as const, label: "Percentage %", icon: Percent },
                        { value: "flat" as const, label: "Flat ₹", icon: IndianRupee },
                      ] as const
                    ).map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setField("discount_type", t.value)}
                        className={cn(
                          "flex items-center justify-center gap-2 rounded-xl border p-3 text-sm transition-colors",
                          form.discount_type === t.value
                            ? "border-primary bg-primary/10 font-medium text-primary"
                            : "hover:border-primary/40",
                        )}
                      >
                        <t.icon className="h-4 w-4" />
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="discount-value">
                      {form.discount_type === "percentage" ? "Percent off" : "Amount off (₹)"}
                    </Label>
                    <Input
                      id="discount-value"
                      type="number"
                      min={0}
                      max={form.discount_type === "percentage" ? 100 : undefined}
                      value={form.discount_value}
                      onChange={(e) => setField("discount_value", e.target.value)}
                      placeholder={form.discount_type === "percentage" ? "20" : "100"}
                      className="mt-1 rounded-xl"
                    />
                  </div>
                  <div>
                    <Label htmlFor="max-discount">Max discount (₹)</Label>
                    <Input
                      id="max-discount"
                      type="number"
                      min={0}
                      disabled={form.discount_type === "flat"}
                      value={form.discount_type === "flat" ? "" : form.max_discount}
                      onChange={(e) => setField("max_discount", e.target.value)}
                      placeholder={form.discount_type === "flat" ? "N/A for flat" : "e.g. 100"}
                      className="mt-1 rounded-xl"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="min-order">Min order amount (₹)</Label>
                    <Input
                      id="min-order"
                      type="number"
                      min={0}
                      value={form.min_order_amount}
                      onChange={(e) => setField("min_order_amount", e.target.value)}
                      className="mt-1 rounded-xl"
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Limits & channels
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="usage-limit">Total usage limit</Label>
                    <Input
                      id="usage-limit"
                      type="number"
                      min={0}
                      value={form.usage_limit}
                      onChange={(e) => setField("usage_limit", e.target.value)}
                      placeholder="Unlimited"
                      className="mt-1 rounded-xl"
                    />
                  </div>
                  <div>
                    <Label htmlFor="per-user">Per user limit</Label>
                    <Input
                      id="per-user"
                      type="number"
                      min={1}
                      value={form.per_user_limit}
                      onChange={(e) => setField("per_user_limit", e.target.value)}
                      className="mt-1 rounded-xl"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="sort-order">Sort order</Label>
                    <Input
                      id="sort-order"
                      type="number"
                      value={form.sort_order}
                      onChange={(e) => setField("sort_order", e.target.value)}
                      className="mt-1 rounded-xl"
                    />
                  </div>
                </div>
                <div>
                  <Label>Applicable on</Label>
                  <div className="mt-2 space-y-2">
                    {CHANNEL_OPTIONS.map((ch) => (
                      <label
                        key={ch.value}
                        className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted/40"
                      >
                        <Checkbox
                          checked={form.channels.includes(ch.value)}
                          onCheckedChange={() => toggleChannel(ch.value)}
                        />
                        {ch.label}
                      </label>
                    ))}
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Validity
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="valid-from">Valid from</Label>
                    <Input
                      id="valid-from"
                      type="date"
                      value={form.valid_from}
                      onChange={(e) => setField("valid_from", e.target.value)}
                      className="mt-1 rounded-xl"
                    />
                  </div>
                  <div>
                    <Label htmlFor="valid-until">Valid until</Label>
                    <Input
                      id="valid-until"
                      type="date"
                      value={form.valid_until}
                      onChange={(e) => setField("valid_until", e.target.value)}
                      className="mt-1 rounded-xl"
                    />
                  </div>
                </div>
                <label className="flex items-center justify-between rounded-xl border px-3 py-3">
                  <div>
                    <div className="text-sm font-medium">Active</div>
                    <div className="text-xs text-muted-foreground">
                      Customers can redeem while active & within dates
                    </div>
                  </div>
                  <Switch
                    checked={form.is_active}
                    onCheckedChange={(v) => setField("is_active", v)}
                  />
                </label>
              </section>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl"
                  disabled={saving}
                  onClick={() => setSheetOpen(false)}
                >
                  Cancel
                </Button>
                <Button className="flex-1 rounded-xl" disabled={saving} onClick={() => void saveOffer()}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
                    </>
                  ) : editing ? (
                    "Save changes"
                  ) : (
                    "Create coupon"
                  )}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Sheet
        open={!!redemptionsOffer}
        onOpenChange={(open) => {
          if (!open) setRedemptionsOffer(null);
        }}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>
              Redemptions
              {redemptionsOffer ? (
                <span className="ml-2 font-mono text-base text-muted-foreground">
                  {redemptionsOffer.code}
                </span>
              ) : null}
            </SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-4 pb-8">
            {redemptionsOffer && (
              <p className="text-sm text-muted-foreground">{redemptionsOffer.title}</p>
            )}

            {redemptionsLoading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading redemptions…
              </div>
            ) : redemptionsError ? (
              <div className="space-y-3 text-center">
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {redemptionsError}
                </div>
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => void loadRedemptions({ showLoading: true })}
                >
                  Retry
                </Button>
              </div>
            ) : redemptions.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">
                No redemptions yet for this coupon.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-xl border">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-3 py-2 font-medium">Customer</th>
                        <th className="px-3 py-2 font-medium">Channel</th>
                        <th className="px-3 py-2 font-medium">Discount</th>
                        <th className="px-3 py-2 font-medium">When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {redemptions.map((r) => (
                        <tr key={r.public_id} className="border-b last:border-0">
                          <td className="px-3 py-2 align-top">
                            <div className="font-medium">{customerName(r.customer)}</div>
                            <div className="text-xs text-muted-foreground">
                              {customerPhone(r.customer)}
                            </div>
                          </td>
                          <td className="px-3 py-2 align-top text-xs capitalize">
                            {channelLabel(r.channel)}
                          </td>
                          <td className="px-3 py-2 align-top">
                            <div className="font-medium tabular-nums">
                              {inr(r.discount_amount)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              on {inr(r.order_subtotal)}
                            </div>
                          </td>
                          <td className="px-3 py-2 align-top text-xs text-muted-foreground">
                            {formatDateTime(r.redeemed_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>
                    {redemptionsCount} redemption{redemptionsCount === 1 ? "" : "s"}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-lg"
                      disabled={redemptionsPage <= 1}
                      onClick={() => setRedemptionsPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="tabular-nums">
                      {redemptionsPage} / {redemptionPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-lg"
                      disabled={redemptionsPage >= redemptionPages}
                      onClick={() =>
                        setRedemptionsPage((p) => Math.min(redemptionPages, p + 1))
                      }
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.code}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the coupon. If it already has redemptions, the API will
              block delete — deactivate it instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
