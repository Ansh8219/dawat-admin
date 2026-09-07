import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  createMenuItem,
  deleteMenuItem,
  getMenuItem,
  listMenuItems,
  TAX_OPTIONS,
  updateMenuItem,
} from "@/lib/api/menu";
import type { MenuDietary, MenuItemDetail, MenuItemImage, MenuItemSummary, MenuUnit } from "@/lib/api/types";
import type { Panel } from "@/lib/panel";
import { ApiError } from "@/lib/api/types";
import { withAuthRetry } from "@/lib/api/with-auth";
import { useAuth } from "@/lib/auth";
import { inr } from "@/lib/mock/data";
import { usePanelMeta } from "@/lib/use-panel";
import {
  Plus,
  LayoutGrid,
  List,
  ImageIcon,
  Search,
  GripVertical,
  Trash2,
  X,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/menu")({
  component: MenuPage,
  head: () => ({ meta: [{ title: "Menu & Products — Daawat Baker's" }] }),
});

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
  dietary: MenuDietary;
  unit: MenuUnit;
  tax: (typeof TAX_OPTIONS)[number]["value"];
  packagingCharge: string;
  tags: string[];
  serves: string;
  variants: FormVariant[];
  addons: FormAddonGroup[];
};

const UNIT_OPTIONS: MenuUnit[] = ["plate", "pcs", "kg", "box", "cup", "glass", "portion"];

const SERVE_OPTIONS = [
  "Serves 1",
  "Serves 1–2",
  "Serves 2",
  "Serves 2–3",
  "Serves 3–4",
  "Serves 4+",
];

const VARIANT_NAME_OPTIONS = ["Half", "Full", "Regular", "Large", "Small", "Medium", "Quarter"];

const BAKERY_VARIANT_NAME_OPTIONS = ["Small", "Medium", "Large", "0.5 kg", "1 kg", "2 kg", "6 inch", "8 inch", "12 inch"];

const ADDON_GROUP_OPTIONS = [
  "Beverages",
  "Extra Toppings",
  "Sides",
  "Breads",
  "Dips & Sauces",
  "Add Cheese",
  "Make it a combo",
];

const BAKERY_ADDON_GROUP_OPTIONS = [
  "Extra Frosting",
  "Toppings",
  "Fillings",
  "Custom Message",
  "Packaging",
  "Add-ons",
  "Beverages",
];

const DEFAULT_CATEGORIES: Record<"restaurant" | "bakery" | "banquet", string[]> = {
  restaurant: ["Starters", "Main Course", "Breads", "Rice", "Chinese", "Beverages", "Desserts", "Soups"],
  bakery: ["Cakes", "Pastries", "Breads", "Confectionery", "Beverages", "Cookies"],
  banquet: ["Packages", "Catering", "Decor", "Beverages"],
};

type MenuFormCopy = {
  sheetTitle: string;
  sheetSubtitle: string;
  itemSectionTitle: string;
  nameLabel: string;
  namePlaceholder: string;
  descriptionPlaceholder: string;
  priceLabel: string;
  tags: readonly string[];
  variantHint: string;
  addonHint: string;
  variantNameOptions: readonly string[];
  addonGroupOptions: readonly string[];
  defaultUnit: MenuUnit;
  defaultServes: string;
};

const MENU_FORM_COPY: Record<"restaurant" | "bakery", MenuFormCopy> = {
  restaurant: {
    sheetTitle: "Add Menu Item",
    sheetSubtitle:
      "Add a dish for your restaurant — include dietary info, GST, portion variants, and add-ons for dine-in & delivery.",
    itemSectionTitle: "Dish details",
    nameLabel: "Name of the dish *",
    namePlaceholder: "e.g. Dal Makhni",
    descriptionPlaceholder: "Creamy and buttery Dal Makhani cooked with butter and cream",
    priceLabel: "Price of the dish (₹) *",
    tags: [
      "New",
      "Chef's Special",
      "Spicy",
      "Gluten Free",
      "Restaurant Recommended",
      "Seasonal",
      "Vegan",
      "Best Seller",
    ],
    variantHint: "e.g. Half / Full, Regular / Large",
    addonHint: "Optional extras like beverages, sides, or toppings",
    variantNameOptions: VARIANT_NAME_OPTIONS,
    addonGroupOptions: ADDON_GROUP_OPTIONS,
    defaultUnit: "plate",
    defaultServes: SERVE_OPTIONS[1],
  },
  bakery: {
    sheetTitle: "Add Bakery Product",
    sheetSubtitle:
      "Add a product for your bakery — include dietary info, GST, size variants, and add-ons for cakes, pastries & custom orders.",
    itemSectionTitle: "Product details",
    nameLabel: "Name of the product *",
    namePlaceholder: "e.g. Black Forest Cake",
    descriptionPlaceholder: "Rich chocolate sponge layered with whipped cream and cherries",
    priceLabel: "Price of the product (₹) *",
    tags: [
      "New",
      "Baker's Special",
      "Eggless",
      "Custom Order",
      "Best Seller",
      "Seasonal",
      "Gift Box",
      "Same-day Pickup",
    ],
    variantHint: "e.g. Small / Medium / Large, 0.5 kg / 1 kg, or cake sizes",
    addonHint: "Optional extras like frosting, toppings, custom message, or packaging",
    variantNameOptions: BAKERY_VARIANT_NAME_OPTIONS,
    addonGroupOptions: BAKERY_ADDON_GROUP_OPTIONS,
    defaultUnit: "pcs",
    defaultServes: "Serves 1",
  },
};

function getMenuFormCopy(panel: Panel): MenuFormCopy {
  return panel === "bakery" ? MENU_FORM_COPY.bakery : MENU_FORM_COPY.restaurant;
}

const CREATE_NEW = "__create_new__";

const uid = () => Math.random().toString(36).slice(2, 9);

const emptyForm = (copy: MenuFormCopy): ProductForm => ({
  name: "",
  cat: "",
  price: "",
  desc: "",
  dietary: "veg",
  unit: copy.defaultUnit,
  tax: TAX_OPTIONS[0].value,
  packagingCharge: "0",
  tags: [],
  serves: copy.defaultServes,
  variants: [],
  addons: [],
});

function dietaryOf(m: MenuItemSummary): MenuDietary {
  return m.dietary;
}

function dietaryMark(d: MenuDietary) {
  if (d === "veg") return { emoji: "🥗", label: "Veg", className: "border-emerald-500 bg-emerald-50 text-emerald-700" };
  if (d === "egg") return { emoji: "🥚", label: "Egg", className: "border-amber-500 bg-amber-50 text-amber-700" };
  return { emoji: "🍗", label: "Non-veg", className: "border-rose-500 bg-rose-50 text-rose-700" };
}

function itemPrice(m: MenuItemSummary): number {
  return typeof m.price === "number" ? m.price : Number(m.price) || 0;
}

function numToStr(value: number | string | undefined | null): string {
  if (value === undefined || value === null) return "0";
  return String(typeof value === "number" ? value : Number(value) || 0);
}

function detailToForm(detail: MenuItemDetail, copy: MenuFormCopy): ProductForm {
  return {
    name: detail.name,
    cat: detail.category,
    price: numToStr(detail.price),
    desc: detail.description ?? "",
    dietary: detail.dietary,
    unit: detail.unit,
    tax: detail.tax,
    packagingCharge: numToStr(detail.packaging_charge),
    tags: detail.tags ?? [],
    serves: detail.serves ?? copy.defaultServes,
    variants: (detail.variants ?? []).map((v) => ({
      id: uid(),
      name: v.name,
      price: numToStr(v.price),
    })),
    addons: (detail.addon_groups ?? []).map((g) => ({
      id: uid(),
      name: g.name,
      min: g.min ?? 0,
      max: g.max ?? 1,
      options: (g.options ?? []).map((o) => ({
        id: uid(),
        name: o.name,
        price: numToStr(o.price),
      })),
    })),
  };
}

function MenuPage() {
  const meta = usePanelMeta();
  const business = useAuth((s) => s.business);
  const navigate = useNavigate();
  const businessPublicId = business?.publicId ?? null;

  const [items, setItems] = useState<MenuItemSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [category, setCategory] = useState<string>("all");
  const [q, setQ] = useState("");
  const [avail, setAvail] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [existingImages, setExistingImages] = useState<MenuItemImage[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingAvail, setTogglingAvail] = useState<Set<string>>(new Set());
  const [form, setForm] = useState<ProductForm>(() => emptyForm(getMenuFormCopy("restaurant")));
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [customCategory, setCustomCategory] = useState(false);
  const [customServes, setCustomServes] = useState(false);
  const [customVariantIds, setCustomVariantIds] = useState<Set<string>>(new Set());
  const [customAddonIds, setCustomAddonIds] = useState<Set<string>>(new Set());

  const panel = business?.panel ?? "restaurant";
  const formCopy = useMemo(() => getMenuFormCopy(panel), [panel]);

  async function refreshMenuItems(options?: { showLoading?: boolean; resetFilters?: boolean }) {
    const showLoading = options?.showLoading ?? false;
    if (!businessPublicId) {
      if (showLoading) {
        setLoadError("No business selected. Please choose a business first.");
        setLoading(false);
      }
      return;
    }

    if (showLoading) {
      setLoading(true);
      setLoadError("");
    }

    try {
      const data = await withAuthRetry((token) => listMenuItems(token, businessPublicId));
      const nextItems = Array.isArray(data) ? data : [];
      setItems(nextItems);
      setAvail(Object.fromEntries(nextItems.map((m) => [m.public_id, m.is_available])));
      if (options?.resetFilters) {
        setSelected(new Set());
        setCategory("all");
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        useAuth.getState().logout();
        void navigate({ to: "/login" });
        return;
      }
      if (showLoading) {
        setLoadError(err instanceof ApiError ? err.message : "Unable to load menu items.");
      } else {
        toast.error(err instanceof ApiError ? err.message : "Unable to refresh menu items.");
      }
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  useEffect(() => {
    void refreshMenuItems({ showLoading: true, resetFilters: true });
  }, [businessPublicId, navigate]);

  const imagePreviewsRef = useRef<string[]>([]);
  imagePreviewsRef.current = imagePreviews;

  useEffect(() => {
    return () => {
      for (const url of imagePreviewsRef.current) URL.revokeObjectURL(url);
    };
  }, []);

  const categories = useMemo(() => {
    const fromItems = items.map((m) => m.category).filter(Boolean);
    const defaults = DEFAULT_CATEGORIES[panel] ?? [];
    return Array.from(new Set([...defaults, ...fromItems])).sort((a, b) => a.localeCompare(b));
  }, [items, panel]);

  const variantNameOptions = formCopy.variantNameOptions;

  const addonGroupOptions = formCopy.addonGroupOptions;

  const filtered = useMemo(
    () =>
      items.filter(
        (m) =>
          (category === "all" || m.category === category) &&
          m.name.toLowerCase().includes(q.toLowerCase()),
      ),
    [items, category, q],
  );

  async function reloadMenu() {
    await refreshMenuItems({ showLoading: true });
  }

  const toggleSel = (publicId: string) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(publicId) ? n.delete(publicId) : n.add(publicId);
      return n;
    });

  async function setBulkAvail(value: boolean) {
    if (!businessPublicId || selected.size === 0) return;
    const ids = Array.from(selected);
    setTogglingAvail(new Set(ids));
    try {
      await Promise.all(
        ids.map((id) =>
          withAuthRetry((token) =>
            updateMenuItem(token, id, { is_available: value }, businessPublicId),
          ),
        ),
      );
      setAvail((a) => {
        const next = { ...a };
        ids.forEach((id) => {
          next[id] = value;
        });
        return next;
      });
      setItems((prev) =>
        prev.map((m) => (ids.includes(m.public_id) ? { ...m, is_available: value } : m)),
      );
      toast.success(`${ids.length} items ${value ? "enabled" : "disabled"}`);
      setSelected(new Set());
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        useAuth.getState().logout();
        void navigate({ to: "/login" });
        return;
      }
      toast.error(err instanceof ApiError ? err.message : "Unable to update availability");
    } finally {
      setTogglingAvail(new Set());
    }
  }

  async function toggleItemAvailability(publicId: string, value: boolean) {
    if (!businessPublicId) return;
    setTogglingAvail((prev) => new Set(prev).add(publicId));
    const previous = avail[publicId];
    setAvail((a) => ({ ...a, [publicId]: value }));
    try {
      await withAuthRetry((token) =>
        updateMenuItem(token, publicId, { is_available: value }, businessPublicId),
      );
      setItems((prev) =>
        prev.map((m) => (m.public_id === publicId ? { ...m, is_available: value } : m)),
      );
    } catch (err) {
      setAvail((a) => ({ ...a, [publicId]: previous }));
      if (err instanceof ApiError && err.status === 401) {
        useAuth.getState().logout();
        void navigate({ to: "/login" });
        return;
      }
      toast.error(err instanceof ApiError ? err.message : "Unable to update availability");
    } finally {
      setTogglingAvail((prev) => {
        const next = new Set(prev);
        next.delete(publicId);
        return next;
      });
    }
  }

  function clearImages() {
    for (const url of imagePreviews) URL.revokeObjectURL(url);
    setImages([]);
    setImagePreviews([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function openAdd() {
    setEditingId(null);
    setExistingImages([]);
    setForm(emptyForm(formCopy));
    clearImages();
    setCustomCategory(false);
    setCustomServes(false);
    setCustomVariantIds(new Set());
    setCustomAddonIds(new Set());
    setModal(true);
  }

  async function openEdit(publicId: string) {
    if (!businessPublicId) {
      toast.error("No business selected");
      return;
    }
    setEditingId(publicId);
    setDetailLoading(true);
    setModal(true);
    clearImages();
    setCustomCategory(false);
    setCustomServes(false);
    setCustomVariantIds(new Set());
    setCustomAddonIds(new Set());
    try {
      const detail = await withAuthRetry((token) =>
        getMenuItem(token, publicId, businessPublicId),
      );
      setForm(detailToForm(detail, formCopy));
      setExistingImages(detail.images ?? []);
      if (detail.serves && !SERVE_OPTIONS.includes(detail.serves)) {
        setCustomServes(true);
      }
      const categoryNames = categories.length ? categories : DEFAULT_CATEGORIES[panel] ?? [];
      if (detail.category && !categoryNames.includes(detail.category)) {
        setCustomCategory(true);
      }
    } catch (err) {
      setModal(false);
      setEditingId(null);
      if (err instanceof ApiError && err.status === 401) {
        useAuth.getState().logout();
        void navigate({ to: "/login" });
        return;
      }
      toast.error(err instanceof ApiError ? err.message : "Unable to load menu item");
    } finally {
      setDetailLoading(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || !businessPublicId) return;
    setDeleting(true);
    try {
      await withAuthRetry((token) =>
        deleteMenuItem(token, deleteTarget.id, businessPublicId),
      );
      setItems((prev) => prev.filter((m) => m.public_id !== deleteTarget.id));
      setAvail((a) => {
        const next = { ...a };
        delete next[deleteTarget.id];
        return next;
      });
      setSelected((s) => {
        const next = new Set(s);
        next.delete(deleteTarget.id);
        return next;
      });
      toast.success(`${deleteTarget.name} deleted`);
      setDeleteTarget(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        useAuth.getState().logout();
        void navigate({ to: "/login" });
        return;
      }
      toast.error(err instanceof ApiError ? err.message : "Unable to delete menu item");
    } finally {
      setDeleting(false);
    }
  }

  function onImagesSelected(files: FileList | null) {
    if (!files?.length) return;
    const next = [...images, ...Array.from(files)].slice(0, 10);
    if (next.length > 10) {
      toast.error("You can upload up to 10 images");
    }
    for (const url of imagePreviews) URL.revokeObjectURL(url);
    setImages(next);
    setImagePreviews(next.map((f) => URL.createObjectURL(f)));
  }

  function removeImage(index: number) {
    URL.revokeObjectURL(imagePreviews[index]);
    setImages((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  }

  function onCategorySelect(value: string) {
    if (value === CREATE_NEW) {
      setCustomCategory(true);
      setForm((f) => ({ ...f, cat: "" }));
      return;
    }
    setCustomCategory(false);
    setForm((f) => ({ ...f, cat: value }));
  }

  function onServesSelect(value: string) {
    if (value === CREATE_NEW) {
      setCustomServes(true);
      setForm((f) => ({ ...f, serves: "" }));
      return;
    }
    setCustomServes(false);
    setForm((f) => ({ ...f, serves: value }));
  }

  function toggleTag(tag: string) {
    setForm((f) => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter((t) => t !== tag) : [...f.tags, tag],
    }));
  }

  function addVariant() {
    const id = uid();
    setForm((f) => ({
      ...f,
      variants: [...f.variants, { id, name: "", price: "" }],
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
    setCustomVariantIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function addAddonGroup() {
    const id = uid();
    setForm((f) => ({
      ...f,
      addons: [
        ...f.addons,
        {
          id,
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
    setCustomAddonIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
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

  async function saveProduct() {
    if (!businessPublicId) {
      toast.error("No business selected");
      return;
    }
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
    if (!editingId && images.length < 1) {
      toast.error("Add at least one dish photo (up to 10)");
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

    const updatePayload = {
      name: form.name.trim(),
      category: form.cat.trim(),
      price: Number(form.price) || 0,
      unit: form.unit,
      dietary: form.dietary,
      tax: form.tax,
      description: form.desc.trim() || undefined,
      serves: form.serves.trim() || undefined,
      packaging_charge: Number(form.packagingCharge) || 0,
      tags: form.tags,
      variants: form.variants.map((v) => ({
        name: v.name.trim(),
        price: Number(v.price) || 0,
      })),
      addon_groups: form.addons.map((g) => ({
        name: g.name.trim(),
        min: g.min,
        max: Math.max(g.max, g.min),
        options: g.options.map((o) => ({
          name: o.name.trim(),
          price: Number(o.price) || 0,
        })),
      })),
    };

    setSaving(true);
    try {
      if (editingId) {
        await withAuthRetry((token) =>
          updateMenuItem(token, editingId, updatePayload, businessPublicId),
        );
        toast.success(`${updatePayload.name} updated`);
      } else {
        await withAuthRetry((token) =>
          createMenuItem(
            token,
            { business_public_id: businessPublicId, ...updatePayload, is_available: true },
            images,
          ),
        );
        toast.success(`${updatePayload.name} added to ${meta.label} menu`);
      }
      await refreshMenuItems();
      setModal(false);
      setEditingId(null);
      setExistingImages([]);
      setForm(emptyForm(formCopy));
      clearImages();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        useAuth.getState().logout();
        void navigate({ to: "/login" });
        return;
      }
      toast.error(err instanceof ApiError ? err.message : "Unable to save menu item");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={`${meta.label} Menu`}
        crumbs={["Operations", "Menu"]}
        description={`Products for ${meta.label} only — GST ${meta.gst}. Loaded from the admin menu API.`}
        action={
          <Button className="rounded-xl gap-2" onClick={openAdd}>
            <Plus className="h-4 w-4" /> Add Item
          </Button>
        }
      />
      <div className="grid gap-4 p-4 lg:grid-cols-[220px_1fr] sm:p-6 lg:p-8">
        {loading ? (
          <div className="col-span-full flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm">Loading menu…</p>
          </div>
        ) : loadError ? (
          <div className="col-span-full flex flex-col items-center justify-center gap-4 py-24 text-center">
            <div className="max-w-md rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {loadError}
            </div>
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => void reloadMenu()}>
              Try again
            </Button>
          </div>
        ) : (
          <>
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
                  <span className="text-xs text-muted-foreground">{items.filter((m) => m.category === c).length}</span>
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
              {filtered.length === 0 ? (
                <p className="col-span-full rounded-xl border border-dashed px-4 py-12 text-center text-sm text-muted-foreground">
                  No menu items yet. Add your first dish to get started.
                </p>
              ) : (
              filtered.map((m) => {
                const diet = dietaryMark(dietaryOf(m));
                const thumb = m.thumbnail;
                return (
                  <div key={m.public_id} className={`card-elevated group relative overflow-hidden p-3 transition-all ${selected.has(m.public_id) ? "ring-2 ring-primary" : ""}`}>
                    <div className="absolute right-2 top-2 z-10">
                      <RowActions
                        items={[
                          { label: "Edit", onClick: () => void openEdit(m.public_id) },
                          {
                            label: avail[m.public_id] ? "Mark unavailable" : "Mark available",
                            onClick: () =>
                              void toggleItemAvailability(m.public_id, !avail[m.public_id]),
                          },
                          {
                            label: "Delete",
                            onClick: () => setDeleteTarget({ id: m.public_id, name: m.name }),
                            destructive: true,
                          },
                        ]}
                      />
                    </div>
                    <input type="checkbox" checked={selected.has(m.public_id)} onChange={() => toggleSel(m.public_id)} className="absolute left-4 top-4 z-10 h-4 w-4 accent-primary" />
                    <div className="mb-3 grid h-28 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-primary/10 to-gold/20 text-4xl">
                      {thumb ? (
                        <img src={thumb} alt={m.name} className="h-full w-full object-cover" />
                      ) : (
                        diet.emoji
                      )}
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-sm border ${diet.className.split(" ").slice(0, 1).join(" ")} ${dietaryOf(m) === "veg" ? "bg-emerald-500" : dietaryOf(m) === "egg" ? "bg-amber-500" : "bg-rose-500"}`} />
                          <div className="truncate text-sm font-semibold">{m.name}</div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {m.category}
                          {m.variant_count > 0 ? ` · ${m.variant_count} variants` : ""}
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
                      <div className="text-sm font-bold text-primary">{inr(itemPrice(m))}</div>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs capitalize text-muted-foreground">{m.menu_type}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs">{avail[m.public_id] ? "Available" : "Unavailable"}</span>
                        <Switch
                          checked={avail[m.public_id]}
                          disabled={togglingAvail.has(m.public_id)}
                          onCheckedChange={(v) => void toggleItemAvailability(m.public_id, v)}
                        />
                      </div>
                    </div>
                  </div>
                );
              })
              )}
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
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                        No menu items yet.
                      </td>
                    </tr>
                  ) : (
                  filtered.map((m) => {
                    const diet = dietaryMark(dietaryOf(m));
                    return (
                      <tr key={m.public_id} className="border-b hover:bg-muted/40">
                        <td className="px-4 py-3">
                          <input type="checkbox" checked={selected.has(m.public_id)} onChange={() => toggleSel(m.public_id)} className="accent-primary" />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 font-medium">
                            <span className={`inline-block h-2.5 w-2.5 rounded-sm ${dietaryOf(m) === "veg" ? "bg-emerald-500" : dietaryOf(m) === "egg" ? "bg-amber-500" : "bg-rose-500"}`} />
                            {m.name}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{m.category}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={`rounded-md ${diet.className}`}>
                            {diet.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">{inr(itemPrice(m))}</td>
                        <td className="px-4 py-3 text-right">
                          <Switch
                          checked={avail[m.public_id]}
                          disabled={togglingAvail.has(m.public_id)}
                          onCheckedChange={(v) => void toggleItemAvailability(m.public_id, v)}
                        />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <RowActions
                            items={[
                              { label: "Edit", onClick: () => void openEdit(m.public_id) },
                              {
                                label: "Delete",
                                onClick: () => setDeleteTarget({ id: m.public_id, name: m.name }),
                                destructive: true,
                              },
                            ]}
                          />
                        </td>
                      </tr>
                    );
                  })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
          </>
        )}
      </div>

      <Sheet
        open={modal}
        onOpenChange={(open) => {
          setModal(open);
          if (!open) {
            setEditingId(null);
            setExistingImages([]);
            setDetailLoading(false);
          }
        }}
      >
        <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
          <SheetHeader className="border-b px-6 py-4 text-left">
            <SheetTitle>
              {editingId
                ? panel === "bakery"
                  ? "Edit Bakery Product"
                  : "Edit Menu Item"
                : formCopy.sheetTitle}
            </SheetTitle>
            <p className="text-sm text-muted-foreground">
              {editingId
                ? "Update item details. Image changes require re-upload support (not available yet)."
                : formCopy.sheetSubtitle}
            </p>
          </SheetHeader>

          {detailLoading ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm">Loading item…</p>
            </div>
          ) : (
          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
            {/* Item details */}
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {formCopy.itemSectionTitle}
              </h3>
              <div>
                <Label>{formCopy.nameLabel}</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder={formCopy.namePlaceholder}
                  className="mt-1 rounded-xl"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Category *</Label>
                  {customCategory ? (
                    <div className="mt-1 flex gap-2">
                      <Input
                        value={form.cat}
                        onChange={(e) => setForm((f) => ({ ...f, cat: e.target.value }))}
                        placeholder="New category name"
                        className="rounded-xl"
                        autoFocus
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="shrink-0 rounded-xl"
                        onClick={() => {
                          setCustomCategory(false);
                          setForm((f) => ({ ...f, cat: categories[0] ?? "" }));
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Select value={form.cat} onValueChange={onCategorySelect}>
                      <SelectTrigger className="mt-1 rounded-xl">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                        <SelectItem value={CREATE_NEW}>+ Create new category</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div>
                  <Label>Serving info</Label>
                  {customServes ? (
                    <div className="mt-1 flex gap-2">
                      <Input
                        value={form.serves}
                        onChange={(e) => setForm((f) => ({ ...f, serves: e.target.value }))}
                        placeholder="e.g. Serves 1–2"
                        className="rounded-xl"
                        autoFocus
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="shrink-0 rounded-xl"
                        onClick={() => {
                          setCustomServes(false);
                          setForm((f) => ({ ...f, serves: formCopy.defaultServes }));
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Select value={form.serves} onValueChange={onServesSelect}>
                      <SelectTrigger className="mt-1 rounded-xl">
                        <SelectValue placeholder="Select serving size" />
                      </SelectTrigger>
                      <SelectContent>
                        {SERVE_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                        <SelectItem value={CREATE_NEW}>+ Custom serving info</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={form.desc}
                  onChange={(e) => setForm((f) => ({ ...f, desc: e.target.value }))}
                  placeholder={formCopy.descriptionPlaceholder}
                  className="mt-1 min-h-20 rounded-xl"
                />
              </div>
              <div>
                <Label>{editingId ? "Dish image" : "Dish image *"}</Label>
                {editingId && existingImages.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {existingImages.map((img) => (
                      <div key={img.public_id ?? img.url} className="relative h-16 w-16 overflow-hidden rounded-lg border">
                        <img src={img.url} alt="" className="h-full w-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}
                {!editingId && (
                  <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => onImagesSelected(e.target.files)}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-1 grid h-28 w-full place-items-center rounded-xl border-2 border-dashed border-border bg-muted/20 text-sm text-muted-foreground hover:bg-muted/40"
                >
                  <div className="text-center">
                    <ImageIcon className="mx-auto mb-1 h-5 w-5" />
                    Drag & drop or click to upload (1–10 photos)
                  </div>
                </button>
                {imagePreviews.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {imagePreviews.map((src, i) => (
                      <div key={src} className="relative h-16 w-16 overflow-hidden rounded-lg border">
                        <img src={src} alt="" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeImage(i)}
                          className="absolute right-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-white"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                  </>
                )}
              </div>
            </section>

            <Separator />

            {/* Dietary */}
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Dietary type *
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: "veg" as const, label: "Veg", mark: "border-emerald-600 bg-emerald-500" },
                    { id: "egg" as const, label: "Egg", mark: "border-amber-600 bg-amber-500" },
                    {
                      id: "non_veg" as const,
                      label: "Non-veg",
                      mark: "border-rose-600 bg-rose-500",
                    },
                  ] as const
                ).map((opt) => {
                  const active = form.dietary === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, dietary: opt.id }))}
                      className={`flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                        active
                          ? opt.id === "veg"
                            ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                            : opt.id === "egg"
                              ? "border-amber-500 bg-amber-50 text-amber-700"
                              : "border-rose-500 bg-rose-50 text-rose-700"
                          : "border-border text-muted-foreground hover:bg-muted/50"
                      }`}
                    >
                      <span className={`h-3 w-3 rounded-sm border-2 ${opt.mark}`} />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </section>

            <Separator />

            {/* Pricing */}
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pricing</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>{formCopy.priceLabel}</Label>
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
                  <Select value={form.unit} onValueChange={(v: MenuUnit) => setForm((f) => ({ ...f, unit: v }))}>
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
                  <Select value={form.tax} onValueChange={(v) => setForm((f) => ({ ...f, tax: v as ProductForm["tax"] }))}>
                    <SelectTrigger className="mt-1 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TAX_OPTIONS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
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
                {formCopy.tags.map((tag) => {
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
                  <p className="mt-0.5 text-xs text-muted-foreground">{formCopy.variantHint}</p>
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
                  {form.variants.map((v) => {
                    const isCustom = customVariantIds.has(v.id);
                    return (
                      <div key={v.id} className="flex items-center gap-2">
                        {isCustom ? (
                          <Input
                            value={v.name}
                            onChange={(e) => updateVariant(v.id, { name: e.target.value })}
                            placeholder="Custom variant"
                            className="rounded-xl"
                            autoFocus
                          />
                        ) : (
                          <Select
                            value={v.name}
                            onValueChange={(value) => {
                              if (value === CREATE_NEW) {
                                setCustomVariantIds((prev) => new Set(prev).add(v.id));
                                updateVariant(v.id, { name: "" });
                                return;
                              }
                              updateVariant(v.id, { name: value });
                            }}
                          >
                            <SelectTrigger className="rounded-xl">
                              <SelectValue placeholder="Select variant" />
                            </SelectTrigger>
                            <SelectContent>
                              {variantNameOptions.map((name) => (
                                <SelectItem key={name} value={name}>
                                  {name}
                                </SelectItem>
                              ))}
                              <SelectItem value={CREATE_NEW}>+ Custom name</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                        <Input
                          type="number"
                          min={0}
                          value={v.price}
                          onChange={(e) => updateVariant(v.id, { price: e.target.value })}
                          placeholder="₹"
                          className="w-28 shrink-0 rounded-xl"
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="shrink-0"
                          onClick={() => removeVariant(v.id)}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <Separator />

            {/* Add-ons */}
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Add-ons</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">{formCopy.addonHint}</p>
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
                          {customAddonIds.has(group.id) ? (
                            <div className="space-y-1">
                              <Input
                                value={group.name}
                                onChange={(e) => updateAddonGroup(group.id, { name: e.target.value })}
                                placeholder="Group name — e.g. Beverages"
                                className="rounded-xl bg-background"
                                autoFocus
                              />
                              <button
                                type="button"
                                className="text-xs text-primary hover:underline"
                                onClick={() => {
                                  setCustomAddonIds((prev) => {
                                    const next = new Set(prev);
                                    next.delete(group.id);
                                    return next;
                                  });
                                  updateAddonGroup(group.id, {
                                    name: addonGroupOptions[0] ?? "",
                                  });
                                }}
                              >
                                Pick from existing groups
                              </button>
                            </div>
                          ) : (
                            <Select
                              value={group.name}
                              onValueChange={(value) => {
                                if (value === CREATE_NEW) {
                                  setCustomAddonIds((prev) => new Set(prev).add(group.id));
                                  updateAddonGroup(group.id, { name: "" });
                                  return;
                                }
                                updateAddonGroup(group.id, { name: value });
                              }}
                            >
                              <SelectTrigger className="rounded-xl bg-background">
                                <SelectValue placeholder="Select add-on group" />
                              </SelectTrigger>
                              <SelectContent>
                                {addonGroupOptions.map((name) => (
                                  <SelectItem key={name} value={name}>
                                    {name}
                                  </SelectItem>
                                ))}
                                <SelectItem value={CREATE_NEW}>+ Create new group</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">Min select</Label>
                              <Input
                                type="number"
                                min={0}
                                value={group.min}
                                onChange={(e) =>
                                  updateAddonGroup(group.id, {
                                    min: Math.max(0, Number(e.target.value) || 0),
                                  })
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
                                  updateAddonGroup(group.id, {
                                    max: Math.max(0, Number(e.target.value) || 0),
                                  })
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
          )}

          {!detailLoading && (
          <div className="flex justify-end gap-2 border-t bg-background px-6 py-4">
            <Button variant="outline" className="rounded-xl" onClick={() => setModal(false)} disabled={saving}>
              Cancel
            </Button>
            <Button className="rounded-xl" onClick={() => void saveProduct()} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
                </>
              ) : editingId ? (
                "Save Changes"
              ) : (
                "Save Item"
              )}
            </Button>
          </div>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete menu item?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `"${deleteTarget.name}" will be permanently removed from your menu. This cannot be undone.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
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
