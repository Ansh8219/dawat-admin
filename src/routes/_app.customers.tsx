import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { RowActions } from "@/components/app/row-actions";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { customers as seedCustomers, inr } from "@/lib/mock/data";
import { Plus, Cake, Sparkles, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/customers")({
  component: CustomersPage,
  head: () => ({ meta: [{ title: "Customers — Daawat Baker's" }] }),
});

type Customer = (typeof seedCustomers)[number];

function CustomersPage() {
  const [list, setList] = useState(() => [...seedCustomers]);
  const [sel, setSel] = useState<Customer | null>(null);
  const [q, setQ] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "" });

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return list;
    return list.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.phone.includes(query) ||
        c.email.toLowerCase().includes(query) ||
        c.id.toLowerCase().includes(query),
    );
  }, [list, q]);

  function addCustomer() {
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error("Name and phone are required");
      return;
    }
    const next: Customer = {
      id: `CU-${1200 + list.length}`,
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || `${form.name.trim().toLowerCase().replace(/\s+/g, ".")}@email.com`,
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
    <div>
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

      <div className="grid gap-4 p-4 lg:grid-cols-[1fr_320px] sm:p-6 lg:p-8">
        <div className="card-elevated overflow-hidden">
          <div className="border-b p-3">
            <div className="relative max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search customers…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="rounded-xl pl-9"
              />
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
                {filtered.map((c) => (
                  <tr key={c.id} onClick={() => setSel(c)} className="cursor-pointer border-b hover:bg-muted/40">
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
                          { label: "Message", onClick: () => toast.success(`Message queued for ${c.name}`) },
                          { label: "Edit", onClick: () => toast.message("Edit customer coming soon") },
                          { separator: true, label: "", onClick: () => {} },
                          { label: "Delete", onClick: () => removeCustomer(c), destructive: true },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
            <Button className="w-full rounded-xl" onClick={() => toast.success("Loyalty settings saved")}>
              Save Settings
            </Button>
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
                    <span className="font-semibold uppercase text-muted-foreground">Progress to next tier</span>
                    <StatusBadge status={sel.tier} />
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: "68%" }} />
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">₹{Math.max(0, 30000 - sel.ltv).toLocaleString()} more to Platinum</div>
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
                  <Button className="flex-1 rounded-xl" onClick={() => toast.success(`Message queued for ${sel.name}`)}>
                    Message
                  </Button>
                  <Button variant="outline" className="flex-1 rounded-xl" onClick={() => toast.message("Edit customer")}>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-2 text-center">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-bold">{value}</div>
    </div>
  );
}
