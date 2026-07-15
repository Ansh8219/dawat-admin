import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/page-header";
import { RowActions } from "@/components/app/row-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { menuItems, inr, salesMonthly } from "@/lib/mock/data";
import { Download, FileText, Filter } from "lucide-react";
import { toast } from "sonner";
import { AreaChart, Area, BarChart, Bar, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

export const Route = createFileRoute("/_app/reports")({
  component: ReportsPage,
  head: () => ({ meta: [{ title: "Reports & Analytics — Daawat Baker's" }] }),
});

const plRows = [
  { label: "Gross Revenue", amount: 960000, tone: "default" as const },
  { label: "COGS", amount: -312000, tone: "muted" as const },
  { label: "Gross Profit", amount: 648000, tone: "success" as const },
  { label: "Operating Expenses", amount: -278000, tone: "muted" as const },
  { label: "Net Profit", amount: 370000, tone: "primary" as const },
];

function ReportsPage() {
  return (
    <div>
      <PageHeader
        title="Reports & Analytics"
        crumbs={["Admin", "Reports"]}
        description="Sales, product, inventory, and financial reports."
        action={
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="rounded-xl gap-2"
              onClick={() => toast.success("CSV exported")}
            >
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button className="rounded-xl gap-2" onClick={() => toast.success("PDF exported")}>
              <FileText className="h-4 w-4" /> PDF
            </Button>
          </div>
        }
      />

      <div className="space-y-4 p-4 sm:p-6 lg:p-8">
        <div className="card-elevated flex flex-wrap items-center gap-3 p-3">
          <Input type="date" className="w-40 rounded-xl" />
          <span className="text-muted-foreground">to</span>
          <Input type="date" className="w-40 rounded-xl" />
          <Input placeholder="All Branches" className="w-44 rounded-xl" />
          <Button
            variant="outline"
            className="rounded-xl gap-2"
            onClick={() => toast.success("Filters applied")}
          >
            <Filter className="h-4 w-4" /> Apply
          </Button>
        </div>

        <Tabs defaultValue="sales">
          <TabsList className="rounded-xl">
            <TabsTrigger value="sales">Sales</TabsTrigger>
            <TabsTrigger value="product">Product</TabsTrigger>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
            <TabsTrigger value="financial">Financial</TabsTrigger>
          </TabsList>

          <TabsContent value="sales" className="mt-4 space-y-4">
            <div className="card-elevated p-4">
              <div className="text-sm font-semibold">Sales Trend</div>
              <div className="mt-2 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={salesMonthly}>
                    <defs>
                      <linearGradient id="s1" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="day" fontSize={12} stroke="var(--color-muted-foreground)" />
                    <YAxis
                      fontSize={12}
                      stroke="var(--color-muted-foreground)"
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      contentStyle={{ background: "var(--color-card)", borderRadius: 12 }}
                      formatter={(v: number) => inr(v)}
                    />
                    <Area dataKey="value" stroke="var(--color-primary)" strokeWidth={2.5} fill="url(#s1)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="product" className="mt-4 space-y-4">
            <div className="card-elevated p-4">
              <div className="text-sm font-semibold">Product Cost & Profitability</div>
              <table className="mt-3 w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Product</th>
                    <th className="px-3 py-2 text-right font-medium">Cost</th>
                    <th className="px-3 py-2 text-right font-medium">Sale Price</th>
                    <th className="px-3 py-2 text-right font-medium">Margin</th>
                    <th className="px-3 py-2 text-right font-medium">Units</th>
                    <th className="px-3 py-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {menuItems.slice(0, 8).map((m, idx) => {
                    const cost = Math.round(m.price * (0.35 + (idx % 5) * 0.06));
                    const margin = Math.round(((m.price - cost) / m.price) * 100);
                    const tone =
                      margin > 55 ? "text-success" : margin > 35 ? "text-warning" : "text-destructive";
                    const units = 40 + idx * 18;
                    return (
                      <tr key={m.code} className="border-b">
                        <td className="px-3 py-2 font-medium">{m.name}</td>
                        <td className="px-3 py-2 text-right">{inr(cost)}</td>
                        <td className="px-3 py-2 text-right">{inr(m.price)}</td>
                        <td className={`px-3 py-2 text-right font-bold ${tone}`}>{margin}%</td>
                        <td className="px-3 py-2 text-right">{units}</td>
                        <td className="px-3 py-2 text-right">
                          <RowActions
                            items={[
                              { label: "View details", onClick: () => toast.message(m.name) },
                              { label: "Export row", onClick: () => toast.success(`Exported ${m.name}`) },
                              {
                                label: "Adjust pricing",
                                onClick: () => toast.message(`Pricing · ${m.name}`),
                              },
                            ]}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="inventory" className="mt-4">
            <div className="card-elevated p-4">
              <div className="text-sm font-semibold">Stock Movement (last 12 months)</div>
              <div className="mt-2 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salesMonthly.map((m) => ({ ...m, value: Math.round(m.value / 800) }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="day" fontSize={12} stroke="var(--color-muted-foreground)" />
                    <YAxis fontSize={12} stroke="var(--color-muted-foreground)" />
                    <Tooltip contentStyle={{ background: "var(--color-card)", borderRadius: 12 }} />
                    <Bar dataKey="value" fill="var(--color-gold)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="financial" className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="card-elevated p-4">
                <div className="text-xs text-muted-foreground">Revenue (Jul)</div>
                <div className="mt-1 text-2xl font-bold">{inr(960000)}</div>
              </div>
              <div className="card-elevated p-4">
                <div className="text-xs text-muted-foreground">Expenses (Jul)</div>
                <div className="mt-1 text-2xl font-bold">{inr(590000)}</div>
              </div>
              <div className="card-elevated p-4">
                <div className="text-xs text-muted-foreground">Net Profit (Jul)</div>
                <div className="mt-1 text-2xl font-bold text-success">{inr(370000)}</div>
              </div>
            </div>
            <div className="card-elevated overflow-hidden">
              <div className="border-b p-4 text-sm font-semibold">P&amp;L Summary — July 2026</div>
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Line Item</th>
                    <th className="px-4 py-3 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {plRows.map((r) => (
                    <tr key={r.label} className="border-b">
                      <td
                        className={`px-4 py-3 ${
                          r.tone === "primary" || r.tone === "success" ? "font-semibold" : ""
                        }`}
                      >
                        {r.label}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-semibold ${
                          r.tone === "success"
                            ? "text-success"
                            : r.tone === "primary"
                              ? "text-primary"
                              : r.amount < 0
                                ? "text-muted-foreground"
                                : ""
                        }`}
                      >
                        {r.amount < 0 ? `−${inr(Math.abs(r.amount))}` : inr(r.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card-elevated p-4">
              <div className="text-sm font-semibold">GST Snapshot</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3 text-sm">
                <div className="rounded-xl border p-3">
                  <div className="text-xs text-muted-foreground">CGST collected</div>
                  <div className="font-bold">{inr(24000)}</div>
                </div>
                <div className="rounded-xl border p-3">
                  <div className="text-xs text-muted-foreground">SGST collected</div>
                  <div className="font-bold">{inr(24000)}</div>
                </div>
                <div className="rounded-xl border p-3">
                  <div className="text-xs text-muted-foreground">Input credit</div>
                  <div className="font-bold">{inr(18600)}</div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
