import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { RowActions } from "@/components/app/row-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { menuItems as seedMenu, categories, inr } from "@/lib/mock/data";
import { Plus, LayoutGrid, List, ImageIcon, Search, GripVertical } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/menu")({
  component: MenuPage,
  head: () => ({ meta: [{ title: "Menu & Products — Daawat Baker's" }] }),
});

type MenuItem = (typeof seedMenu)[number];

function MenuPage() {
  const [items, setItems] = useState(() => [...seedMenu]);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [branch, setBranch] = useState<"all" | "bakery" | "restaurant">("all");
  const [category, setCategory] = useState<string>("all");
  const [q, setQ] = useState("");
  const [avail, setAvail] = useState<Record<number, boolean>>(() => Object.fromEntries(seedMenu.map((m) => [m.code, true])));
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ name: "", cat: "", price: "", desc: "" });

  const filtered = useMemo(
    () =>
      items.filter(
        (m) =>
          (branch === "all" || m.branch === branch) &&
          (category === "all" || m.cat === category) &&
          m.name.toLowerCase().includes(q.toLowerCase()),
      ),
    [items, branch, category, q],
  );

  const toggleSel = (code: number) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(code) ? n.delete(code) : n.add(code);
      return n;
    });

  function setBulkAvail(value: boolean) {
    setAvail((a) => {
      const next = { ...a };
      selected.forEach((code) => {
        next[code] = value;
      });
      return next;
    });
    toast.success(`${selected.size} items ${value ? "enabled" : "disabled"}`);
  }

  function saveProduct() {
    if (!form.name.trim() || !form.price) {
      toast.error("Name and price are required");
      return;
    }
    const code = Math.max(...items.map((i) => i.code), 100) + 1;
    const next: MenuItem = {
      code,
      name: form.name.trim(),
      cat: form.cat.trim() || "Cakes",
      price: Number(form.price) || 0,
      unit: "pc",
      branch: branch === "restaurant" ? "restaurant" : "bakery",
      veg: true,
    };
    setItems((prev) => [next, ...prev]);
    setAvail((a) => ({ ...a, [code]: true }));
    setModal(false);
    setForm({ name: "", cat: "", price: "", desc: "" });
    toast.success(`${next.name} added`);
  }

  return (
    <div>
      <PageHeader
        title="Menu & Products"
        crumbs={["Operations", "Menu"]}
        description="Manage your bakery and restaurant catalogue."
        action={
          <Button className="rounded-xl gap-2" onClick={() => setModal(true)}>
            <Plus className="h-4 w-4" /> Add Product
          </Button>
        }
      />
      <div className="grid gap-4 p-4 lg:grid-cols-[220px_1fr] sm:p-6 lg:p-8">
        <div className="card-elevated h-fit p-3">
          <div className="mb-2 px-2 text-xs font-semibold uppercase text-muted-foreground">Categories</div>
          <ul className="space-y-1">
            <li>
              <button
                type="button"
                onClick={() => setCategory("all")}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${category === "all" ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}
              >
                All Categories<span className="ml-auto text-xs">{items.length}</span>
              </button>
            </li>
            {categories.map((c) => (
              <li key={c}>
                <button
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm ${category === c ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted"}`}
                >
                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="flex-1 text-left">{c}</span>
                  <span className="text-xs text-muted-foreground">{items.filter((m) => m.cat === c).length}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Tabs value={branch} onValueChange={(v) => setBranch(v as typeof branch)}>
              <TabsList className="rounded-xl">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="bakery">Bakery</TabsTrigger>
                <TabsTrigger value="restaurant">Restaurant</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="w-56 rounded-xl pl-9" />
              </div>
              <div className="flex rounded-xl border p-0.5">
                <Button size="sm" variant={view === "grid" ? "default" : "ghost"} className="h-8 rounded-lg" onClick={() => setView("grid")}>
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button size="sm" variant={view === "list" ? "default" : "ghost"} className="h-8 rounded-lg" onClick={() => setView("list")}>
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {selected.size > 0 && (
            <div className="flex items-center justify-between rounded-xl bg-primary/10 p-3 text-sm">
              <span>
                <b>{selected.size}</b> selected
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="rounded-lg" onClick={() => setBulkAvail(true)}>
                  Bulk enable
                </Button>
                <Button size="sm" variant="outline" className="rounded-lg" onClick={() => setBulkAvail(false)}>
                  Bulk disable
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-lg"
                  onClick={() => {
                    toast.success(`Category change queued for ${selected.size} items`);
                    setSelected(new Set());
                  }}
                >
                  Change category
                </Button>
              </div>
            </div>
          )}

          {view === "grid" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filtered.map((m) => (
                <div key={m.code} className={`card-elevated group relative overflow-hidden p-3 transition-all ${selected.has(m.code) ? "ring-2 ring-primary" : ""}`}>
                  <div className="absolute right-2 top-2 z-10">
                    <RowActions
                      items={[
                        { label: "Edit", onClick: () => toast.message(`Edit ${m.name}`) },
                        {
                          label: "Duplicate",
                          onClick: () => {
                            const code = Math.max(...items.map((i) => i.code)) + 1;
                            setItems((prev) => [{ ...m, code, name: `${m.name} (copy)` }, ...prev]);
                            setAvail((a) => ({ ...a, [code]: true }));
                            toast.success("Product duplicated");
                          },
                        },
                        {
                          label: avail[m.code] ? "Mark unavailable" : "Mark available",
                          onClick: () => setAvail((a) => ({ ...a, [m.code]: !a[m.code] })),
                        },
                        {
                          label: "Delete",
                          onClick: () => {
                            setItems((prev) => prev.filter((x) => x.code !== m.code));
                            toast.success(`${m.name} deleted`);
                          },
                          destructive: true,
                        },
                      ]}
                    />
                  </div>
                  <input type="checkbox" checked={selected.has(m.code)} onChange={() => toggleSel(m.code)} className="absolute left-4 top-4 z-10 h-4 w-4 accent-primary" />
                  <div className="mb-3 grid h-28 place-items-center rounded-xl bg-gradient-to-br from-primary/10 to-gold/20 text-4xl">{m.veg ? "🥗" : "🍗"}</div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{m.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {m.cat} · #{m.code}
                      </div>
                    </div>
                    <div className="text-sm font-bold text-primary">{inr(m.price)}</div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs capitalize text-muted-foreground">{m.branch}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs">{avail[m.code] ? "Available" : "Unavailable"}</span>
                      <Switch checked={avail[m.code]} onCheckedChange={(v) => setAvail((a) => ({ ...a, [m.code]: v }))} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card-elevated overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="w-8 px-4 py-3" />
                    <th className="px-4 py-3 text-left font-medium">Item</th>
                    <th className="px-4 py-3 text-left font-medium">Category</th>
                    <th className="px-4 py-3 text-left font-medium">Branch</th>
                    <th className="px-4 py-3 text-right font-medium">Price</th>
                    <th className="px-4 py-3 text-right font-medium">Available</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m) => (
                    <tr key={m.code} className="border-b hover:bg-muted/40">
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selected.has(m.code)} onChange={() => toggleSel(m.code)} className="accent-primary" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{m.name}</div>
                        <div className="text-xs text-muted-foreground">#{m.code}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{m.cat}</td>
                      <td className="px-4 py-3 capitalize text-muted-foreground">{m.branch}</td>
                      <td className="px-4 py-3 text-right font-semibold">{inr(m.price)}</td>
                      <td className="px-4 py-3 text-right">
                        <Switch checked={avail[m.code]} onCheckedChange={(v) => setAvail((a) => ({ ...a, [m.code]: v }))} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <RowActions
                          items={[
                            { label: "Edit", onClick: () => toast.message(`Edit ${m.name}`) },
                            {
                              label: "Delete",
                              onClick: () => {
                                setItems((prev) => prev.filter((x) => x.code !== m.code));
                                toast.success(`${m.name} deleted`);
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
          )}
        </div>
      </div>

      <Dialog open={modal} onOpenChange={setModal}>
        <DialogContent className="max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle>Add Product</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Product Name</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Vanilla Sponge Cake" className="mt-1 rounded-xl" />
            </div>
            <div>
              <Label>Category</Label>
              <Input value={form.cat} onChange={(e) => setForm((f) => ({ ...f, cat: e.target.value }))} placeholder="Cakes" className="mt-1 rounded-xl" />
            </div>
            <div>
              <Label>Price (₹)</Label>
              <Input type="number" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} placeholder="890" className="mt-1 rounded-xl" />
            </div>
            <div>
              <Label>Tax Category</Label>
              <Input placeholder="GST 5%" className="mt-1 rounded-xl" />
            </div>
            <div className="sm:col-span-2">
              <Label>Description</Label>
              <Textarea value={form.desc} onChange={(e) => setForm((f) => ({ ...f, desc: e.target.value }))} placeholder="Short description shown to customers" className="mt-1 rounded-xl" />
            </div>
            <div className="sm:col-span-2">
              <Label>Images</Label>
              <button
                type="button"
                onClick={() => toast.message("Image upload ready — attach files in production")}
                className="mt-1 grid h-32 w-full place-items-center rounded-xl border-2 border-dashed border-border bg-muted/20 text-sm text-muted-foreground hover:bg-muted/40"
              >
                <div className="text-center">
                  <ImageIcon className="mx-auto mb-1 h-5 w-5" /> Drag & drop or click to upload
                </div>
              </button>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setModal(false)}>
              Cancel
            </Button>
            <Button className="rounded-xl" onClick={saveProduct}>
              Save Product
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
