import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { RowActions } from "@/components/app/row-actions";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { customers as seedCustomers, inr } from "@/lib/mock/data";
import { cn } from "@/lib/utils";
import {
  Plus,
  Cake,
  Sparkles,
  Search,
  Users,
  Star,
  Wallet,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/customers")({
  component: CustomersPage,
  head: () => ({ meta: [{ title: "Customers — Daawat Baker's" }] }),
});

type Customer = (typeof seedCustomers)[number];

const tierOptions = ["Silver", "Gold", "Platinum"] as const;
type Tier = (typeof tierOptions)[number];

type SortValue = "ltv_desc" | "orders_desc" | "name_asc";
const SORT_OPTIONS: { value: SortValue; label: string }[] = [
  { value: "ltv_desc", label: "LTV (High → Low)" },
  { value: "orders_desc", label: "Orders (High → Low)" },
  { value: "name_asc", label: "Name (A → Z)" },
];

function CustomersPage() {
  const [list, setList] = useState(() => [...seedCustomers]);
  const [sel, setSel] = useState<Customer | null>(null);
  const [q, setQ] = useState("");
  const [tier, setTier] = useState<"all" | Tier>("all");
  const [sort, setSort] = useState<SortValue>("ltv_desc");
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "" });

  useEffect(() => {
    setPage(1);
  }, [q, tier, sort]);

  const counts = useMemo(() => {
    const byTier: Record<Tier, number> = { Silver: 0, Gold: 0, Platinum: 0 };
    let totalOrders = 0;
    let totalLtv = 0;
    for (const c of list) {
      byTier[c.tier] += 1;
      totalOrders += c.orders;
      totalLtv += c.ltv;
    }
    return { byTier, totalOrders, totalLtv };
  }, [list]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();

    const base = list.filter((c) => (tier === "all" ? true : c.tier === tier));
    const searched = !query
      ? base
      : base.filter(
          (c) =>
            c.name.toLowerCase().includes(query) ||
            c.phone.includes(query) ||
            c.email.toLowerCase().includes(query) ||
            c.id.toLowerCase().includes(query),
        );

    return [...searched].sort((a, b) => {
      switch (sort) {
        case "name_asc":
          return a.name.localeCompare(b.name);
        case "orders_desc":
          return b.orders - a.orders || b.ltv - a.ltv;
        case "ltv_desc":
        default:
          return b.ltv - a.ltv || b.orders - a.orders;
      }
    });
  }, [list, q, tier, sort]);

  const PAGE_SIZE = 10;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage],
  );

  function addCustomer() {
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error("Name and phone are required");
      return;
    }
    const next: Customer = {
      id: `CU-${1200 + list.length}`,
      name: form.name.trim(),
      phone: form.phone.trim(),
      email:
        form.email.trim() || `${form.name.trim().toLowerCase().replace(/\s+/g, ".")}@email.com`,
      orders: 0,
      ltv: 0,
      points: 0,
      tier: "Silver",
      lastOrder: "—",
      birthday: "—",
    };
    setList((prev) => [next, ...prev]);
    setAddOpen(false);
    setForm({ name: "", phone: "", email: "" });
    toast.success(`${next.name} added`);
  }

  function removeCustomer(c: Customer) {
    setList((prev) => prev.filter((x) => x.id !== c.id));
    if (sel?.id === c.id) setSel(null);
    toast.success(`${c.name} removed`);
  }

  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <PageHeader
        title="Customers"
        crumbs={["Growth", "Customers"]}
        description="CRM with loyalty tiers, LTV, and occasion tracking."
        action={
          <Button className="rounded-xl gap-2" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add Customer
          </Button>
        }
      />

      <div className="space-y-5 p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Kpi
            label="Customers"
            value={String(list.length)}
            hint={`${counts.byTier.Silver} Silver`}
            icon={Users}
          />
          <Kpi
            label="Silver"
            value={String(counts.byTier.Silver)}
            hint="Entry tier"
            tone="border-primary/40 bg-primary/5 text-primary"
            icon={Star}
          />
          <Kpi
            label="Gold"
            value={String(counts.byTier.Gold)}
            hint="Loyal tier"
            tone="border-gold/30 bg-gold/10 text-gold"
            icon={Star}
          />
          <Kpi
            label="Platinum"
            value={String(counts.byTier.Platinum)}
            hint="Top tier"
            tone="border-warning/30 bg-warning/10 text-warning"
            icon={Star}
          />
          <Kpi
            label="Total LTV"
            value={inr(counts.totalLtv)}
            hint={`${counts.totalOrders.toLocaleString("en-IN")} orders`}
            icon={Wallet}
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
                  <Select value={sort} onValueChange={(v) => setSort(v as SortValue)}>
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
                  count={list.length}
                  onClick={() => setTier("all")}
                />
                {tierOptions.map((t) => (
                  <TierChip
                    key={t}
                    active={tier === t}
                    label={t}
                    count={counts.byTier[t]}
                    onClick={() => setTier(t)}
                  />
                ))}
              </div>
            </div>
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
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-16 text-center text-sm text-muted-foreground"
                      >
                        No customers found.
                        <div className="mt-1 text-xs">
                          Try clearing filters or searching by name/phone/email.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paged.map((c) => (
                      <tr
                        key={c.id}
                        onClick={() => setSel(c)}
                        className={cn(
                          "cursor-pointer border-b hover:bg-muted/40",
                          sel?.id === c.id && "bg-primary/5 hover:bg-primary/5",
                        )}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-primary/10 text-xs text-primary">
                                {c.name
                                  .split(" ")
                                  .map((s) => s[0])
                                  .join("")}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">{c.name}</div>
                              <div className="text-xs text-muted-foreground">{c.id}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{c.phone}</td>
                        <td className="px-4 py-3 text-right font-medium">{c.orders}</td>
                        <td className="px-4 py-3 text-right font-semibold">{inr(c.ltv)}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={c.tier} />
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{c.lastOrder}</td>
                        <td className="px-4 py-3 text-right">
                          <RowActions
                            items={[
                              { label: "View profile", onClick: () => setSel(c) },
                              {
                                label: "Message",
                                onClick: () => toast.success(`Message queued for ${c.name}`),
                              },
                              {
                                label: "Edit",
                                onClick: () => toast.message("Edit customer coming soon"),
                              },
                              { separator: true, label: "", onClick: () => {} },
                              {
                                label: "Delete",
                                onClick: () => removeCustomer(c),
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

            {filtered.length > 0 && (
              <div className="flex flex-col gap-2 border-t bg-muted/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-muted-foreground">
                  Showing <b className="text-foreground">{(safePage - 1) * PAGE_SIZE + 1}</b>–
                  <b className="text-foreground">
                    {Math.min(safePage * PAGE_SIZE, filtered.length)}
                  </b>{" "}
                  of <b className="text-foreground">{filtered.length}</b>
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
                <SheetTitle>{sel.name}</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-14 w-14">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {sel.name
                        .split(" ")
                        .map((s) => s[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="text-sm text-muted-foreground">{sel.phone}</div>
                    <div className="text-xs text-muted-foreground">{sel.email}</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Stat label="Orders" value={String(sel.orders)} />
                  <Stat label="LTV" value={inr(sel.ltv)} />
                  <Stat label="Points" value={String(sel.points)} />
                </div>
                <div className="rounded-xl border p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold uppercase text-muted-foreground">
                      Progress to next tier
                    </span>
                    <StatusBadge status={sel.tier} />
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: "68%" }} />
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    ₹{Math.max(0, 30000 - sel.ltv).toLocaleString()} more to Platinum
                  </div>
                </div>
                <div className="rounded-xl border p-3 text-sm">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                    <Cake className="h-3.5 w-3.5" /> Occasions
                  </div>
                  <div className="mt-1">
                    Birthday · <b>{sel.birthday}</b>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    className="flex-1 rounded-xl"
                    onClick={() => toast.success(`Message queued for ${sel.name}`)}
                  >
                    Message
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 rounded-xl"
                    onClick={() => toast.message("Edit customer")}
                  >
                    Edit
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Full name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Customer name"
                className="mt-1 rounded-xl"
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+91 …"
                className="mt-1 rounded-xl"
              />
            </div>
            <div>
              <Label>Email (optional)</Label>
              <Input
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="email@example.com"
                className="mt-1 rounded-xl"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" className="rounded-xl" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button className="rounded-xl" onClick={addCustomer}>
                Save Customer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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
  icon: any;
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
