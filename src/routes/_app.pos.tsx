import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { InvoiceDocument } from "@/components/app/invoice-document";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RowActions } from "@/components/app/row-actions";
import {
  getInvoice,
  listInvoices,
  formatInvoiceDateTime,
  formatInvoiceMoney,
} from "@/lib/api/invoices";
import { fulfillmentLabel, paymentLabel } from "@/lib/api/orders";
import { getApiBaseUrl } from "@/lib/api/client";
import { createPosBill, getPosBill, getPosMenu, listPosBills } from "@/lib/api/pos";
import {
  ApiError,
  type InvoiceDetail,
  type PosBill,
  type PosBillListData,
  type PosAddonGroup,
  type PosMenuData,
  type PosMenuItem,
  type PosPaymentMethod,
} from "@/lib/api/types";
import { withAuthRetry } from "@/lib/api/with-auth";
import { useAccess } from "@/lib/access";
import { useAuth } from "@/lib/auth";
import { printInvoicePdf } from "@/lib/invoice-export";
import { cn } from "@/lib/utils";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Receipt,
  Smartphone,
  Wallet,
  CreditCard,
  History,
  Loader2,
  Printer,
  FileText,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/pos")({
  component: POSPage,
  head: () => ({ meta: [{ title: "POS & Billing — Daawat Baker's" }] }),
});

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const money = formatInvoiceMoney;

type CartLine = {
  key: string;
  item: PosMenuItem;
  variant: string;
  addons: { name: string; price: number }[];
  unit: number;
  qty: number;
};

const PAYMENTS: { m: PosPaymentMethod; label: string; icon: typeof Wallet }[] = [
  { m: "upi", label: "UPI", icon: Smartphone },
  { m: "cash", label: "Cash", icon: Wallet },
  { m: "card", label: "Card", icon: CreditCard },
];

function mediaUrl(url: string | null): string | null {
  if (!url) return null;
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  try {
    return `${getApiBaseUrl()}${url.startsWith("/") ? url : `/${url}`}`;
  } catch {
    return url;
  }
}

function ItemThumb({ item }: { item: PosMenuItem }) {
  const [failed, setFailed] = useState(false);
  const src = mediaUrl(item.image);
  if (src && !failed) {
    return (
      <img
        src={src}
        alt={item.name}
        className="h-full w-full object-cover"
        loading="lazy"
        onError={() => setFailed(true)}
      />
    );
  }
  return <>{item.dietary === "veg" ? "🥗" : "🍗"}</>;
}

const MENU_PAGE_SIZE = 20;

function lineKey(itemId: string, variant: string, addons: string[]) {
  return [itemId, variant, ...[...addons].sort()].join("|");
}

function errMessage(err: unknown, fallback: string) {
  return err instanceof ApiError || err instanceof Error ? err.message : fallback;
}

function POSPage() {
  const { canView } = useAccess();
  const business = useAuth((s) => s.business);

  if (!canView("orders")) {
    return (
      <div>
        <PageHeader title="POS & Billing" crumbs={["Operations", "POS"]} />
        <div className="p-8 text-sm text-muted-foreground">
          You do not have permission to use POS.
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={`${business?.name ?? "POS"} POS`}
        crumbs={["Operations", "POS"]}
        description={`Billing for ${business?.name ?? "the selected business"} only`}
      />
      <div className="p-4 sm:p-6 lg:p-8">
        {business ? (
          <Tabs defaultValue="new" key={business.publicId}>
            <TabsList className="rounded-xl">
              <TabsTrigger value="new">New Bill</TabsTrigger>
              <TabsTrigger value="history">
                <History className="mr-1.5 h-3.5 w-3.5" /> Bill History
              </TabsTrigger>
            </TabsList>
            <TabsContent value="new" className="mt-4">
              <POSCounter businessId={business.publicId} />
            </TabsContent>
            <TabsContent value="history" className="mt-4">
              <BillHistory businessId={business.publicId} />
            </TabsContent>
          </Tabs>
        ) : (
          <div className="text-sm text-muted-foreground">Select a business to start billing.</div>
        )}
      </div>
    </div>
  );
}

function POSCounter({ businessId }: { businessId: string }) {
  const { canManage } = useAccess();
  const canBill = canManage("orders");

  const [items, setItems] = useState<PosMenuItem[]>([]);
  const [categories, setCategories] = useState<PosMenuData["categories"]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState("");

  const [cat, setCat] = useState<string>("all");
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [code, setCode] = useState("");
  const [dineIn, setDineIn] = useState(false);
  const [discountPct, setDiscountPct] = useState(0);
  const [pay, setPay] = useState<PosPaymentMethod>("upi");
  const [pickQueue, setPickQueue] = useState<PosMenuItem[]>([]);
  const [lookingUp, setLookingUp] = useState(false);
  const [debouncedQ, setDebouncedQ] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [receipt, setReceipt] = useState<PosBill | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const pageRef = useRef(1);

  const fetchPage = useCallback(
    async (pageNum: number) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const append = pageNum > 1;
      if (append) setLoadingMore(true);
      else setLoading(true);
      setLoadError("");
      try {
        const data = await withAuthRetry((t) =>
          getPosMenu(
            t,
            {
              business_public_id: businessId,
              page: pageNum,
              page_size: MENU_PAGE_SIZE,
              q: debouncedQ || undefined,
              category_public_id: cat === "all" ? undefined : cat,
            },
            ctrl.signal,
          ),
        );
        if (ctrl.signal.aborted) return;
        setItems((prev) => {
          if (!append) return data.results;
          const seen = new Set(prev.map((i) => i.public_id));
          return [...prev, ...data.results.filter((i) => !seen.has(i.public_id))];
        });
        setCategories(data.categories);
        setCount(data.count);
        setPage(data.page);
        pageRef.current = data.page;
      } catch (err) {
        if (ctrl.signal.aborted || (err instanceof DOMException && err.name === "AbortError")) {
          return;
        }
        setLoadError(errMessage(err, "Unable to load the menu."));
      } finally {
        if (abortRef.current === ctrl) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [businessId, debouncedQ, cat],
  );

  // Debounce the search box.
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  // Reload page 1 whenever the business, search or category changes.
  useEffect(() => {
    void fetchPage(1);
    return () => abortRef.current?.abort();
  }, [fetchPage]);

  const hasMore = page * MENU_PAGE_SIZE < count;
  const loadMore = () => {
    if (hasMore && !loading && !loadingMore) void fetchPage(pageRef.current + 1);
  };
  const categoryName = useMemo(
    () => new Map(categories.map((c) => [c.public_id, c.name])),
    [categories],
  );

  function addLine(item: PosMenuItem, variant: string, addons: { name: string; price: number }[]) {
    const base = item.variants.find((v) => v.name === variant)?.price ?? item.price;
    const unit = round2(base + addons.reduce((s, a) => s + a.price, 0));
    const key = lineKey(
      item.public_id,
      variant,
      addons.map((a) => a.name),
    );
    setCart((prev) => {
      if (prev.some((l) => l.key === key)) {
        return prev.map((l) => (l.key === key ? { ...l, qty: Math.min(99, l.qty + 1) } : l));
      }
      return [...prev, { key, item, variant, addons, unit, qty: 1 }];
    });
  }

  const needsChoice = (item: PosMenuItem) =>
    item.variants.length > 0 || item.addon_groups.length > 0;

  function onPickItem(item: PosMenuItem) {
    if (needsChoice(item)) {
      setPickQueue([item]);
      return;
    }
    addLine(item, "", []);
  }

  async function submitCode() {
    if (lookingUp) return;
    const codes = code
      .split("+")
      .map((s) => s.trim())
      .filter(Boolean);
    if (codes.length === 0) return;
    setLookingUp(true);
    try {
      // Separate requests: the product grid is not touched.
      const unique = [...new Set(codes.map((c) => c.slice(0, 16)))];
      const found = new Map<string, PosMenuItem | null>();
      await Promise.all(
        unique.map(async (c) => {
          try {
            const data = await withAuthRetry((t) =>
              getPosMenu(t, { business_public_id: businessId, code: c, page_size: 1 }),
            );
            found.set(c, data.results[0] ?? null);
          } catch (err) {
            toast.error(errMessage(err, `Unable to look up code ${c}.`));
            found.set(c, null);
          }
        }),
      );
      const queue: PosMenuItem[] = [];
      for (const c of codes) {
        const item = found.get(c.slice(0, 16));
        if (!item) {
          if (found.has(c.slice(0, 16))) toast.error(`Item code ${c} not found`);
          continue;
        }
        if (needsChoice(item)) queue.push(item);
        else addLine(item, "", []);
      }
      if (queue.length) setPickQueue(queue);
      setCode("");
    } finally {
      setLookingUp(false);
    }
  }

  const subtotal = round2(cart.reduce((s, l) => s + l.qty * l.unit, 0));
  const pct = Math.min(100, Math.max(0, Number.isFinite(discountPct) ? discountPct : 0));
  const discount = round2((subtotal * pct) / 100);
  const total = round2(subtotal - discount);

  function resetBill() {
    setCart([]);
    setCode("");
    setDiscountPct(0);
    setDineIn(false);
    setPay("upi");
  }

  async function generateBill() {
    if (submittingRef.current) return;
    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const invoice = await withAuthRetry((t) =>
        createPosBill(t, {
          business_public_id: businessId,
          items: cart.map((l) => ({
            menu_item_public_id: l.item.public_id,
            quantity: l.qty,
            variant_name: l.variant,
            addons: l.addons.map((a) => ({ name: a.name })),
          })),
          payment_method: pay,
          fulfillment_type: dineIn ? "dine_in" : "takeaway",
          discount_percent: pct,
        }),
      );
      setReceipt(invoice);
      resetBill();
      toast.success(`Bill ${invoice.invoice.invoice_number} generated`);
    } catch (err) {
      toast.error(errMessage(err, "Unable to generate the bill."));
      if (err instanceof ApiError && err.code === "menu_item_not_found") void fetchPage(1);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-4 lg:h-[calc(100vh-15rem)] lg:min-h-[520px] lg:grid-cols-[1fr_400px]">
      {/* Products */}
      <div className="card-elevated flex min-h-0 flex-col overflow-hidden">
        <div className="border-b p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-48 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search item…"
                maxLength={64}
                className="rounded-xl pl-9"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              className="rounded-xl"
              onClick={() => void fetchPage(1)}
              disabled={loading}
              aria-label="Reload menu"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {[{ public_id: "all", name: "All" }, ...categories].map((c) => (
              <button
                key={c.public_id}
                onClick={() => setCat(c.public_id)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${cat === c.public_id ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"}`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
        {loading && items.length === 0 ? (
          <div className="grid place-items-center p-10 text-sm text-muted-foreground">
            <Loader2 className="mb-2 h-5 w-5 animate-spin" /> Loading menu…
          </div>
        ) : loadError ? (
          <div className="grid place-items-center gap-3 p-10 text-sm text-destructive">
            {loadError}
            <Button variant="outline" size="sm" onClick={() => void fetchPage(1)}>
              Retry
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="grid place-items-center p-10 text-sm text-muted-foreground">
            No items found.
          </div>
        ) : (
          <div
            className="min-h-0 flex-1 overflow-y-auto p-3"
            onScroll={(e) => {
              const el = e.currentTarget;
              if (el.scrollHeight - el.scrollTop - el.clientHeight < 240) loadMore();
            }}
          >
            <div
              className={cn(
                "grid grid-cols-2 content-start gap-3 sm:grid-cols-3 xl:grid-cols-4",
                loading && "opacity-60",
              )}
            >
              {items.map((m) => (
                <button
                  key={m.public_id}
                  onClick={() => onPickItem(m)}
                  className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card p-3 text-left transition-all hover:border-primary/50 hover:shadow-md"
                >
                  <div className="mb-2 grid h-20 place-items-center overflow-hidden rounded-lg bg-gradient-to-br from-primary/10 to-gold/20 text-2xl">
                    <ItemThumb item={m} />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{m.item_code ? `#${m.item_code}` : ""}</span>
                    <span className="truncate pl-1">
                      {m.category_public_id ? categoryName.get(m.category_public_id) : ""}
                    </span>
                  </div>
                  <div className="mt-0.5 line-clamp-2 text-sm font-medium">{m.name}</div>
                  <div className="mt-1 text-sm font-bold text-primary">
                    {m.variants.length > 0
                      ? `from ${money(Math.min(...m.variants.map((v) => v.price)))}`
                      : money(m.price)}
                  </div>
                </button>
              ))}
            </div>
            {hasMore && (
              <div className="grid place-items-center py-3">
                <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                  Load more ({items.length} of {count})
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cart */}
      <div className="card-elevated flex min-h-0 flex-col overflow-hidden">
        <div className="border-b p-3">
          <div className="mb-2 text-sm font-semibold">Current Bill</div>
          <div className="flex gap-2">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter code: 22+67"
              maxLength={80}
              onKeyDown={(e) => e.key === "Enter" && void submitCode()}
              disabled={lookingUp}
              className="rounded-xl font-mono"
            />
            <Button className="rounded-xl" onClick={() => void submitCode()} disabled={lookingUp}>
              {lookingUp && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Add
            </Button>
          </div>
        </div>

        <div className="min-h-24 flex-1 space-y-2 overflow-y-auto p-3">
          {cart.length === 0 && (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">
              <div className="text-center">
                <Receipt className="mx-auto mb-2 h-8 w-8 opacity-30" />
                No items yet. Tap products or punch codes.
              </div>
            </div>
          )}
          {cart.map((c) => (
            <div key={c.key} className="rounded-xl border p-2.5">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1 pr-2">
                  <div className="truncate text-sm font-medium">
                    {c.item.name}
                    {c.variant && ` (${c.variant})`}
                  </div>
                  {c.addons.length > 0 && (
                    <div className="truncate text-[11px] text-muted-foreground">
                      + {c.addons.map((a) => a.name).join(", ")}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    {money(c.unit)} × {c.qty}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7"
                    onClick={() =>
                      setCart((p) =>
                        p.map((x) => (x.key === c.key ? { ...x, qty: Math.max(1, x.qty - 1) } : x)),
                      )
                    }
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-6 text-center text-sm">{c.qty}</span>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7"
                    onClick={() =>
                      setCart((p) =>
                        p.map((x) =>
                          x.key === c.key ? { ...x, qty: Math.min(99, x.qty + 1) } : x,
                        ),
                      )
                    }
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive"
                    onClick={() => setCart((p) => p.filter((x) => x.key !== c.key))}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t bg-muted/20 p-3 text-sm">
          <div className="mb-2 flex items-center justify-between rounded-lg border p-2">
            <span className="text-xs">Dine-In</span>
            <Switch checked={dineIn} onCheckedChange={setDineIn} />
          </div>
          <div className="flex items-center justify-between py-1">
            <span>Subtotal</span>
            <span>{money(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span>Discount %</span>
            <Input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={discountPct}
              onChange={(e) => {
                const n = Number(e.target.value);
                setDiscountPct(Number.isFinite(n) ? Math.min(100, Math.max(0, round2(n))) : 0);
              }}
              className="h-7 w-20 text-right text-xs"
            />
          </div>
          {discount > 0 && (
            <div className="flex items-center justify-between py-1 text-primary">
              <span>Discount</span>
              <span>− {money(discount)}</span>
            </div>
          )}
          <div className="mt-2 flex items-center justify-between border-t pt-2 text-base font-bold">
            <span>Total</span>
            <span className="text-primary">{money(total)}</span>
          </div>
          <div className="mt-0.5 text-right text-[10px] text-muted-foreground">
            Prices include GST · CGST/SGST shown on the bill
          </div>

          <div className="mt-3 grid grid-cols-3 gap-1.5">
            {PAYMENTS.map(({ m, label, icon: Icon }) => (
              <button
                key={m}
                onClick={() => setPay(m)}
                className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-[10px] transition-colors ${pay === m ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
          <Button
            className="mt-3 w-full rounded-xl"
            onClick={() => void generateBill()}
            disabled={submitting || !canBill || cart.length === 0}
          >
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Receipt className="mr-2 h-4 w-4" />
            )}
            Generate Bill
          </Button>
          {!canBill && (
            <div className="mt-1 text-center text-[11px] text-muted-foreground">
              You don't have permission to create bills.
            </div>
          )}
        </div>
      </div>

      <OptionsDialog
        key={pickQueue.length}
        item={pickQueue[0] ?? null}
        onClose={() => setPickQueue([])}
        onConfirm={(item, variant, addons) => {
          addLine(item, variant, addons);
          setPickQueue((prev) => prev.slice(1));
        }}
      />
      <ReceiptDialog bill={receipt} onClose={() => setReceipt(null)} closeLabel="New Bill" />
    </div>
  );
}

function OptionsDialog({
  item,
  onClose,
  onConfirm,
}: {
  item: PosMenuItem | null;
  onClose: () => void;
  onConfirm: (
    item: PosMenuItem,
    variant: string,
    addons: { name: string; price: number }[],
  ) => void;
}) {
  const [variant, setVariant] = useState("");
  const [chosen, setChosen] = useState<Record<string, string[]>>({});

  useEffect(() => {
    setVariant("");
    setChosen({});
  }, [item]);

  if (!item) return <Dialog open={false} onOpenChange={() => {}} />;

  const groupError = (g: PosAddonGroup) => {
    const n = (chosen[g.name] ?? []).length;
    if (n < g.min_select) return `Choose at least ${g.min_select}`;
    if (g.max_select > 0 && n > g.max_select) return `Choose at most ${g.max_select}`;
    return "";
  };
  const needsVariant = item.variants.length > 0 && !variant;
  const invalid = needsVariant || item.addon_groups.some((g) => groupError(g));

  const addons = item.addon_groups.flatMap((g) =>
    (chosen[g.name] ?? []).map((name) => ({
      name,
      price: g.options.find((o) => o.name === name)?.price ?? 0,
    })),
  );
  const base = item.variants.find((v) => v.name === variant)?.price ?? item.price;
  const unit = round2(base + addons.reduce((s, a) => s + a.price, 0));

  function toggle(g: PosAddonGroup, name: string) {
    setChosen((prev) => {
      const cur = prev[g.name] ?? [];
      if (cur.includes(name)) return { ...prev, [g.name]: cur.filter((n) => n !== name) };
      if (g.max_select === 1) return { ...prev, [g.name]: [name] };
      if (g.max_select > 0 && cur.length >= g.max_select) return prev;
      return { ...prev, [g.name]: [...cur, name] };
    });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{item.name}</DialogTitle>
        </DialogHeader>
        {item.variants.length > 0 && (
          <div>
            <div className="mb-1.5 text-xs font-semibold uppercase text-muted-foreground">
              Variant <span className="text-destructive">*</span>
            </div>
            <div className="space-y-1.5">
              {item.variants.map((v) => (
                <button
                  key={v.name}
                  onClick={() => setVariant(v.name)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border p-2 text-sm",
                    variant === v.name ? "border-primary bg-primary/10" : "hover:bg-muted",
                  )}
                >
                  <span>{v.name}</span>
                  <span className="font-medium">{money(v.price)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {item.addon_groups.map((g) => {
          const err = groupError(g);
          return (
            <div key={g.name}>
              <div className="mb-1.5 flex items-center justify-between text-xs font-semibold uppercase text-muted-foreground">
                <span>
                  {g.name}
                  {g.min_select > 0 && <span className="text-destructive"> *</span>}
                </span>
                <span className="font-normal normal-case">
                  {g.max_select > 0
                    ? `Pick ${g.min_select}–${g.max_select}`
                    : `Min ${g.min_select}`}
                </span>
              </div>
              <div className="space-y-1.5">
                {g.options.map((o) => {
                  const on = (chosen[g.name] ?? []).includes(o.name);
                  return (
                    <button
                      key={o.name}
                      onClick={() => toggle(g, o.name)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg border p-2 text-sm",
                        on ? "border-primary bg-primary/10" : "hover:bg-muted",
                      )}
                    >
                      <span>{o.name}</span>
                      <span className="text-muted-foreground">
                        {o.price > 0 ? `+ ${money(o.price)}` : "Free"}
                      </span>
                    </button>
                  );
                })}
              </div>
              {err && chosen[g.name] && <div className="mt-1 text-xs text-destructive">{err}</div>}
            </div>
          );
        })}
        <Button
          className="rounded-xl"
          disabled={invalid}
          onClick={() => onConfirm(item, variant, addons)}
        >
          Add to bill · {money(unit)}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

const esc = (v: string) =>
  v.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

function itemLabel(it: PosBill["items"][number]) {
  return `${it.name}${it.variant_name ? ` (${it.variant_name})` : ""}`;
}

/** Prints the bill receipt (not the GST invoice) in a hidden frame. */
function printBillReceipt(bill: PosBill) {
  const row = (a: string, b: string, bold = false) =>
    `<div class="r${bold ? " b" : ""}"><span>${a}</span><span>${b}</span></div>`;
  const lines = bill.items
    .map(
      (it) =>
        row(`${it.quantity}× ${esc(itemLabel(it))}`, money(it.line_total)) +
        (it.addons.length
          ? `<div class="s">+ ${esc(it.addons.map((a) => a.name).join(", "))}</div>`
          : ""),
    )
    .join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(bill.invoice.invoice_number)}</title>
<style>body{font:12px monospace;width:72mm;margin:0 auto;padding:4mm}.r{display:flex;justify-content:space-between;gap:8px}.b{font-weight:bold}.c{text-align:center}.s{font-size:10px;color:#555}hr{border:0;border-top:1px dashed #000;margin:6px 0}</style></head><body>
<div class="c b" style="font-size:14px">${esc(bill.business.name)}</div><hr>
<div>Invoice: <b>${esc(bill.invoice.invoice_number)}</b></div>
<div>${esc(formatInvoiceDateTime(bill.created_at))}</div>
<div>${esc(fulfillmentLabel(bill.fulfillment_type))} · ${esc(paymentLabel(bill.payment_method))}</div><hr>
${lines}<hr>
${row("Subtotal", money(bill.subtotal))}
${bill.discount_amount > 0 ? row("Discount", `− ${money(bill.discount_amount)}`) : ""}
${row("TOTAL", money(bill.total), true)}
<div class="s">Included in total:</div>
${row("CGST", money(bill.tax_included.cgst_amount))}
${row("SGST", money(bill.tax_included.sgst_amount))}<hr>
<div class="c">Thank you!</div></body></html>`;
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) {
    frame.remove();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  window.setTimeout(() => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
  }, 200);
  window.setTimeout(() => frame.remove(), 120_000);
}

function ReceiptDialog({
  bill,
  onClose,
  closeLabel = "Close",
}: {
  bill: PosBill | null;
  onClose: () => void;
  closeLabel?: string;
}) {
  const [gst, setGst] = useState<InvoiceDetail | null>(null);
  const [gstLoading, setGstLoading] = useState(false);

  useEffect(() => {
    setGst(null);
  }, [bill?.public_id]);

  async function openGst() {
    if (!bill) return;
    setGstLoading(true);
    try {
      setGst(await withAuthRetry((t) => getInvoice(t, bill.invoice.public_id)));
    } catch (err) {
      toast.error(errMessage(err, "Unable to load the GST invoice."));
    } finally {
      setGstLoading(false);
    }
  }

  return (
    <>
      <Dialog open={!!bill && !gst} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Receipt</DialogTitle>
          </DialogHeader>
          {bill && (
            <>
              <div className="rounded-xl border-2 border-dashed p-4 font-mono text-xs">
                <div className="text-center text-base font-bold uppercase">
                  {bill.business.name}
                </div>
                <div className="my-2 border-t border-dashed" />
                <div>
                  Invoice: <b>{bill.invoice.invoice_number}</b>
                </div>
                <div>{formatInvoiceDateTime(bill.created_at)}</div>
                <div>
                  {fulfillmentLabel(bill.fulfillment_type)} · {paymentLabel(bill.payment_method)}
                  {bill.payment_status ? ` · ${bill.payment_status}` : ""}
                </div>
                <div className="my-2 border-t border-dashed" />
                {bill.items.map((it, i) => (
                  <div key={i} className="mb-1">
                    <div className="flex justify-between gap-2">
                      <span>
                        {it.quantity}× {itemLabel(it)}
                      </span>
                      <span>{money(it.line_total)}</span>
                    </div>
                    {it.addons.length > 0 && (
                      <div className="text-[10px] text-muted-foreground">
                        + {it.addons.map((a) => a.name).join(", ")}
                      </div>
                    )}
                  </div>
                ))}
                <div className="my-2 border-t border-dashed" />
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{money(bill.subtotal)}</span>
                </div>
                {bill.discount_amount > 0 && (
                  <div className="flex justify-between">
                    <span>Discount</span>
                    <span>− {money(bill.discount_amount)}</span>
                  </div>
                )}
                <div className="mt-1 flex justify-between font-bold">
                  <span>TOTAL</span>
                  <span>{money(bill.total)}</span>
                </div>
                <div className="mt-2 text-[10px] text-muted-foreground">
                  <div>Included in total:</div>
                  <div className="flex justify-between">
                    <span>CGST</span>
                    <span>{money(bill.tax_included.cgst_amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>SGST</span>
                    <span>{money(bill.tax_included.sgst_amount)}</span>
                  </div>
                </div>
                <div className="mt-2 text-center text-[10px] text-muted-foreground">Thank you!</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl"
                  onClick={() => printBillReceipt(bill)}
                >
                  <Printer className="mr-2 h-4 w-4" /> Print
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl"
                  onClick={() => void openGst()}
                  disabled={gstLoading}
                >
                  {gstLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="mr-2 h-4 w-4" />
                  )}
                  GST Invoice
                </Button>
                <Button className="w-full rounded-xl" onClick={onClose}>
                  {closeLabel}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!gst} onOpenChange={(v) => !v && setGst(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{gst?.invoice_number}</DialogTitle>
          </DialogHeader>
          {gst && (
            <>
              <InvoiceDocument invoice={gst} />
              <div className="flex gap-2">
                <Button variant="outline" className="rounded-xl" onClick={() => setGst(null)}>
                  Back to receipt
                </Button>
                <Button className="rounded-xl" onClick={() => printInvoicePdf(gst.public_id)}>
                  <Printer className="mr-2 h-4 w-4" /> Print GST invoice
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

const HISTORY_PAGE_SIZE = 20;
const PAY_FILTERS: { value: PosPaymentMethod | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "upi", label: "UPI" },
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
];

function BillHistory({ businessId }: { businessId: string }) {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [payFilter, setPayFilter] = useState<PosPaymentMethod | "all">("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PosBillListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewing, setViewing] = useState<PosBill | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [search]);

  const rangeError = from && to && from > to ? "Start date must be on or before end date." : "";

  useEffect(() => {
    if (rangeError) return;
    const ctrl = new AbortController();
    setLoading(true);
    setError("");
    withAuthRetry((t) =>
      listPosBills(
        t,
        {
          business_public_id: businessId,
          date_from: from || undefined,
          date_to: to || undefined,
          search: debounced || undefined,
          payment_method: payFilter === "all" ? undefined : payFilter,
          page,
          page_size: HISTORY_PAGE_SIZE,
        },
        ctrl.signal,
      ),
    )
      .then((d) => !ctrl.signal.aborted && setData(d))
      .catch((err) => {
        if (ctrl.signal.aborted || (err instanceof DOMException && err.name === "AbortError")) {
          return;
        }
        setError(errMessage(err, "Unable to load bills."));
      })
      .finally(() => !ctrl.signal.aborted && setLoading(false));
    return () => ctrl.abort();
  }, [businessId, debounced, from, to, payFilter, page, rangeError]);

  async function openBill(publicId: string, print = false) {
    setOpening(publicId);
    try {
      const bill = await withAuthRetry((t) => getPosBill(t, publicId));
      if (print) printBillReceipt(bill);
      else setViewing(bill);
    } catch (err) {
      toast.error(errMessage(err, "Unable to open the bill."));
    } finally {
      setOpening(null);
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.count / data.page_size)) : 1;

  return (
    <div className="card-elevated overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <Input
          placeholder="Search invoice number or bill ID…"
          className="min-w-48 flex-1 rounded-xl"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Input
          type="date"
          className="w-40 rounded-xl"
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
            setPage(1);
          }}
          aria-label="From date"
        />
        <Input
          type="date"
          className="w-40 rounded-xl"
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            setPage(1);
          }}
          aria-label="To date"
        />
        <div className="flex gap-1.5">
          {PAY_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => {
                setPayFilter(f.value);
                setPage(1);
              }}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${payFilter === f.value ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      {rangeError && <div className="px-4 py-2 text-xs text-destructive">{rangeError}</div>}
      {data && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 border-b bg-muted/20 px-4 py-2 text-xs text-muted-foreground">
          <span>
            Bills: <b className="text-foreground">{data.count}</b>
          </span>
          <span>
            Total: <b className="text-primary">{money(data.total_amount)}</b>
          </span>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Invoice</th>
              <th className="px-4 py-3 text-left font-medium">Date</th>
              <th className="px-4 py-3 text-right font-medium">Items</th>
              <th className="px-4 py-3 text-left font-medium">Payment</th>
              <th className="px-4 py-3 text-right font-medium">Total</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {error ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-destructive">
                  {error}
                </td>
              </tr>
            ) : loading && !data ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                </td>
              </tr>
            ) : data && data.results.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No bills found.
                </td>
              </tr>
            ) : (
              data?.results.map((b) => (
                <tr
                  key={b.public_id}
                  onClick={() => void openBill(b.public_id)}
                  className={cn(
                    "cursor-pointer border-b hover:bg-muted/40",
                    (loading || opening === b.public_id) && "opacity-60",
                  )}
                >
                  <td className="px-4 py-3 font-medium">{b.invoice_number}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {formatInvoiceDateTime(b.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">{b.item_count}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-md bg-muted px-2 py-0.5 text-xs">
                      {paymentLabel(b.payment_method)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{money(b.total)}</td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <RowActions
                      items={[
                        { label: "View receipt", onClick: () => void openBill(b.public_id) },
                        { label: "Print", onClick: () => void openBill(b.public_id, true) },
                      ]}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {data && data.count > data.page_size && (
        <div className="flex items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground">
          <span>
            Page {data.page} of {totalPages}
          </span>
          <div className="flex gap-1">
            <Button
              size="icon"
              variant="outline"
              className="h-7 w-7"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="h-7 w-7"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <ReceiptDialog bill={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}
