import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { RowActions } from "@/components/app/row-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { menuItems, categories, inr } from "@/lib/mock/data";
import { Search, Plus, Minus, Trash2, Receipt, Smartphone, Wallet, CreditCard, Landmark, Truck, History, Info } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/app/status-badge";

export const Route = createFileRoute("/_app/pos")({
  component: POSPage,
  head: () => ({ meta: [{ title: "POS & Billing — Daawat Baker's" }] }),
});

type CartItem = { code: number; name: string; price: number; qty: number; discount: number };

const pastBills = [
  { id: "BILL-3421", customer: "Aarav Sharma", amount: 1240, pay: "UPI",  date: "07 Jul 2026 · 1:22 PM" },
  { id: "BILL-3420", customer: "Walk-in",      amount: 480,  pay: "Cash", date: "07 Jul 2026 · 12:58 PM" },
  { id: "BILL-3419", customer: "Priya Kapoor", amount: 2180, pay: "Card", date: "07 Jul 2026 · 12:41 PM" },
  { id: "BILL-3418", customer: "Rohan Mehta",  amount: 890,  pay: "UPI",  date: "07 Jul 2026 · 12:12 PM" },
  { id: "BILL-3417", customer: "Walk-in",      amount: 320,  pay: "Cash", date: "07 Jul 2026 · 11:55 AM" },
];

function POSPage() {
  return (
    <div>
      <PageHeader title="POS / Billing" crumbs={["Operations", "POS"]} description="Punch orders fast with item codes and print a bill." />
      <div className="p-4 sm:p-6 lg:p-8">
        <Tabs defaultValue="new">
          <TabsList className="rounded-xl">
            <TabsTrigger value="new">New Bill</TabsTrigger>
            <TabsTrigger value="history"><History className="mr-1.5 h-3.5 w-3.5" /> Bill History</TabsTrigger>
          </TabsList>
          <TabsContent value="new" className="mt-4"><POSCounter /></TabsContent>
          <TabsContent value="history" className="mt-4"><BillHistory /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function POSCounter() {
  const [cat, setCat] = useState<string>("All");
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [code, setCode] = useState("");
  const [dineIn, setDineIn] = useState(true);
  const [tip, setTip] = useState(0);
  const [discountPct, setDiscountPct] = useState(0);
  const [pay, setPay] = useState<string>("UPI");
  const [receipt, setReceipt] = useState<{ id: string } | null>(null);

  const filtered = useMemo(
    () => menuItems.filter(m => (cat === "All" || m.cat === cat) && m.name.toLowerCase().includes(q.toLowerCase())),
    [cat, q],
  );

  function addToCart(code: number) {
    const m = menuItems.find(x => x.code === code);
    if (!m) return;
    setCart(prev => {
      const existing = prev.find(p => p.code === code);
      if (existing) return prev.map(p => p.code === code ? { ...p, qty: p.qty + 1 } : p);
      return [...prev, { code: m.code, name: m.name, price: m.price, qty: 1, discount: 0 }];
    });
  }

  function submitCode() {
    const codes = code.split("+").map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
    if (codes.length === 0) return;
    codes.forEach(addToCart);
    setCode("");
  }

  const subtotal = cart.reduce((s, c) => s + c.qty * c.price * (1 - c.discount/100), 0);
  const dineSurcharge = dineIn ? subtotal * 0.25 : 0;
  const discount = subtotal * discountPct / 100;
  const taxable = subtotal + dineSurcharge - discount;
  const cgst = taxable * 0.025;
  const sgst = taxable * 0.025;
  const total = Math.round(taxable + cgst + sgst + tip);

  function generateBill() {
    if (cart.length === 0) { toast.error("Cart is empty"); return; }
    const id = "BILL-" + (3422 + Math.floor(Math.random() * 100));
    setReceipt({ id });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
      {/* Products */}
      <div className="card-elevated flex flex-col overflow-hidden">
        <div className="border-b p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search item…" className="rounded-xl pl-9" />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {["All", ...categories].map(c => (
              <button key={c} onClick={() => setCat(c)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${cat === c ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
                {c}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 overflow-y-auto p-3 sm:grid-cols-3 xl:grid-cols-4">
          {filtered.map(m => (
            <button key={m.code} onClick={() => addToCart(m.code)}
              className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card p-3 text-left transition-all hover:border-primary/50 hover:shadow-md">
              <div className="mb-2 grid h-20 place-items-center rounded-lg bg-gradient-to-br from-primary/10 to-gold/20 text-2xl">
                {m.veg ? "🥗" : "🍗"}
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>#{m.code}</span>
                <span>{m.cat}</span>
              </div>
              <div className="mt-0.5 line-clamp-2 text-sm font-medium">{m.name}</div>
              <div className="mt-1 text-sm font-bold text-primary">{inr(m.price)}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Cart */}
      <div className="card-elevated flex flex-col overflow-hidden">
        <div className="border-b p-3">
          <div className="mb-2 text-sm font-semibold">Current Bill</div>
          <div className="flex gap-2">
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Enter code: 22+67"
              onKeyDown={(e) => e.key === "Enter" && submitCode()} className="rounded-xl font-mono" />
            <Button className="rounded-xl" onClick={submitCode}>Add</Button>
          </div>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto p-3">
          {cart.length === 0 && (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">
              <div className="text-center">
                <Receipt className="mx-auto mb-2 h-8 w-8 opacity-30" />
                No items yet. Tap products or punch codes.
              </div>
            </div>
          )}
          {cart.map((c) => (
            <div key={c.code} className="rounded-xl border p-2.5">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1 pr-2">
                  <div className="truncate text-sm font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{inr(c.price)} × {c.qty}</div>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setCart(p => p.map(x => x.code === c.code ? { ...x, qty: Math.max(1, x.qty-1) } : x))}><Minus className="h-3 w-3"/></Button>
                  <span className="w-6 text-center text-sm">{c.qty}</span>
                  <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setCart(p => p.map(x => x.code === c.code ? { ...x, qty: x.qty+1 } : x))}><Plus className="h-3 w-3"/></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setCart(p => p.filter(x => x.code !== c.code))}><Trash2 className="h-3 w-3"/></Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t bg-muted/20 p-3 text-sm">
          <div className="mb-2 flex items-center justify-between rounded-lg border p-2">
            <span className="text-xs">Dine-In (+25% surcharge)</span>
            <Switch checked={dineIn} onCheckedChange={setDineIn} />
          </div>
          <div className="flex items-center justify-between py-1"><span>Subtotal</span><span>{inr(subtotal)}</span></div>
          {dineIn && <div className="flex items-center justify-between py-1 text-primary"><span>Dine-In Surcharge</span><span>{inr(dineSurcharge)}</span></div>}
          <div className="flex items-center justify-between py-1">
            <span>Discount %</span>
            <Input type="number" value={discountPct} onChange={(e) => setDiscountPct(Number(e.target.value))} className="h-7 w-16 text-right text-xs" />
          </div>
          <div className="flex items-center justify-between py-1 text-muted-foreground text-xs"><span>CGST (2.5%)</span><span>{inr(cgst)}</span></div>
          <div className="flex items-center justify-between py-1 text-muted-foreground text-xs"><span>SGST (2.5%)</span><span>{inr(sgst)}</span></div>
          <div className="flex items-center justify-between py-1">
            <span>Tip</span>
            <Input type="number" value={tip} onChange={(e) => setTip(Number(e.target.value))} className="h-7 w-20 text-right text-xs" />
          </div>
          <div className="mt-2 flex items-center justify-between border-t pt-2 text-base font-bold"><span>Total</span><span className="text-primary">{inr(total)}</span></div>

          <div className="mt-3 grid grid-cols-5 gap-1.5">
            {[
              { m: "UPI", icon: Smartphone },
              { m: "Cash", icon: Wallet },
              { m: "Card", icon: CreditCard },
              { m: "NetBanking", icon: Landmark },
              { m: "COD", icon: Truck },
            ].map(({ m, icon: Icon }) => (
              <button key={m} onClick={() => setPay(m)}
                className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-[10px] transition-colors ${pay === m ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>
                <Icon className="h-4 w-4" />{m}
              </button>
            ))}
          </div>
          <Button className="mt-3 w-full rounded-xl" onClick={generateBill}><Receipt className="mr-2 h-4 w-4" /> Generate Bill</Button>
        </div>
      </div>

      <Dialog open={!!receipt} onOpenChange={(v) => !v && setReceipt(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Receipt Preview</DialogTitle></DialogHeader>
          <div className="rounded-xl border-2 border-dashed p-4 font-mono text-xs">
            <div className="text-center">
              <div className="text-base font-bold">DAAWAT BAKER'S</div>
              <div className="text-[10px] text-muted-foreground">A Designer Bakery Studio</div>
              <div className="text-[10px] text-muted-foreground">GSTIN: 07AABCU9603R1Z2</div>
            </div>
            <div className="my-2 border-t border-dashed" />
            <div>Bill No: <b>{receipt?.id}</b></div>
            <div>{new Date().toLocaleString("en-IN")}</div>
            <div className="my-2 border-t border-dashed" />
            {cart.map(c => (
              <div key={c.code} className="flex justify-between"><span>{c.qty}× {c.name}</span><span>{inr(c.qty * c.price)}</span></div>
            ))}
            <div className="my-2 border-t border-dashed" />
            <div className="flex justify-between"><span>CGST + SGST</span><span>{inr(cgst+sgst)}</span></div>
            {dineIn && <div className="flex justify-between"><span>Dine-In (25%)</span><span>{inr(dineSurcharge)}</span></div>}
            <div className="mt-1 flex justify-between font-bold"><span>TOTAL</span><span>{inr(total)}</span></div>
            <div className="mt-2 text-center text-[10px] text-muted-foreground">Paid via {pay} · Thank you!</div>
          </div>
          <Button className="rounded-xl" onClick={() => { setReceipt(null); setCart([]); toast.success("Bill saved"); }}>Print & New Bill</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BillHistory() {
  const [selected, setSelected] = useState<(typeof pastBills)[number] | null>(null);
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return pastBills;
    return pastBills.filter(
      (b) =>
        b.id.toLowerCase().includes(q) ||
        b.customer.toLowerCase().includes(q) ||
        b.date.toLowerCase().includes(q),
    );
  }, [search]);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
      <div className="card-elevated overflow-hidden">
        <div className="border-b p-3">
          <Input
            placeholder="Search bill number or date…"
            className="rounded-xl"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Bill</th>
              <th className="px-4 py-3 text-left font-medium">Customer</th>
              <th className="px-4 py-3 text-right font-medium">Amount</th>
              <th className="px-4 py-3 text-left font-medium">Payment</th>
              <th className="px-4 py-3 text-left font-medium">Date</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((b) => (
              <tr
                key={b.id}
                onClick={() => setSelected(b)}
                className="cursor-pointer border-b hover:bg-muted/40"
              >
                <td className="px-4 py-3 font-medium">{b.id}</td>
                <td className="px-4 py-3">{b.customer}</td>
                <td className="px-4 py-3 text-right font-semibold">{inr(b.amount)}</td>
                <td className="px-4 py-3">
                  <span className="rounded-md bg-muted px-2 py-0.5 text-xs">{b.pay}</span>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{b.date}</td>
                <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                  <RowActions
                    items={[
                      {
                        label: "View",
                        onClick: () => setSelected(b),
                      },
                      {
                        label: "Reprint",
                        onClick: () => toast.success(`Reprinting ${b.id}`),
                      },
                      {
                        label: "Edit items",
                        onClick: () => {
                          setSelected(b);
                          toast.message(`Edit items · ${b.id}`);
                        },
                      },
                    ]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card-elevated p-4">
        {selected ? (
          <div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">{selected.id}</div>
                <div className="text-xs text-muted-foreground">{selected.date}</div>
              </div>
              <StatusBadge status="Completed" />
            </div>

            {selected.pay === "Cash" ? (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <b>Cash payment — edits are not logged.</b> Discretion advised.
                </div>
              </div>
            ) : (
              <div className="mt-4">
                <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                  Edit History
                </div>
                <ol className="space-y-2 border-l pl-4">
                  <li className="relative">
                    <span className="absolute -left-[19px] top-1 h-2.5 w-2.5 rounded-full bg-primary" />
                    <div className="text-xs">
                      Bill generated by <b>Ritika Sharma</b>
                    </div>
                    <div className="text-[10px] text-muted-foreground">{selected.date}</div>
                  </li>
                  <li className="relative">
                    <span className="absolute -left-[19px] top-1 h-2.5 w-2.5 rounded-full bg-muted" />
                    <div className="text-xs">
                      Discount 5% added by <b>Rajeev M.</b>
                    </div>
                    <div className="text-[10px] text-muted-foreground">2 hours later</div>
                  </li>
                </ol>
              </div>
            )}

            <div className="mt-4 rounded-xl border p-3 text-sm">
              <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                Items (editable)
              </div>
              {[
                { name: "Daal Makhni", qty: 1, price: 320 },
                { name: "Butter Chapati", qty: 4, price: 45 },
              ].map((it, i) => (
                <div key={i} className="flex items-center justify-between py-1">
                  <span>
                    {it.qty}× {it.name}
                  </span>
                  <span className="font-medium">{inr(it.qty * it.price)}</span>
                </div>
              ))}
              <div className="mt-2 border-t pt-2 flex justify-between font-bold">
                <span>Total</span>
                <span className="text-primary">{inr(selected.amount)}</span>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <Button
                variant="outline"
                className="flex-1 rounded-xl"
                onClick={() => toast.message(`Edit items · ${selected.id}`)}
              >
                Edit Items
              </Button>
              <Button
                className="flex-1 rounded-xl"
                onClick={() => toast.success(`Reprinting ${selected.id}`)}
              >
                Reprint
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid h-full place-items-center text-sm text-muted-foreground">
            Select a bill to view details
          </div>
        )}
      </div>
    </div>
  );
}
