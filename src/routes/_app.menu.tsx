import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { RowActions } from "@/components/app/row-actions";
import { Badge } from "@/components/ui/badge";
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
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { menuItems as seedMenu, inr, type Branch } from "@/lib/mock/data";
import { usePanel, usePanelMeta } from "@/lib/use-panel";
import {
  Plus,
  LayoutGrid,
  List,
  ImageIcon,
  Search,
  GripVertical,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/menu")({
  component: MenuPage,
  head: () => ({ meta: [{ title: "Menu & Products — Daawat Baker's" }] }),
});

type Dietary = "veg" | "egg" | "non-veg";

type MenuVariant = { name: string; price: number };
type AddonOption = { name: string; price: number };
type AddonGroup = { name: string; min: number; max: number; options: AddonOption[] };

type MenuItem = (typeof seedMenu)[number] & {
  desc?: string;
  dietary?: Dietary;
  tax?: string;
  packagingCharge?: number;
  tags?: string[];
  serves?: string;
  variants?: MenuVariant[];
  addons?: AddonGroup[];
};

type FormVariant = { id: string; name: string; price: string };
type FormAddonOption = { id: string; name: string; price: string };
type FormAddonGroup = {
  id: string;
  name: string;
  min: number;
  max: number;
  options: FormAddonOption[];
};

type ProductForm = {
  name: string;
  cat: string;
  price: string;
  desc: string;
  dietary: Dietary;
  unit: string;
  tax: string;
  packagingCharge: string;
  tags: string[];
  serves: string;
  variants: FormVariant[];
  addons: FormAddonGroup[];
};

const TAX_OPTIONS = [
  "GST 5% (2.5% CGST + 2.5% SGST)",
  "GST 12% (6% CGST + 6% SGST)",
  "GST 18% (9% CGST + 9% SGST)",
  "Exempt",
];

const UNIT_OPTIONS = ["plate", "pcs", "pc", "kg", "box", "cup", "glass", "portion"];

const DISH_TAGS = [
  "New",
  "Chef's Special",
  "Spicy",
  "Gluten Free",
  "Restaurant Recommended",
  "Seasonal",
  "Vegan",
  "Best Seller",
];

const uid = () => Math.random().toString(36).slice(2, 9);

const emptyForm = (): ProductForm => ({
  name: "",
  cat: "",
  price: "",
  desc: "",
  dietary: "veg",
  unit: "plate",
  tax: TAX_OPTIONS[0],
  packagingCharge: "0",
  tags: [],
  serves: "",
  variants: [],
  addons: [],
});

function dietaryOf(m: MenuItem): Dietary {
  return m.dietary ?? (m.veg ? "veg" : "non-veg");
}

function dietaryMark(d: Dietary) {
  if (d === "veg") return { emoji: "🥗", label: "Veg", className: "border-emerald-500 bg-emerald-50 text-emerald-700" };
  if (d === "egg") return { emoji: "🥚", label: "Egg", className: "border-amber-500 bg-amber-50 text-amber-700" };
  return { emoji: "🍗", label: "Non-veg", className: "border-rose-500 bg-rose-50 text-rose-700" };
}

function MenuPage() {
  const panel = usePanel();
  const meta = usePanelMeta();
  const panelSeed = useMemo(() => seedMenu.filter((m) => m.branch === panel), [panel]);
  const [items, setItems] = useState<MenuItem[]>(() => panelSeed);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [category, setCategory] = useState<string>("all");
  const [q, setQ] = useState("");
  const [avail, setAvail] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(panelSeed.map((m) => [m.code, true])),
  );
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<ProductForm>(emptyForm);

  useEffect(() => {
    setItems(panelSeed);
    setAvail(Object.fromEntries(panelSeed.map((m) => [m.code, true])));
    setSelected(new Set());
    setCategory("all");
  }, [panelSeed]);

  const categories = useMemo(() => Array.from(new Set(items.map((m) => m.cat))), [items]);

  const filtered = useMemo(
    () =>
      items.filter(
        (m) =>
          (category === "all" || m.cat === category) &&
          m.name.toLowerCase().includes(q.toLowerCase()),
      ),
    [items, category, q],
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

  function openAdd() {
    setForm(emptyForm());
    setModal(true);
  }

  function toggleTag(tag: string) {
    setForm((f) => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter((t) => t !== tag) : [...f.tags, tag],
    }));
  }

  function addVariant() {
    setForm((f) => ({
      ...f,
      variants: [...f.variants, { id: uid(), name: "", price: "" }],
    }));
  }

  function updateVariant(id: string, patch: Partial<FormVariant>) {
    setForm((f) => ({
      ...f,
      variants: f.variants.map((v) => (v.id === id ? { ...v, ...patch } : v)),
    }));
  }

  function removeVariant(id: string) {
    setForm((f) => ({ ...f, variants: f.variants.filter((v) => v.id !== id) }));
  }

  function addAddonGroup() {
    setForm((f) => ({
      ...f,
      addons: [
        ...f.addons,
        {
          id: uid(),
          name: "",
          min: 0,
          max: 1,
          options: [{ id: uid(), name: "", price: "0" }],
        },
      ],
    }));
  }

  function updateAddonGroup(id: string, patch: Partial<FormAddonGroup>) {
    setForm((f) => ({
      ...f,
      addons: f.addons.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    }));
  }

  function removeAddonGroup(id: string) {
    setForm((f) => ({ ...f, addons: f.addons.filter((g) => g.id !== id) }));
  }

  function addAddonOption(groupId: string) {
    setForm((f) => ({
      ...f,
      addons: f.addons.map((g) =>
        g.id === groupId
          ? { ...g, options: [...g.options, { id: uid(), name: "", price: "0" }] }
          : g,
      ),
    }));
  }

  function updateAddonOption(groupId: string, optionId: string, patch: Partial<FormAddonOption>) {
    setForm((f) => ({
      ...f,
      addons: f.addons.map((g) =>
        g.id === groupId
          ? {
              ...g,
              options: g.options.map((o) => (o.id === optionId ? { ...o, ...patch } : o)),
            }
          : g,
      ),
    }));
  }

  function removeAddonOption(groupId: string, optionId: string) {
    setForm((f) => ({
      ...f,
      addons: f.addons.map((g) =>
        g.id === groupId ? { ...g, options: g.options.filter((o) => o.id !== optionId) } : g,
      ),
    }));
  }

  function saveProduct() {
    if (!form.name.trim() || !form.price) {
      toast.error("Dish name and price are required");
      return;
    }
    if (!form.cat.trim()) {
      toast.error("Category is required");
      return;
    }
    if (!form.dietary) {
      toast.error("Dietary type is required");
      return;
    }

    const incompleteVariant = form.variants.some((v) => !v.name.trim() || v.price === "");
    if (incompleteVariant) {
      toast.error("Fill all variant names and prices, or remove empty variants");
      return;
    }

    for (const group of form.addons) {
      if (!group.name.trim()) {
        toast.error("Add-on group name is required");
        return;
      }
      if (group.options.length === 0 || group.options.some((o) => !o.name.trim())) {
        toast.error("Each add-on group needs at least one named option");
        return;
      }
    }

    const code = Math.max(...items.map((i) => i.code), 100) + 1;
    const basePrice = Number(form.price) || 0;
    const next: MenuItem = {
      code,
      name: form.name.trim(),
      cat: form.cat.trim(),
      price: basePrice,
      unit: form.unit || "plate",
      branch: (panel === "restaurant" ? "restaurant" : "bakery") as Branch,
      veg: form.dietary === "veg",
      dietary: form.dietary,
      desc: form.desc.trim() || undefined,
      tax: form.tax,
      packagingCharge: Number(form.packagingCharge) || 0,
      tags: form.tags,
      serves: form.serves.trim() || undefined,
      variants: form.variants.map((v) => ({
        name: v.name.trim(),
        price: Number(v.price) || 0,
      })),
      addons: form.addons.map((g) => ({
        name: g.name.trim(),
        min: g.min,
        max: Math.max(g.max, g.min),
        options: g.options.map((o) => ({
          name: o.name.trim(),
          price: Number(o.price) || 0,
        })),
      })),
    };
    setItems((prev) => [next, ...prev]);
    setAvail((a) => ({ ...a, [code]: true }));
    setModal(false);
    setForm(emptyForm());
    toast.success(`${next.name} added to ${meta.label} menu`);
  }

  return (
    <div>
      <PageHeader
        title={`${meta.label} Menu`}
        crumbs={["Operations", "Menu"]}
        description={`Products for ${meta.label} only — GST ${meta.gst}. Other panels stay separate.`}
        action={
          <Button className="rounded-xl gap-2" onClick={openAdd}>
            <Plus className="h-4 w-4" /> Add Item
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
            <div className="text-sm text-muted-foreground">
              Showing <b className="text-foreground">{filtered.length}</b> {meta.label.toLowerCase()} items
            </div>
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
              {filtered.map((m) => {
                const diet = dietaryMark(dietaryOf(m));
                return (
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
                              toast.success("Item duplicated");
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
                    <div className="mb-3 grid h-28 place-items-center rounded-xl bg-gradient-to-br from-primary/10 to-gold/20 text-4xl">
                      {diet.emoji}
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-sm border ${diet.className.split(" ").slice(0, 1).join(" ")} ${dietaryOf(m) === "veg" ? "bg-emerald-500" : dietaryOf(m) === "egg" ? "bg-amber-500" : "bg-rose-500"}`} />
                          <div className="truncate text-sm font-semibold">{m.name}</div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {m.cat} · #{m.code}
                          {m.variants && m.variants.length > 0 ? ` · ${m.variants.length} variants` : ""}
                        </div>
                        {m.tags && m.tags.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {m.tags.slice(0, 2).map((t) => (
                              <Badge key={t} variant="secondary" className="rounded-md px-1.5 py-0 text-[10px] font-medium">
                                {t}
                              </Badge>
                            ))}
                          </div>
                        )}
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
                );
              })}
            </div>
          ) : (
            <div className="card-elevated overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="w-8 px-4 py-3" />
                    <th className="px-4 py-3 text-left font-medium">Item</th>
                    <th className="px-4 py-3 text-left font-medium">Category</th>
                    <th className="px-4 py-3 text-left font-medium">Type</th>
                    <th className="px-4 py-3 text-right font-medium">Price</th>
                    <th className="px-4 py-3 text-right font-medium">Available</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m) => {
                    const diet = dietaryMark(dietaryOf(m));
                    return (
                      <tr key={m.code} className="border-b hover:bg-muted/40">
                        <td className="px-4 py-3">
                          <input type="checkbox" checked={selected.has(m.code)} onChange={() => toggleSel(m.code)} className="accent-primary" />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 font-medium">
                            <span className={`inline-block h-2.5 w-2.5 rounded-sm ${dietaryOf(m) === "veg" ? "bg-emerald-500" : dietaryOf(m) === "egg" ? "bg-amber-500" : "bg-rose-500"}`} />
                            {m.name}
                          </div>
                          <div className="text-xs text-muted-foreground">#{m.code}</div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{m.cat}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={`rounded-md ${diet.className}`}>
                            {diet.label}
                          </Badge>
                        </td>
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Sheet open={modal} onOpenChange={setModal}>
        <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
          <SheetHeader className="border-b px-6 py-4 text-left">
            <SheetTitle>Add Menu Item</SheetTitle>
            <p className="text-sm text-muted-foreground">
              Same flow as restaurant partner menus — dish details, dietary, taxes, variants & add-ons.
            </p>
          </SheetHeader>

          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
            {/* Dish details */}
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dish details</h3>
              <div>
                <Label>Name of the dish *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Dal Makhni"
                  className="mt-1 rounded-xl"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Category *</Label>
                  <Input
                    value={form.cat}
                    onChange={(e) => setForm((f) => ({ ...f, cat: e.target.value }))}
                    placeholder="Main Course"
                    list="menu-categories"
                    className="mt-1 rounded-xl"
                  />
                  <datalist id="menu-categories">
                    {categories.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <Label>Serving info</Label>
                  <Input
                    value={form.serves}
                    onChange={(e) => setForm((f) => ({ ...f, serves: e.target.value }))}
                    placeholder="Serves 1–2"
                    className="mt-1 rounded-xl"
                  />
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={form.desc}
                  onChange={(e) => setForm((f) => ({ ...f, desc: e.target.value }))}
                  placeholder="Creamy and buttery Dal Makhani cooked with butter and cream"
                  className="mt-1 min-h-20 rounded-xl"
                />
              </div>
              <div>
                <Label>Dish image</Label>
                <button
                  type="button"
                  onClick={() => toast.message("Image upload ready — attach files in production")}
                  className="mt-1 grid h-28 w-full place-items-center rounded-xl border-2 border-dashed border-border bg-muted/20 text-sm text-muted-foreground hover:bg-muted/40"
                >
                  <div className="text-center">
                    <ImageIcon className="mx-auto mb-1 h-5 w-5" />
                    Drag & drop or click to upload
                  </div>
                </button>
              </div>
            </section>

            <Separator />

            {/* Dietary — veg only */}
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dietary type *</h3>
              <div className="flex items-center gap-2 rounded-xl border-2 border-emerald-500 bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-700">
                <span className="h-3 w-3 rounded-sm border-2 border-emerald-600 bg-emerald-500" />
                Veg
              </div>
            </section>

            <Separator />

            {/* Pricing */}
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pricing</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Price of the dish (₹) *</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.price}
                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                    placeholder="320"
                    className="mt-1 rounded-xl"
                  />
                </div>
                <div>
                  <Label>Unit</Label>
                  <Select value={form.unit} onValueChange={(v) => setForm((f) => ({ ...f, unit: v }))}>
                    <SelectTrigger className="mt-1 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIT_OPTIONS.map((u) => (
                        <SelectItem key={u} value={u}>
                          {u}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            <Separator />

            {/* Taxes & charges — Zomato section */}
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Taxes & charges</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Tax on the item</Label>
                  <Select value={form.tax} onValueChange={(v) => setForm((f) => ({ ...f, tax: v }))}>
                    <SelectTrigger className="mt-1 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TAX_OPTIONS.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Packaging charge (₹)</Label>
                  <Select
                    value={form.packagingCharge}
                    onValueChange={(v) => setForm((f) => ({ ...f, packagingCharge: v }))}
                  >
                    <SelectTrigger className="mt-1 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["0", "5", "10", "15", "20", "25", "30", "50"].map((c) => (
                        <SelectItem key={c} value={c}>
                          {c === "0" ? "No packaging charge" : `₹${c} Packaging Charge`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            <Separator />

            {/* Tags */}
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {DISH_TAGS.map((tag) => {
                  const active = form.tags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </section>

            <Separator />

            {/* Variants — Zomato customisation */}
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Variant pricing</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">e.g. Half / Full, Regular / Large</p>
                </div>
                <Button type="button" size="sm" variant="outline" className="rounded-lg" onClick={addVariant}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add variant
                </Button>
              </div>
              {form.variants.length === 0 ? (
                <p className="rounded-xl border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
                  No variants — base price above will be used
                </p>
              ) : (
                <div className="space-y-2">
                  {form.variants.map((v) => (
                    <div key={v.id} className="flex items-center gap-2">
                      <Input
                        value={v.name}
                        onChange={(e) => updateVariant(v.id, { name: e.target.value })}
                        placeholder="Half"
                        className="rounded-xl"
                      />
                      <Input
                        type="number"
                        min={0}
                        value={v.price}
                        onChange={(e) => updateVariant(v.id, { price: e.target.value })}
                        placeholder="₹"
                        className="w-28 rounded-xl"
                      />
                      <Button type="button" size="icon" variant="ghost" className="shrink-0" onClick={() => removeVariant(v.id)}>
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <Separator />

            {/* Add-ons */}
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Add-ons</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">Optional extras like beverages or toppings</p>
                </div>
                <Button type="button" size="sm" variant="outline" className="rounded-lg" onClick={addAddonGroup}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add group
                </Button>
              </div>
              {form.addons.length === 0 ? (
                <p className="rounded-xl border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
                  No add-on groups yet
                </p>
              ) : (
                <div className="space-y-4">
                  {form.addons.map((group) => (
                    <div key={group.id} className="space-y-3 rounded-xl border bg-muted/20 p-3">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1 space-y-2">
                          <Input
                            value={group.name}
                            onChange={(e) => updateAddonGroup(group.id, { name: e.target.value })}
                            placeholder="Group name — e.g. Beverages"
                            className="rounded-xl bg-background"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">Min select</Label>
                              <Input
                                type="number"
                                min={0}
                                value={group.min}
                                onChange={(e) =>
                                  updateAddonGroup(group.id, { min: Math.max(0, Number(e.target.value) || 0) })
                                }
                                className="mt-1 rounded-xl bg-background"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Max select</Label>
                              <Input
                                type="number"
                                min={0}
                                value={group.max}
                                onChange={(e) =>
                                  updateAddonGroup(group.id, { max: Math.max(0, Number(e.target.value) || 0) })
                                }
                                className="mt-1 rounded-xl bg-background"
                              />
                            </div>
                          </div>
                        </div>
                        <Button type="button" size="icon" variant="ghost" onClick={() => removeAddonGroup(group.id)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {group.options.map((opt) => (
                          <div key={opt.id} className="flex items-center gap-2">
                            <Checkbox checked disabled className="opacity-40" />
                            <Input
                              value={opt.name}
                              onChange={(e) => updateAddonOption(group.id, opt.id, { name: e.target.value })}
                              placeholder="Coke"
                              className="rounded-xl bg-background"
                            />
                            <Input
                              type="number"
                              min={0}
                              value={opt.price}
                              onChange={(e) => updateAddonOption(group.id, opt.id, { price: e.target.value })}
                              placeholder="₹"
                              className="w-24 rounded-xl bg-background"
                            />
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="shrink-0"
                              disabled={group.options.length <= 1}
                              onClick={() => removeAddonOption(group.id, opt.id)}
                            >
                              <Trash2 className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 rounded-lg px-2 text-xs"
                          onClick={() => addAddonOption(group.id)}
                        >
                          <Plus className="mr-1 h-3 w-3" /> Add option
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="flex justify-end gap-2 border-t bg-background px-6 py-4">
            <Button variant="outline" className="rounded-xl" onClick={() => setModal(false)}>
              Cancel
            </Button>
            <Button className="rounded-xl" onClick={saveProduct}>
              Save Item
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
