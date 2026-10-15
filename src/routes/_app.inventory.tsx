import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createInventoryItem,
  listInventoryCategories,
  listInventoryItems,
  updateInventoryItemStock,
} from "@/lib/api/inventory";
import { ApiError, type InventoryCategory, type InventoryItemDetail } from "@/lib/api/types";
import { withAuthRetry } from "@/lib/api/with-auth";
import { useAuth } from "@/lib/auth";
import { inr } from "@/lib/mock/data";
import {
  type InventoryItem,
  type InventoryStockEntry,
  type InventoryStore,
  type InventoryUnit,
} from "@/lib/mock/data";
import { usePanel, usePanelMeta } from "@/lib/use-panel";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Boxes,
  CircleDot,
  Loader2,
  Package,
  PackagePlus,
  PackageX,
  Pencil,
  Plus,
  Search,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/inventory")({
  component: InventoryPage,
  head: () => ({ meta: [{ title: "Inventory — Daawat Baker's" }] }),
});

const UNITS: InventoryUnit[] = ["kg", "gram", "litre", "pcs"];

type InventoryTab = "all" | "low" | "out" | "stock";

type ItemForm = {
  name: string;
  sku: string;
  category_public_id: string;
  unit: InventoryUnit;
  reorder_level: string;
  is_active: boolean;
};

type StockForm = {
  item_id: string;
  quantity: string;
  cost_per_unit: string;
  date: string;
  notes: string;
};

type StockSummary = {
  item: InventoryItem;
  available: number;
  avg_cost: number;
  entries: number;
  total_value: number;
};

type StockStatus = "In Stock" | "Low" | "Out";

const TABS: { id: InventoryTab; label: string; short: string }[] = [
  { id: "all", label: "All Items", short: "All" },
  { id: "low", label: "Low Stock", short: "Low" },
  { id: "out", label: "Out of Stock", short: "Out" },
  { id: "stock", label: "Stock Log", short: "Stock" },
];

function emptyItemForm(categoryPublicId = ""): ItemForm {
  return {
    name: "",
    sku: "",
    category_public_id: categoryPublicId,
    unit: "kg",
    reorder_level: "0",
    is_active: true,
  };
}

function mapApiItemToLocal(
  item: InventoryItemDetail,
  store: InventoryStore,
  categories: InventoryCategory[] = [],
): InventoryItem {
  const categoryName =
    item.category_name?.trim() ||
    item.category?.trim() ||
    categories.find((c) => c.public_id === item.category_public_id)?.name ||
    "—";
  return {
    id: item.public_id,
    name: item.name,
    category: categoryName,
    category_public_id: item.category_public_id,
    sku: item.sku,
    unit: item.unit,
    reorder_level: item.reorder_level ?? 0,
    store,
    status: item.is_active === false ? "Inactive" : "Active",
    available: item.available ?? 0,
  };
}

function emptyStockForm(): StockForm {
  return {
    item_id: "",
    quantity: "",
    cost_per_unit: "",
    date: new Date().toISOString().slice(0, 10),
    notes: "",
  };
}

function stockStatusOf(available: number, reorder: number): StockStatus {
  if (available <= 0) return "Out";
  if (available <= reorder) return "Low";
  return "In Stock";
}

function weightedAvgCost(entries: InventoryStockEntry[]) {
  const totalQty = entries.reduce((s, e) => s + e.quantity, 0);
  if (totalQty <= 0) return 0;
  const totalValue = entries.reduce((s, e) => s + e.quantity * e.cost_per_unit, 0);
  return totalValue / totalQty;
}

function InventoryPage() {
  const navigate = useNavigate();
  const panel = usePanel();
  const meta = usePanelMeta();
  const business = useAuth((s) => s.business);
  const businessPublicId = business?.publicId ?? null;
  const defaultStore: InventoryStore = panel === "bakery" ? "bakery" : "restaurant";

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [stock, setStock] = useState<InventoryStockEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [tab, setTab] = useState<InventoryTab>("all");
  const [search, setSearch] = useState("");

  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState("");

  const [itemSheetOpen, setItemSheetOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [itemForm, setItemForm] = useState<ItemForm>(() => emptyItemForm());
  const [savingItem, setSavingItem] = useState(false);

  const [stockSheetOpen, setStockSheetOpen] = useState(false);
  const [stockForm, setStockForm] = useState<StockForm>(emptyStockForm);
  const [stockItemLocked, setStockItemLocked] = useState(false);
  const [savingStock, setSavingStock] = useState(false);

  const [logItem, setLogItem] = useState<InventoryItem | null>(null);

  const handleAuthError = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.status === 401) {
        useAuth.getState().logout();
        void navigate({ to: "/login" });
        return true;
      }
      return false;
    },
    [navigate],
  );

  const loadCategories = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;
      if (!silent) {
        setCategoriesLoading(true);
        setCategoriesError("");
      }
      try {
        const data = await withAuthRetry((token) =>
          listInventoryCategories(token, { is_active: true }),
        );
        const results = [...(data.results ?? [])].sort(
          (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name),
        );
        setCategories(results);
        setItemForm((prev) =>
          prev.category_public_id
            ? prev
            : { ...prev, category_public_id: results[0]?.public_id ?? "" },
        );
      } catch (err) {
        if (handleAuthError(err)) return;
        const message =
          err instanceof ApiError ? err.message : "Unable to load inventory categories.";
        setCategoriesError(message);
        if (!silent) toast.error(message);
      } finally {
        if (!silent) setCategoriesLoading(false);
      }
    },
    [handleAuthError],
  );

  const loadItems = useCallback(
    async (options?: { showLoading?: boolean }) => {
      const showLoading = options?.showLoading ?? false;
      if (!businessPublicId) {
        if (showLoading) {
          setLoadError("No business selected. Please choose a business first.");
          setLoading(false);
          setItems([]);
        }
        return;
      }
      if (showLoading) {
        setLoading(true);
        setLoadError("");
      }
      try {
        const data = await withAuthRetry((token) =>
          listInventoryItems(token, { business_public_id: businessPublicId }),
        );
        setItems((data.results ?? []).map((row) => mapApiItemToLocal(row, defaultStore)));
      } catch (err) {
        if (handleAuthError(err)) return;
        const message = err instanceof ApiError ? err.message : "Unable to load inventory items.";
        if (showLoading) setLoadError(message);
        else toast.error(message);
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [businessPublicId, defaultStore, handleAuthError],
  );

  useEffect(() => {
    if (panel === "banquet") return;
    void loadCategories();
  }, [panel, loadCategories]);

  useEffect(() => {
    if (panel === "banquet") {
      setItems([]);
      setLoading(false);
      return;
    }
    void loadItems({ showLoading: true });
  }, [panel, loadItems]);

  const panelItems = useMemo(() => {
    if (panel === "banquet") return [];
    return items;
  }, [items, panel]);

  const panelItemIds = useMemo(() => new Set(panelItems.map((i) => i.id)), [panelItems]);

  const panelStock = useMemo(
    () => stock.filter((s) => panelItemIds.has(s.item_id)),
    [stock, panelItemIds],
  );

  const availableByItem = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of panelItems) {
      map.set(item.id, item.available ?? 0);
    }
    return map;
  }, [panelItems]);

  const stockSummaries = useMemo((): StockSummary[] => {
    return panelItems
      .map((item) => {
        const available = item.available ?? 0;
        const entries = panelStock.filter((s) => s.item_id === item.id);
        if (available <= 0 && entries.length === 0) return null;
        const total_value = entries.reduce((s, e) => s + e.quantity * e.cost_per_unit, 0);
        return {
          item,
          available,
          avg_cost: weightedAvgCost(entries),
          entries: entries.length,
          total_value,
        };
      })
      .filter((row): row is StockSummary => row !== null);
  }, [panelItems, panelStock]);

  const itemsWithStatus = useMemo(
    () =>
      panelItems.map((item) => ({
        item,
        available: availableByItem.get(item.id) ?? 0,
        status: stockStatusOf(availableByItem.get(item.id) ?? 0, item.reorder_level),
      })),
    [panelItems, availableByItem],
  );

  const tabCounts = useMemo(
    () => ({
      all: itemsWithStatus.length,
      low: itemsWithStatus.filter((row) => row.status === "Low").length,
      out: itemsWithStatus.filter((row) => row.status === "Out").length,
      stock: stockSummaries.length,
    }),
    [itemsWithStatus, stockSummaries],
  );

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = itemsWithStatus;
    if (tab === "low") list = list.filter((row) => row.status === "Low");
    if (tab === "out") list = list.filter((row) => row.status === "Out");
    if (q) {
      list = list.filter(
        (row) =>
          row.item.name.toLowerCase().includes(q) ||
          row.item.category.toLowerCase().includes(q) ||
          row.item.unit.toLowerCase().includes(q) ||
          (row.item.sku ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [itemsWithStatus, tab, search]);

  const filteredSummaries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return stockSummaries;
    return stockSummaries.filter(
      (row) =>
        row.item.name.toLowerCase().includes(q) ||
        row.item.category.toLowerCase().includes(q),
    );
  }, [stockSummaries, search]);

  const itemLogs = useMemo(() => {
    if (!logItem) return [];
    return panelStock
      .filter((s) => s.item_id === logItem.id)
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [logItem, panelStock]);

  const lowCount = tabCounts.low + tabCounts.out;
  const stockValue = panelStock.reduce((s, row) => s + row.quantity * row.cost_per_unit, 0);

  function openCreateItem() {
    setEditingItem(null);
    setItemForm(emptyItemForm(categories[0]?.public_id ?? ""));
    setItemSheetOpen(true);
    if (categories.length === 0 && !categoriesLoading) {
      void loadCategories();
    }
  }

  function openEditItem(item: InventoryItem) {
    setEditingItem(item);
    setItemForm({
      name: item.name,
      sku: item.sku ?? "",
      category_public_id: item.category_public_id ?? "",
      unit: item.unit,
      reorder_level: String(item.reorder_level),
      is_active: item.status === "Active",
    });
    setItemSheetOpen(true);
  }

  async function saveItem() {
    const name = itemForm.name.trim();
    const sku = itemForm.sku.trim();
    if (!name) {
      toast.error("Name is required");
      return;
    }
    const reorder_level =
      itemForm.reorder_level.trim() === "" ? 0 : Number(itemForm.reorder_level);
    if (Number.isNaN(reorder_level) || reorder_level < 0) {
      toast.error("Reorder level must be a valid number");
      return;
    }

    // Edit stays local until PATCH item API is available.
    if (editingItem) {
      const categoryName =
        categories.find((c) => c.public_id === itemForm.category_public_id)?.name ||
        editingItem.category;
      setItems((prev) =>
        prev.map((i) =>
          i.id === editingItem.id
            ? {
                ...i,
                name,
                sku: sku || i.sku,
                category: categoryName,
                category_public_id: itemForm.category_public_id || i.category_public_id,
                unit: itemForm.unit,
                reorder_level,
                status: itemForm.is_active ? "Active" : "Inactive",
              }
            : i,
        ),
      );
      setStock((prev) =>
        prev.map((s) =>
          s.item_id === editingItem.id ? { ...s, item_name: name } : s,
        ),
      );
      toast.success("Item updated locally (PATCH API pending)");
      setItemSheetOpen(false);
      return;
    }

    if (!businessPublicId) {
      toast.error("No business selected. Please choose a business first.");
      return;
    }
    if (!sku) {
      toast.error("SKU is required");
      return;
    }
    if (!itemForm.category_public_id) {
      toast.error("Select a category");
      return;
    }

    setSavingItem(true);
    try {
      const created = await withAuthRetry((token) =>
        createInventoryItem(token, {
          business_public_id: businessPublicId,
          category_public_id: itemForm.category_public_id,
          sku,
          name,
          unit: itemForm.unit,
          reorder_level,
          is_active: itemForm.is_active,
        }),
      );
      setItems((prev) => {
        const mapped = mapApiItemToLocal(created, defaultStore, categories);
        return [mapped, ...prev.filter((i) => i.id !== mapped.id)];
      });
      toast.success(`${name} added to inventory`);
      setItemSheetOpen(false);
      void loadItems();
    } catch (err) {
      if (handleAuthError(err)) return;
      toast.error(err instanceof ApiError ? err.message : "Unable to add item");
    } finally {
      setSavingItem(false);
    }
  }

  function openAddStock(preselectItemId?: string) {
    const locked = Boolean(preselectItemId);
    setStockItemLocked(locked);
    setStockForm({
      ...emptyStockForm(),
      item_id: preselectItemId ?? panelItems.find((i) => i.status === "Active")?.id ?? "",
    });
    setStockSheetOpen(true);
  }

  async function saveStock() {
    const item = items.find((i) => i.id === stockForm.item_id);
    if (!item) {
      toast.error("Select an item");
      return;
    }
    if (item.status !== "Active") {
      toast.error("Cannot update stock for an inactive item");
      return;
    }
    const quantity = Number(stockForm.quantity);
    if (Number.isNaN(quantity) || quantity < 0) {
      toast.error("Quantity must be 0 or greater");
      return;
    }

    const costRaw = stockForm.cost_per_unit.trim();
    let cost_per_unit: number | undefined;
    if (costRaw !== "") {
      cost_per_unit = Number(costRaw);
      if (Number.isNaN(cost_per_unit) || cost_per_unit < 0) {
        toast.error("Cost per unit must be a valid number");
        return;
      }
    }

    const stock_date = stockForm.date.trim() || undefined;
    const notes = stockForm.notes.trim() || undefined;

    setSavingStock(true);
    try {
      const updated = await withAuthRetry((token) =>
        updateInventoryItemStock(token, item.id, {
          quantity,
          ...(cost_per_unit !== undefined ? { cost_per_unit } : {}),
          ...(stock_date ? { stock_date } : {}),
          ...(notes ? { notes } : {}),
        }),
      );

      if (updated?.public_id) {
        setItems((prev) =>
          prev.map((row) =>
            row.id === item.id ? mapApiItemToLocal(updated, defaultStore, categories) : row,
          ),
        );
      }

      const entry: InventoryStockEntry = {
        id: `STK-${String(stock.length + 1).padStart(3, "0")}`,
        item_id: item.id,
        item_name: item.name,
        quantity,
        cost_per_unit: cost_per_unit ?? 0,
        date: stock_date ?? new Date().toISOString().slice(0, 10),
        notes: notes ?? "",
      };
      setStock((prev) => [entry, ...prev]);

      toast.success(`Stock updated for ${item.name}`);
      setStockSheetOpen(false);
      void loadItems();
    } catch (err) {
      if (handleAuthError(err)) return;
      toast.error(err instanceof ApiError ? err.message : "Unable to update stock");
    } finally {
      setSavingStock(false);
    }
  }

  const lockedStockItem = stockItemLocked
    ? panelItems.find((i) => i.id === stockForm.item_id) ?? null
    : null;

  if (panel === "banquet") {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-2 bg-muted/20 p-8 text-center">
        <Boxes className="h-10 w-10 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Inventory not available</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Switch to restaurant or bakery panel to manage live stock.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Inventory</h1>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-success">
                <CircleDot className="h-3 w-3 animate-pulse" />
                Live
              </span>
              {lowCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-bold text-warning">
                  <AlertTriangle className="h-3 w-3" />
                  {lowCount} need restock
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {meta.label} · item catalog & stock levels
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="rounded-xl gap-2"
              onClick={() => openAddStock()}
            >
              <PackagePlus className="h-4 w-4" />
              Update Stock
            </Button>
            <Button className="rounded-xl gap-2" onClick={openCreateItem}>
              <Plus className="h-4 w-4" />
              Add Item
            </Button>
          </div>
        </div>

        <div className="flex items-end gap-1 overflow-x-auto px-4 sm:px-6 lg:px-8">
          {TABS.map((item) => {
            const active = tab === item.id;
            const tabCount = tabCounts[item.id];
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cn(
                  "relative flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors",
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                  (item.id === "low" || item.id === "out") &&
                    tabCount > 0 &&
                    !active &&
                    "text-warning",
                )}
              >
                {item.id === "low" && tabCount > 0 && (
                  <AlertTriangle className="h-3.5 w-3.5" />
                )}
                {item.id === "out" && tabCount > 0 && <PackageX className="h-3.5 w-3.5" />}
                {item.id === "all" && <Boxes className="h-3.5 w-3.5" />}
                {item.id === "stock" && <Package className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{item.label}</span>
                <span className="sm:hidden">{item.short}</span>
                <span
                  className={cn(
                    "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-bold",
                    active
                      ? "bg-primary text-primary-foreground"
                      : (item.id === "low" || item.id === "out") && tabCount > 0
                        ? "bg-warning text-warning-foreground"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {tabCount}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="grid flex-1 grid-cols-2 gap-2 lg:grid-cols-4">
            <MiniStat icon={Boxes} label="Items" value={String(panelItems.length)} tone="brand" />
            <MiniStat icon={PackageX} label="Low / Out" value={String(lowCount)} tone="warning" />
            <MiniStat icon={Package} label="Value" value={inr(stockValue)} tone="gold" />
            <MiniStat
              icon={PackagePlus}
              label="In stock"
              value={String(stockSummaries.length)}
              tone="info"
            />
          </div>
          <div className="relative w-full sm:max-w-[220px]">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={tab === "stock" ? "Search stock…" : "Search items…"}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 rounded-xl border-border/80 bg-card pl-8 text-sm"
            />
          </div>
        </div>

        {(tab === "low" || tab === "out") && tabCounts[tab] > 0 && (
          <div className="flex items-center gap-2.5 rounded-xl border border-warning/30 bg-warning/8 px-3 py-2 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
            <div className="min-w-0 flex-1 text-xs">
              <span className="font-semibold text-foreground">
                {tabCounts[tab]} {tab === "low" ? "low" : "out"}
              </span>
              <span className="text-muted-foreground"> — restock to keep kitchen running</span>
            </div>
            <Button size="sm" className="h-7 rounded-lg gap-1 px-2.5 text-xs" onClick={() => openAddStock()}>
              <PackagePlus className="h-3 w-3" />
              Restock
            </Button>
          </div>
        )}

        {loading ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm">Loading inventory…</p>
          </div>
        ) : loadError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-24 text-center">
            <div className="max-w-md rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {loadError}
            </div>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => void loadItems({ showLoading: true })}
            >
              Try again
            </Button>
          </div>
        ) : tab === "stock" ? (
          filteredSummaries.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No stock yet"
              description="Add stock for an item to see available quantity and purchase log."
              actionLabel="Update Stock"
              onAction={() => openAddStock()}
            />
          ) : (
            <div className="overflow-hidden rounded-xl border bg-card shadow-soft">
              {filteredSummaries.map((row, index) => (
                <StockRow
                  key={row.item.id}
                  summary={row}
                  status={stockStatusOf(row.available, row.item.reorder_level)}
                  isLast={index === filteredSummaries.length - 1}
                  onOpen={() => setLogItem(row.item)}
                  onAddStock={() => openAddStock(row.item.id)}
                />
              ))}
            </div>
          )
        ) : filteredItems.length === 0 ? (
          <EmptyState
            icon={Boxes}
            title={
              tab === "all"
                ? "No items yet"
                : tab === "low"
                  ? "No low stock items"
                  : "Nothing out of stock"
            }
            description={
              tab === "all"
                ? "Add your first inventory item, then update stock quantities."
                : "Stock looks healthy for this filter."
            }
            actionLabel={tab === "all" ? "Add Item" : undefined}
            onAction={tab === "all" ? openCreateItem : undefined}
          />
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card shadow-soft">
            {filteredItems.map(({ item, available, status }, index) => (
              <ItemRow
                key={item.id}
                item={item}
                available={available}
                status={status}
                isLast={index === filteredItems.length - 1}
                onEdit={() => openEditItem(item)}
                onAddStock={() => openAddStock(item.id)}
                onOpenLog={() => setLogItem(item)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Item */}
      <Sheet
        open={itemSheetOpen}
        onOpenChange={(open) => {
          if (savingItem) return;
          setItemSheetOpen(open);
        }}
      >
        <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
          <SheetHeader className="border-b px-6 py-4 text-left">
            <SheetTitle>{editingItem ? "Edit Item" : "Add Item"}</SheetTitle>
            <p className="text-sm text-muted-foreground">
              {editingItem
                ? "Local edit for now — PATCH API pending."
                : "Catalog only — quantity is updated via stock entries."}
            </p>
          </SheetHeader>
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
            <div className="space-y-1.5">
              <Label htmlFor="inv-name">Name</Label>
              <Input
                id="inv-name"
                className="rounded-xl"
                value={itemForm.name}
                onChange={(e) => setItemForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Atta"
                disabled={savingItem}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-sku">SKU</Label>
              <Input
                id="inv-sku"
                className="rounded-xl font-mono"
                value={itemForm.sku}
                onChange={(e) => setItemForm((f) => ({ ...f, sku: e.target.value.toUpperCase() }))}
                placeholder="e.g. ATT-001"
                disabled={savingItem || !!editingItem}
              />
              <p className="text-[11px] text-muted-foreground">Unique per business</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select
                  value={itemForm.category_public_id || undefined}
                  onValueChange={(v) => setItemForm((f) => ({ ...f, category_public_id: v }))}
                  disabled={savingItem || categoriesLoading}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue
                      placeholder={categoriesLoading ? "Loading…" : "Select category"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.public_id} value={c.public_id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {categoriesError ? (
                  <button
                    type="button"
                    className="text-[11px] font-medium text-destructive hover:underline"
                    onClick={() => void loadCategories()}
                  >
                    Retry categories
                  </button>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label>Unit</Label>
                <Select
                  value={itemForm.unit}
                  onValueChange={(v) => setItemForm((f) => ({ ...f, unit: v as InventoryUnit }))}
                  disabled={savingItem}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-reorder">Reorder Level</Label>
              <Input
                id="inv-reorder"
                type="number"
                min={0}
                className="rounded-xl"
                value={itemForm.reorder_level}
                onChange={(e) => setItemForm((f) => ({ ...f, reorder_level: e.target.value }))}
                placeholder="Default 0"
                disabled={savingItem}
              />
            </div>
            <div className="flex items-center justify-between rounded-xl border px-3 py-2.5">
              <div>
                <div className="text-sm font-medium">Active</div>
                <div className="text-[11px] text-muted-foreground">Inactive items can’t take stock</div>
              </div>
              <Switch
                checked={itemForm.is_active}
                onCheckedChange={(checked) =>
                  setItemForm((f) => ({ ...f, is_active: checked }))
                }
                disabled={savingItem}
              />
            </div>
            {editingItem && (
              <div className="rounded-xl border bg-muted/30 px-3 py-2 text-sm">
                <div className="text-xs text-muted-foreground">Available (from stock)</div>
                <div className="font-semibold">
                  {availableByItem.get(editingItem.id) ?? 0} {editingItem.unit}
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center justify-end gap-2 border-t px-6 py-4">
            <Button
              variant="outline"
              className="rounded-xl"
              disabled={savingItem}
              onClick={() => setItemSheetOpen(false)}
            >
              Cancel
            </Button>
            <Button className="rounded-xl gap-2" disabled={savingItem} onClick={() => void saveItem()}>
              {savingItem ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {savingItem
                ? "Saving…"
                : editingItem
                  ? "Save Changes"
                  : "Add Item"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Add / Update Stock */}
      <Sheet
        open={stockSheetOpen}
        onOpenChange={(open) => {
          if (savingStock) return;
          setStockSheetOpen(open);
          if (!open) setStockItemLocked(false);
        }}
      >
        <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
          <SheetHeader className="border-b px-6 py-4 text-left">
            <SheetTitle>Update Stock</SheetTitle>
            <p className="text-sm text-muted-foreground">
              {stockItemLocked
                ? "Updating stock for the selected item."
                : "Set quantity via stock API. Available refreshes after save."}
            </p>
          </SheetHeader>
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
            <div className="space-y-1.5">
              <Label>Item</Label>
              {stockItemLocked ? (
                <div className="rounded-xl border bg-muted/40 px-3 py-2.5">
                  <div className="text-sm font-semibold">
                    {lockedStockItem?.name ?? "Selected item"}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {lockedStockItem
                      ? `${lockedStockItem.sku ? `${lockedStockItem.sku} · ` : ""}${availableByItem.get(lockedStockItem.id) ?? 0} ${lockedStockItem.unit} available`
                      : "Item locked for this update"}
                  </div>
                </div>
              ) : (
                <Select
                  value={stockForm.item_id}
                  onValueChange={(v) => setStockForm((f) => ({ ...f, item_id: v }))}
                  disabled={savingStock}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Select item" />
                  </SelectTrigger>
                  <SelectContent>
                    {panelItems
                      .filter((i) => i.status === "Active")
                      .map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.name} ({i.unit}) · {availableByItem.get(i.id) ?? 0} left
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="stk-qty">Quantity</Label>
                <Input
                  id="stk-qty"
                  type="number"
                  min={0}
                  className="rounded-xl"
                  value={stockForm.quantity}
                  onChange={(e) => setStockForm((f) => ({ ...f, quantity: e.target.value }))}
                  placeholder="e.g. 45"
                  disabled={savingStock}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="stk-cost">Cost / Unit (₹)</Label>
                <Input
                  id="stk-cost"
                  type="number"
                  min={0}
                  className="rounded-xl"
                  value={stockForm.cost_per_unit}
                  onChange={(e) => setStockForm((f) => ({ ...f, cost_per_unit: e.target.value }))}
                  placeholder="Optional"
                  disabled={savingStock}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="stk-date">Stock date</Label>
              <Input
                id="stk-date"
                type="date"
                className="rounded-xl"
                value={stockForm.date}
                onChange={(e) => setStockForm((f) => ({ ...f, date: e.target.value }))}
                disabled={savingStock}
              />
              <p className="text-[11px] text-muted-foreground">Defaults to today if empty</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="stk-notes">Notes (optional)</Label>
              <Textarea
                id="stk-notes"
                className="rounded-xl"
                rows={3}
                value={stockForm.notes}
                onChange={(e) => setStockForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="e.g. weekly restock"
                disabled={savingStock}
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 border-t px-6 py-4">
            <Button
              variant="outline"
              className="rounded-xl"
              disabled={savingStock}
              onClick={() => setStockSheetOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="rounded-xl gap-2"
              disabled={savingStock}
              onClick={() => void saveStock()}
            >
              {savingStock ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {savingStock ? "Updating…" : "Update Stock"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Stock purchase log */}
      <Sheet open={!!logItem} onOpenChange={(open) => !open && setLogItem(null)}>
        <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
          <SheetHeader className="border-b px-6 py-4 text-left">
            <SheetTitle>{logItem?.name ?? "Stock log"}</SheetTitle>
            {logItem && (
              <p className="text-sm text-muted-foreground">
                Available {availableByItem.get(logItem.id) ?? 0} {logItem.unit} · Avg{" "}
                {inr(weightedAvgCost(itemLogs))}
              </p>
            )}
          </SheetHeader>
          <div className="flex-1 space-y-3 overflow-y-auto px-6 py-5">
            {itemLogs.map((s) => (
              <div key={s.id} className="rounded-xl border p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">
                      +{s.quantity} {logItem?.unit}
                    </div>
                    <div className="text-xs text-muted-foreground">{s.date}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{inr(s.cost_per_unit)}/unit</div>
                    <div className="text-xs text-muted-foreground">
                      {inr(s.quantity * s.cost_per_unit)}
                    </div>
                  </div>
                </div>
                {s.notes ? (
                  <p className="mt-2 text-xs text-muted-foreground">{s.notes}</p>
                ) : null}
              </div>
            ))}
            {itemLogs.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">No stock entries yet</p>
            )}
          </div>
          <div className="flex items-center justify-end gap-2 border-t px-6 py-4">
            <Button variant="outline" className="rounded-xl" onClick={() => setLogItem(null)}>
              Close
            </Button>
            {logItem && (
              <Button
                className="rounded-xl gap-2"
                onClick={() => {
                  const id = logItem.id;
                  setLogItem(null);
                  openAddStock(id);
                }}
              >
                <Plus className="h-4 w-4" /> Update Stock
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function stockFillPct(available: number, reorder: number) {
  if (available <= 0) return 0;
  // Healthy = ~2× reorder; bar caps at 100%
  const target = Math.max(reorder * 2, reorder + 1, 1);
  return Math.min(100, Math.round((available / target) * 100));
}

function ItemRow({
  item,
  available,
  status,
  isLast,
  onEdit,
  onAddStock,
  onOpenLog,
}: {
  item: InventoryItem;
  available: number;
  status: StockStatus;
  isLast: boolean;
  onEdit: () => void;
  onAddStock: () => void;
  onOpenLog: () => void;
}) {
  const fill = stockFillPct(available, item.reorder_level);
  const barTone =
    status === "Out" ? "bg-destructive" : status === "Low" ? "bg-warning" : "bg-success";

  return (
    <div
      className={cn(
        "group flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/40 sm:gap-4 sm:px-4",
        !isLast && "border-b border-border/70",
        status === "Out" && "bg-destructive/[0.03]",
        status === "Low" && "bg-warning/[0.03]",
      )}
    >
      <button
        type="button"
        onClick={onOpenLog}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <span
          className={cn(
            "hidden h-8 w-1 shrink-0 rounded-full sm:block",
            barTone,
          )}
          aria-hidden
        />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-sm font-semibold tracking-tight">{item.name}</span>
            <StatusPill status={status} />
            {item.sku ? (
              <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                {item.sku}
              </span>
            ) : null}
            <span className="hidden text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:inline">
              {item.category}
            </span>
          </div>
          <div className="flex max-w-xs items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div className={cn("h-full rounded-full transition-all", barTone)} style={{ width: `${fill}%` }} />
            </div>
            <span className="shrink-0 text-[10px] text-muted-foreground">
              reorder {item.reorder_level}
            </span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono text-base font-bold tabular-nums leading-none sm:text-lg">
            {available}
          </div>
          <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            {item.unit}
          </div>
        </div>
      </button>

      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={onEdit}
          title="Edit item"
          className="grid h-8 w-8 place-items-center rounded-lg border border-border/80 bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onAddStock}
          disabled={item.status !== "Active"}
          title="Update stock"
          className="inline-flex h-8 items-center gap-1 rounded-lg bg-primary px-2.5 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 sm:px-3"
        >
          <PackagePlus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Stock</span>
        </button>
      </div>
    </div>
  );
}

function StockRow({
  summary,
  status,
  isLast,
  onOpen,
  onAddStock,
}: {
  summary: StockSummary;
  status: StockStatus;
  isLast: boolean;
  onOpen: () => void;
  onAddStock: () => void;
}) {
  const { item, available, avg_cost, entries, total_value } = summary;

  return (
    <div
      className={cn(
        "group flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/40 sm:gap-4 sm:px-4",
        !isLast && "border-b border-border/70",
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-sm font-semibold tracking-tight">{item.name}</span>
            <StatusPill status={status} />
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            {entries} {entries === 1 ? "entry" : "entries"} · avg {inr(avg_cost)}/{item.unit}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono text-base font-bold tabular-nums leading-none sm:text-lg">
            {available}
            <span className="ml-1 text-[10px] font-normal uppercase text-muted-foreground">
              {item.unit}
            </span>
          </div>
          <div className="mt-0.5 text-[11px] font-medium text-muted-foreground">
            {inr(total_value)}
          </div>
        </div>
      </button>

      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={onOpen}
          className="hidden h-8 rounded-lg border border-border/80 bg-background px-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:inline-flex sm:items-center"
        >
          Log
        </button>
        <button
          type="button"
          onClick={onAddStock}
          className="inline-flex h-8 items-center gap-1 rounded-lg bg-primary px-2.5 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 sm:px-3"
        >
          <Plus className="h-3.5 w-3.5" />
          Qty
        </button>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: StockStatus }) {
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
        status === "In Stock" && "bg-success/15 text-success",
        status === "Low" && "bg-warning/15 text-warning",
        status === "Out" && "bg-destructive/15 text-destructive",
      )}
    >
      {status === "In Stock" ? "OK" : status}
    </span>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: typeof Boxes;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center">
      <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</p>
      {actionLabel && onAction && (
        <Button size="sm" className="mt-3 rounded-xl gap-1.5" onClick={onAction}>
          <Plus className="h-3.5 w-3.5" />
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

function MiniStat({
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
    <div className="flex items-center gap-2 rounded-xl border bg-card px-2.5 py-2 shadow-soft sm:gap-2.5 sm:px-3">
      <div className={cn("grid h-8 w-8 place-items-center rounded-lg", map[tone])}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-[10px] text-muted-foreground">{label}</div>
        <div className="truncate text-sm font-bold tracking-tight sm:text-base">{value}</div>
      </div>
    </div>
  );
}
