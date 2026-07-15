import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { RowActions } from "@/components/app/row-actions";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { inventory, menuItems, inr } from "@/lib/mock/data";
import { Boxes, PackageX, Package, ShoppingCart, Plus, Filter, Sparkles, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/inventory")({
  component: InventoryPage,
  head: () => ({ meta: [{ title: "Inventory — Daawat Baker's" }] }),
});

const entryTypes = ["Purchase", "Adjustment", "Damage", "Wastage", "Branch Transfer"] as const;

const stockMovements = [
  { id: "IN-2401", item: "Wheat Flour", type: "Purchase", qty: "+50 Kg", by: "Ritika", date: "07 Jul · 10:12" },
  { id: "OUT-1188", item: "Butter", type: "Production", qty: "-8 Kg", by: "Kitchen", date: "07 Jul · 09:40" },
  { id: "ADJ-092", item: "Cocoa Powder", type: "Adjustment", qty: "-1 Kg", by: "Store", date: "06 Jul · 18:22" },
  { id: "IN-2398", item: "Paneer", type: "Purchase", qty: "+12 Kg", by: "Nikhil", date: "06 Jul · 11:05" },
  { id: "OUT-1182", item: "Milk", type: "Wastage", qty: "-4 L", by: "Store", date: "05 Jul · 21:10" },
];

const purchaseOrders = [
  { id: "PO-412", vendor: "Modern Bakers", items: 6, total: 42800, status: "Pending" },
  { id: "PO-411", vendor: "Amul Dairy", items: 3, total: 18400, status: "Pending" },
  { id: "PO-410", vendor: "Azadpur Mandi", items: 12, total: 9200, status: "Approved" },
  { id: "PO-409", vendor: "Reliance Fresh", items: 4, total: 15600, status: "Received" },
  { id: "PO-408", vendor: "Indane", items: 1, total: 1650, status: "Received" },
];

const suppliers = [
  { name: "Modern Bakers", category: "Bakery ingredients", terms: "Net 15", contact: "+91 98100 11223" },
  { name: "Amul Dairy", category: "Dairy", terms: "Net 7", contact: "+91 98200 44556" },
  { name: "Azadpur Mandi", category: "Produce", terms: "COD", contact: "+91 98765 43210" },
  { name: "Reliance Fresh", category: "Grocery", terms: "Net 30", contact: "+91 98000 77889" },
];

const wastageLog = [
  { id: "W-88", item: "Fresh Cream", qty: "2 L", reason: "Expiry", loss: 640, date: "07 Jul" },
  { id: "W-87", item: "Tomatoes", qty: "4 Kg", reason: "Damage", loss: 280, date: "06 Jul" },
  { id: "W-86", item: "Butter Chapati", qty: "18 pcs", reason: "Overbake", loss: 810, date: "06 Jul" },
  { id: "W-85", item: "Milk", qty: "3 L", reason: "Spill", loss: 210, date: "05 Jul" },
];

function statusOf(cur: number, ro: number) {
  if (cur === 0) return "Out";
  if (cur <= ro) return "Low";
  return "In Stock";
}

function InventoryPage() {
  const [add, setAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [entryType, setEntryType] = useState<(typeof entryTypes)[number]>("Purchase");
  const stockValue = inventory.reduce((s, i) => s + i.current * 120, 0);
  const low = inventory.filter((i) => i.current <= i.reorder).length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return inventory;
    return inventory.filter(
      (i) => i.name.toLowerCase().includes(q) || i.cat.toLowerCase().includes(q),
    );
  }, [search]);

  return (
    <div>
      <PageHeader
        title="Inventory & Store"
        crumbs={["Operations", "Inventory"]}
        description="Track stock, orders, wastage, recipes, and production planning."
        action={
          <Button className="rounded-xl gap-2" onClick={() => setAdd(true)}>
            <Plus className="h-4 w-4" /> Add Stock Entry
          </Button>
        }
      />

      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <MiniCard icon={Boxes} label="Total SKUs" value={String(inventory.length)} tone="brand" />
          <MiniCard icon={PackageX} label="Low Stock" value={String(low)} tone="warning" />
          <MiniCard icon={Package} label="Stock Value" value={inr(stockValue)} tone="gold" />
          <MiniCard icon={ShoppingCart} label="Pending POs" value="6" tone="info" />
        </div>

        <Tabs defaultValue="stock">
          <TabsList className="rounded-xl flex-wrap h-auto">
            <TabsTrigger value="stock">Stock Overview</TabsTrigger>
            <TabsTrigger value="inout">Stock In-Out</TabsTrigger>
            <TabsTrigger value="po">Purchase Orders</TabsTrigger>
            <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
            <TabsTrigger value="wastage">Wastage</TabsTrigger>
            <TabsTrigger value="recipe">Recipes</TabsTrigger>
          </TabsList>

          <TabsContent value="stock" className="mt-4 space-y-4">
            <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
              <div className="card-elevated overflow-hidden">
                <div className="flex items-center justify-between border-b p-3 gap-3">
                  <Input
                    placeholder="Search items…"
                    className="max-w-xs rounded-xl"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <Button
                    variant="outline"
                    className="rounded-xl gap-2"
                    onClick={() => toast.message("Filters coming soon")}
                  >
                    <Filter className="h-4 w-4" /> Filters
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">Item</th>
                        <th className="px-4 py-3 text-left font-medium">Category</th>
                        <th className="px-4 py-3 text-right font-medium">Opening</th>
                        <th className="px-4 py-3 text-right font-medium">Current</th>
                        <th className="px-4 py-3 text-right font-medium">Reorder</th>
                        <th className="px-4 py-3 text-left font-medium">Status</th>
                        <th className="px-4 py-3 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((i) => (
                        <tr key={i.name} className="border-b hover:bg-muted/40">
                          <td className="px-4 py-3 font-medium">{i.name}</td>
                          <td className="px-4 py-3 text-muted-foreground">{i.cat}</td>
                          <td className="px-4 py-3 text-right">
                            {i.opening} {i.unit}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold">
                            {i.current} {i.unit}
                          </td>
                          <td className="px-4 py-3 text-right text-muted-foreground">
                            {i.reorder} {i.unit}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={statusOf(i.current, i.reorder)} />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <RowActions
                              items={[
                                {
                                  label: "Adjust stock",
                                  onClick: () => toast.message(`Adjust stock · ${i.name}`),
                                },
                                {
                                  label: "Create PO",
                                  onClick: () => toast.success(`PO drafted for ${i.name}`),
                                },
                                {
                                  label: "History",
                                  onClick: () => toast.message(`History · ${i.name}`),
                                },
                                { separator: true, label: "", onClick: () => {} },
                                {
                                  label: "Edit",
                                  onClick: () => toast.message(`Edit ${i.name}`),
                                },
                              ]}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card-elevated space-y-3 p-4">
                <div className="flex items-center gap-2">
                  <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">Smart Production Planning</div>
                    <div className="text-xs text-muted-foreground">Forecast for tomorrow</div>
                  </div>
                </div>
                <div className="rounded-xl border p-3 text-sm">
                  <div className="text-xs text-muted-foreground">Predicted demand</div>
                  <div className="mt-1 font-semibold">312 units · ₹1.4L revenue</div>
                </div>
                <div className="rounded-xl border p-3 text-sm">
                  <div className="text-xs text-muted-foreground">Ingredient shortages</div>
                  <div className="mt-2 space-y-1.5">
                    {inventory
                      .filter((i) => i.current <= i.reorder)
                      .slice(0, 3)
                      .map((i) => (
                        <div
                          key={i.name}
                          className="flex items-center gap-2 rounded-lg bg-warning/10 p-2 text-xs"
                        >
                          <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                          <span className="flex-1 truncate">{i.name}</span>
                          <span className="font-semibold">
                            Need {i.reorder - i.current} {i.unit}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 rounded-xl bg-primary/5 p-3 text-center text-xs">
                  <div>
                    <div className="text-muted-foreground">Cost</div>
                    <div className="font-bold text-foreground">{inr(28400)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Revenue</div>
                    <div className="font-bold text-primary">{inr(142000)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Profit</div>
                    <div className="font-bold text-success">{inr(113600)}</div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="inout" className="mt-4">
            <div className="card-elevated overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Ref</th>
                    <th className="px-4 py-3 text-left font-medium">Item</th>
                    <th className="px-4 py-3 text-left font-medium">Type</th>
                    <th className="px-4 py-3 text-right font-medium">Qty</th>
                    <th className="px-4 py-3 text-left font-medium">By</th>
                    <th className="px-4 py-3 text-left font-medium">Date</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {stockMovements.map((m) => (
                    <tr key={m.id} className="border-b hover:bg-muted/40">
                      <td className="px-4 py-3 font-medium">{m.id}</td>
                      <td className="px-4 py-3">{m.item}</td>
                      <td className="px-4 py-3 text-muted-foreground">{m.type}</td>
                      <td className="px-4 py-3 text-right font-semibold">{m.qty}</td>
                      <td className="px-4 py-3 text-muted-foreground">{m.by}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{m.date}</td>
                      <td className="px-4 py-3 text-right">
                        <RowActions
                          items={[
                            { label: "View details", onClick: () => toast.message(m.id) },
                            { label: "Reverse entry", onClick: () => toast.success(`Reversed ${m.id}`) },
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="po" className="mt-4">
            <div className="card-elevated overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">PO</th>
                    <th className="px-4 py-3 text-left font-medium">Vendor</th>
                    <th className="px-4 py-3 text-right font-medium">Items</th>
                    <th className="px-4 py-3 text-right font-medium">Total</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {purchaseOrders.map((po) => (
                    <tr key={po.id} className="border-b hover:bg-muted/40">
                      <td className="px-4 py-3 font-medium">{po.id}</td>
                      <td className="px-4 py-3">{po.vendor}</td>
                      <td className="px-4 py-3 text-right">{po.items}</td>
                      <td className="px-4 py-3 text-right font-semibold">{inr(po.total)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={po.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <RowActions
                          items={[
                            { label: "View PO", onClick: () => toast.message(po.id) },
                            {
                              label: "Approve",
                              onClick: () => toast.success(`${po.id} approved`),
                              disabled: po.status !== "Pending",
                            },
                            {
                              label: "Cancel",
                              onClick: () => toast.message(`${po.id} cancelled`),
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

          <TabsContent value="suppliers" className="mt-4">
            <div className="card-elevated overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Supplier</th>
                    <th className="px-4 py-3 text-left font-medium">Category</th>
                    <th className="px-4 py-3 text-left font-medium">Terms</th>
                    <th className="px-4 py-3 text-left font-medium">Contact</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((s) => (
                    <tr key={s.name} className="border-b hover:bg-muted/40">
                      <td className="px-4 py-3 font-medium">{s.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{s.category}</td>
                      <td className="px-4 py-3">{s.terms}</td>
                      <td className="px-4 py-3 text-muted-foreground">{s.contact}</td>
                      <td className="px-4 py-3 text-right">
                        <RowActions
                          items={[
                            { label: "View", onClick: () => toast.message(s.name) },
                            { label: "Create PO", onClick: () => toast.success(`PO for ${s.name}`) },
                            { label: "Edit", onClick: () => toast.message(`Edit ${s.name}`) },
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="wastage" className="mt-4">
            <div className="card-elevated overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">ID</th>
                    <th className="px-4 py-3 text-left font-medium">Item</th>
                    <th className="px-4 py-3 text-right font-medium">Qty</th>
                    <th className="px-4 py-3 text-left font-medium">Reason</th>
                    <th className="px-4 py-3 text-right font-medium">Loss</th>
                    <th className="px-4 py-3 text-left font-medium">Date</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {wastageLog.map((w) => (
                    <tr key={w.id} className="border-b hover:bg-muted/40">
                      <td className="px-4 py-3 font-medium">{w.id}</td>
                      <td className="px-4 py-3">{w.item}</td>
                      <td className="px-4 py-3 text-right">{w.qty}</td>
                      <td className="px-4 py-3 text-muted-foreground">{w.reason}</td>
                      <td className="px-4 py-3 text-right font-semibold text-destructive">{inr(w.loss)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{w.date}</td>
                      <td className="px-4 py-3 text-right">
                        <RowActions
                          items={[
                            { label: "View", onClick: () => toast.message(w.id) },
                            {
                              label: "Dispute",
                              onClick: () => toast.message(`Dispute logged for ${w.id}`),
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

          <TabsContent value="recipe" className="mt-4">
            <div className="card-elevated p-4">
              <div className="text-sm font-semibold">Recipe → Ingredient Consumption</div>
              <div className="mt-3 space-y-2">
                {menuItems.slice(0, 4).map((m) => (
                  <div key={m.code} className="rounded-xl border p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{m.name}</div>
                        <div className="text-xs text-muted-foreground">Sale price {inr(m.price)}</div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-lg"
                        onClick={() => toast.message(`Edit recipe · ${m.name}`)}
                      >
                        Edit Recipe
                      </Button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs">Wheat Flour · 120g</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs">Butter · 40g</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs">Sugar · 30g</span>
                      <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs text-success">
                        Auto-deduct: ON
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={add} onOpenChange={setAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Stock Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Entry Type</Label>
              <div className="mt-1 grid grid-cols-3 gap-2">
                {entryTypes.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setEntryType(t)}
                    className={`rounded-xl border px-2 py-2 text-xs hover:border-primary hover:bg-primary/5 ${
                      entryType === t ? "border-primary bg-primary/10 text-primary font-medium" : ""
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Item</Label>
              <Input placeholder="Select item…" className="mt-1 rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Quantity</Label>
                <Input type="number" className="mt-1 rounded-xl" />
              </div>
              <div>
                <Label>Unit Cost (₹)</Label>
                <Input type="number" className="mt-1 rounded-xl" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAdd(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  toast.success(`${entryType} entry saved`);
                  setAdd(false);
                }}
              >
                Save Entry
              </Button>
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
  icon: typeof Boxes;
  label: string;
  value: string;
  tone: "brand" | "warning" | "gold" | "info";
}) {
  const map = {
    brand: "bg-primary/10 text-primary",
    warning: "bg-warning/10 text-warning",
    gold: "bg-gold/20 text-gold-foreground",
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
