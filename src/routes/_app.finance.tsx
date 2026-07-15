import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { RowActions } from "@/components/app/row-actions";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { expenses as seedExpenses, vendorPayments as seedVendors, inr } from "@/lib/mock/data";
import { Wallet, TrendingDown, TrendingUp, IndianRupee, Plus, Trophy, Cake } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";

export const Route = createFileRoute("/_app/finance")({
  component: FinancePage,
  head: () => ({ meta: [{ title: "Finance — Daawat Baker's" }] }),
});

const seedPurchases = [
  { id: "PR-901", vendor: "Modern Bakers", items: "Flour, Butter", amount: 22400, date: "06 Jul", status: "Reconciled" },
  { id: "PR-900", vendor: "Azadpur Mandi", items: "Vegetables", amount: 8400, date: "07 Jul", status: "Pending" },
  { id: "PR-899", vendor: "Amul Dairy", items: "Milk, Cream", amount: 12600, date: "05 Jul", status: "Reconciled" },
  { id: "PR-898", vendor: "Indane", items: "LPG Refill", amount: 1650, date: "07 Jul", status: "Paid" },
  { id: "PR-897", vendor: "Reliance Fresh", items: "Grocery", amount: 9800, date: "04 Jul", status: "Reconciled" },
];

function FinancePage() {
  const [addExpense, setAddExpense] = useState(false);
  const [expenses, setExpenses] = useState(seedExpenses);
  const [vendors, setVendors] = useState(seedVendors);
  const [purchases] = useState(seedPurchases);
  const [expHead, setExpHead] = useState("");
  const [expVendor, setExpVendor] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expMode, setExpMode] = useState("Cash");

  const monthly = [
    { m: "Jan", revenue: 920000, expenses: 610000, profit: 310000 },
    { m: "Feb", revenue: 880000, expenses: 580000, profit: 300000 },
    { m: "Mar", revenue: 1040000, expenses: 640000, profit: 400000 },
    { m: "Apr", revenue: 980000, expenses: 620000, profit: 360000 },
    { m: "May", revenue: 1120000, expenses: 690000, profit: 430000 },
    { m: "Jun", revenue: 1080000, expenses: 670000, profit: 410000 },
    { m: "Jul", revenue: 960000, expenses: 590000, profit: 370000 },
  ];

  const saveExpense = () => {
    const amount = Number(expAmount) || 0;
    if (!expHead.trim()) {
      toast.error("Enter expense head");
      return;
    }
    setExpenses((prev) => [
      { date: "08 Jul", head: expHead, vendor: expVendor || "—", amount, mode: expMode },
      ...prev,
    ]);
    toast.success("Expense added");
    setAddExpense(false);
    setExpHead("");
    setExpVendor("");
    setExpAmount("");
    setExpMode("Cash");
  };

  const payVendor = (vendor: string) => {
    setVendors((prev) =>
      prev.map((v) => (v.vendor === vendor ? { ...v, due: 0, dueOn: "—", status: "Paid" } : v)),
    );
    toast.success(`Paid ${vendor}`);
  };

  return (
    <div>
      <PageHeader
        title="Finance"
        crumbs={["Admin", "Finance"]}
        description="Track expenses, cash closing, P&L, and vendor payments."
        action={
          <Button className="rounded-xl gap-2" onClick={() => setAddExpense(true)}>
            <Plus className="h-4 w-4" /> Add Expense
          </Button>
        }
      />

      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <MiniCard icon={Wallet} label="Today's Cash" value={inr(28400)} tone="brand" />
          <MiniCard icon={TrendingDown} label="Expenses (Jul)" value={inr(184200)} tone="warning" />
          <MiniCard icon={TrendingUp} label="Net Profit" value={inr(342000)} tone="success" />
          <MiniCard icon={IndianRupee} label="Pending Vendor" value={inr(84900)} tone="info" />
        </div>

        <Tabs defaultValue="expenses">
          <TabsList className="rounded-xl flex-wrap h-auto">
            <TabsTrigger value="expenses">Expenses</TabsTrigger>
            <TabsTrigger value="cash">Daily Cash Closing</TabsTrigger>
            <TabsTrigger value="pl">P&L</TabsTrigger>
            <TabsTrigger value="vendors">Vendor Payments</TabsTrigger>
            <TabsTrigger value="purchases">Purchase Records</TabsTrigger>
          </TabsList>

          <TabsContent value="expenses" className="mt-4">
            <div className="card-elevated overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Date</th>
                    <th className="px-4 py-3 text-left font-medium">Head</th>
                    <th className="px-4 py-3 text-left font-medium">Vendor</th>
                    <th className="px-4 py-3 text-right font-medium">Amount</th>
                    <th className="px-4 py-3 text-left font-medium">Mode</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((e, i) => (
                    <tr key={`${e.head}-${i}`} className="border-b hover:bg-muted/40">
                      <td className="px-4 py-3 text-muted-foreground">{e.date}</td>
                      <td className="px-4 py-3 font-medium">{e.head}</td>
                      <td className="px-4 py-3 text-muted-foreground">{e.vendor}</td>
                      <td className="px-4 py-3 text-right font-semibold">{inr(e.amount)}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-md bg-muted px-2 py-0.5 text-xs">{e.mode}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <RowActions
                          items={[
                            { label: "View", onClick: () => toast.message(e.head) },
                            { label: "Edit", onClick: () => toast.message(`Edit · ${e.head}`) },
                            {
                              label: "Delete",
                              onClick: () => {
                                setExpenses((prev) => prev.filter((_, idx) => idx !== i));
                                toast.success("Expense removed");
                              },
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
          </TabsContent>

          <TabsContent value="cash" className="mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="card-elevated p-4">
                <div className="text-sm font-semibold">Cash Closing — 7 Jul 2026</div>
                <div className="mt-3 space-y-3">
                  <div>
                    <Label>Opening Balance</Label>
                    <Input defaultValue="5000" className="mt-1 rounded-xl" />
                  </div>
                  <div>
                    <Label>Expected (from POS)</Label>
                    <Input defaultValue="34200" disabled className="mt-1 rounded-xl bg-muted/30" />
                  </div>
                  <div>
                    <Label>Actual Cash Counted</Label>
                    <Input defaultValue="33800" className="mt-1 rounded-xl" />
                  </div>
                  <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
                    <b>Discrepancy: -₹400</b> · shortage flagged for review
                  </div>
                  <Button
                    className="w-full rounded-xl"
                    onClick={() => toast.success("Register closed for 7 Jul 2026")}
                  >
                    Close Register
                  </Button>
                </div>
              </div>
              <div className="card-elevated p-4">
                <div className="text-sm font-semibold">Past 7 Days</div>
                <table className="mt-3 w-full text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr>
                      <th className="text-left font-medium py-2">Date</th>
                      <th className="text-right font-medium">Expected</th>
                      <th className="text-right font-medium">Actual</th>
                      <th className="text-right font-medium">Diff</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { d: "06 Jul", exp: 41200, act: 41050 },
                      { d: "05 Jul", exp: 36800, act: 37200 },
                      { d: "04 Jul", exp: 39100, act: 38840 },
                      { d: "03 Jul", exp: 35500, act: 35500 },
                      { d: "02 Jul", exp: 42800, act: 42100 },
                      { d: "01 Jul", exp: 34000, act: 34220 },
                    ].map((row) => {
                      const diff = row.act - row.exp;
                      return (
                        <tr key={row.d} className="border-b">
                          <td className="py-2">{row.d}</td>
                          <td className="text-right">{inr(row.exp)}</td>
                          <td className="text-right">{inr(row.act)}</td>
                          <td
                            className={`text-right font-semibold ${diff >= 0 ? "text-success" : "text-destructive"}`}
                          >
                            {diff >= 0 ? "+" : ""}
                            {inr(diff)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="pl" className="mt-4 space-y-4">
            <div className="card-elevated p-4">
              <div className="text-sm font-semibold">Revenue vs Expenses vs Profit</div>
              <div className="mt-2 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="m" fontSize={12} stroke="var(--color-muted-foreground)" />
                    <YAxis
                      fontSize={12}
                      stroke="var(--color-muted-foreground)"
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      contentStyle={{ background: "var(--color-card)", borderRadius: 12 }}
                      formatter={(v: number) => inr(v)}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="revenue" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="expenses" fill="var(--color-gold)" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="profit" fill="var(--color-success)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="card-elevated flex items-center gap-4 p-4">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-gold/20 text-gold-foreground">
                  <Trophy className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Best Selling Product</div>
                  <div className="text-lg font-bold">Chocolate Truffle Cake</div>
                  <div className="text-xs text-muted-foreground">1,240 units this month</div>
                </div>
              </div>
              <div className="card-elevated flex items-center gap-4 p-4">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Cake className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Highest Sales Month</div>
                  <div className="text-lg font-bold">December 2025</div>
                  <div className="text-xs text-muted-foreground">{inr(1420000)} in revenue</div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="vendors" className="mt-4">
            <div className="card-elevated overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Vendor</th>
                    <th className="px-4 py-3 text-right font-medium">Due</th>
                    <th className="px-4 py-3 text-left font-medium">Due On</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.map((v) => (
                    <tr key={v.vendor} className="border-b hover:bg-muted/40">
                      <td className="px-4 py-3 font-medium">{v.vendor}</td>
                      <td className="px-4 py-3 text-right font-semibold">{v.due ? inr(v.due) : "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{v.dueOn}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={v.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          {v.status !== "Paid" && (
                            <Button
                              size="sm"
                              className="h-7 rounded-lg text-xs"
                              onClick={() => payVendor(v.vendor)}
                            >
                              Pay Now
                            </Button>
                          )}
                          <RowActions
                            items={[
                              { label: "View ledger", onClick: () => toast.message(v.vendor) },
                              {
                                label: "Pay Now",
                                onClick: () => payVendor(v.vendor),
                                disabled: v.status === "Paid",
                              },
                              { label: "Send reminder", onClick: () => toast.success(`Reminder sent to ${v.vendor}`) },
                            ]}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="purchases" className="mt-4">
            <div className="card-elevated overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Ref</th>
                    <th className="px-4 py-3 text-left font-medium">Vendor</th>
                    <th className="px-4 py-3 text-left font-medium">Items</th>
                    <th className="px-4 py-3 text-right font-medium">Amount</th>
                    <th className="px-4 py-3 text-left font-medium">Date</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((p) => (
                    <tr key={p.id} className="border-b hover:bg-muted/40">
                      <td className="px-4 py-3 font-medium">{p.id}</td>
                      <td className="px-4 py-3">{p.vendor}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.items}</td>
                      <td className="px-4 py-3 text-right font-semibold">{inr(p.amount)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.date}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <RowActions
                          items={[
                            { label: "View", onClick: () => toast.message(p.id) },
                            { label: "Reconcile", onClick: () => toast.success(`${p.id} reconciled`) },
                            { label: "Download invoice", onClick: () => toast.success("Invoice downloaded") },
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={addExpense} onOpenChange={setAddExpense}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Expense</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Expense Head</Label>
              <Input
                placeholder="e.g. Vegetables"
                className="mt-1 rounded-xl"
                value={expHead}
                onChange={(e) => setExpHead(e.target.value)}
              />
            </div>
            <div>
              <Label>Vendor</Label>
              <Input
                placeholder="Vendor name"
                className="mt-1 rounded-xl"
                value={expVendor}
                onChange={(e) => setExpVendor(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Amount (₹)</Label>
                <Input
                  type="number"
                  className="mt-1 rounded-xl"
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                />
              </div>
              <div>
                <Label>Mode</Label>
                <Input
                  className="mt-1 rounded-xl"
                  value={expMode}
                  onChange={(e) => setExpMode(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAddExpense(false)}>
                Cancel
              </Button>
              <Button onClick={saveExpense}>Save Expense</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MiniCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  tone: "brand" | "warning" | "success" | "info";
}) {
  const map = {
    brand: "bg-primary/10 text-primary",
    warning: "bg-warning/10 text-warning",
    success: "bg-success/10 text-success",
    info: "bg-info/10 text-info",
  };
  return (
    <div className="card-elevated flex items-center gap-3 p-4">
      <div className={`grid h-11 w-11 place-items-center rounded-xl ${map[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-xl font-bold">{value}</div>
      </div>
    </div>
  );
}
