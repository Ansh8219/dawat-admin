import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatInvoiceMoney } from "@/lib/api/invoices";
import type { PosAddonGroup, PosMenuItem } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const money = formatInvoiceMoney;

/** POS variant + addon picker for one menu item (shared by New Bill and Counter Payments). */
export function OptionsDialog({
  item,
  onClose,
  onConfirm,
}: {
  item: PosMenuItem | null;
  onClose: () => void;
  onConfirm: (
    item: PosMenuItem,
    variant: string,
    addons: { name: string; price: number }[],
  ) => void;
}) {
  const [variant, setVariant] = useState("");
  const [chosen, setChosen] = useState<Record<string, string[]>>({});

  useEffect(() => {
    setVariant("");
    setChosen({});
  }, [item]);

  if (!item) return <Dialog open={false} onOpenChange={() => {}} />;

  const groupError = (g: PosAddonGroup) => {
    const n = (chosen[g.name] ?? []).length;
    if (n < g.min_select) return `Choose at least ${g.min_select}`;
    if (g.max_select > 0 && n > g.max_select) return `Choose at most ${g.max_select}`;
    return "";
  };
  const needsVariant = item.variants.length > 0 && !variant;
  const invalid = needsVariant || item.addon_groups.some((g) => groupError(g));

  const addons = item.addon_groups.flatMap((g) =>
    (chosen[g.name] ?? []).map((name) => ({
      name,
      price: g.options.find((o) => o.name === name)?.price ?? 0,
    })),
  );
  const base = item.variants.find((v) => v.name === variant)?.price ?? item.price;
  const unit = round2(base + addons.reduce((s, a) => s + a.price, 0));

  function toggle(g: PosAddonGroup, name: string) {
    setChosen((prev) => {
      const cur = prev[g.name] ?? [];
      if (cur.includes(name)) return { ...prev, [g.name]: cur.filter((n) => n !== name) };
      if (g.max_select === 1) return { ...prev, [g.name]: [name] };
      if (g.max_select > 0 && cur.length >= g.max_select) return prev;
      return { ...prev, [g.name]: [...cur, name] };
    });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{item.name}</DialogTitle>
        </DialogHeader>
        {item.variants.length > 0 && (
          <div>
            <div className="mb-1.5 text-xs font-semibold uppercase text-muted-foreground">
              Variant <span className="text-destructive">*</span>
            </div>
            <div className="space-y-1.5">
              {item.variants.map((v) => (
                <button
                  key={v.name}
                  onClick={() => setVariant(v.name)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border p-2 text-sm",
                    variant === v.name ? "border-primary bg-primary/10" : "hover:bg-muted",
                  )}
                >
                  <span>{v.name}</span>
                  <span className="font-medium">{money(v.price)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {item.addon_groups.map((g) => {
          const err = groupError(g);
          return (
            <div key={g.name}>
              <div className="mb-1.5 flex items-center justify-between text-xs font-semibold uppercase text-muted-foreground">
                <span>
                  {g.name}
                  {g.min_select > 0 && <span className="text-destructive"> *</span>}
                </span>
                <span className="font-normal normal-case">
                  {g.max_select > 0
                    ? `Pick ${g.min_select}–${g.max_select}`
                    : `Min ${g.min_select}`}
                </span>
              </div>
              <div className="space-y-1.5">
                {g.options.map((o) => {
                  const on = (chosen[g.name] ?? []).includes(o.name);
                  return (
                    <button
                      key={o.name}
                      onClick={() => toggle(g, o.name)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg border p-2 text-sm",
                        on ? "border-primary bg-primary/10" : "hover:bg-muted",
                      )}
                    >
                      <span>{o.name}</span>
                      <span className="text-muted-foreground">
                        {o.price > 0 ? `+ ${money(o.price)}` : "Free"}
                      </span>
                    </button>
                  );
                })}
              </div>
              {err && chosen[g.name] && <div className="mt-1 text-xs text-destructive">{err}</div>}
            </div>
          );
        })}
        <Button
          className="rounded-xl"
          disabled={invalid}
          onClick={() => onConfirm(item, variant, addons)}
        >
          Add to bill · {money(unit)}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
