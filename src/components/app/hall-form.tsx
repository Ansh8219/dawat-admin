import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  HALL_CATEGORY_LABELS,
  type CreateHallFields,
  type Hall,
  type HallCategory,
  type UpdateHallFields,
} from "@/lib/api/halls";

export type HallFormState = {
  slug: string;
  name: string;
  category: HallCategory;
  min_guests: string;
  max_guests: string;
  default_guests: string;
  advance_amount: string;
  tagline: string;
  description: string;
  capacity_label: string;
  ambience: string;
  menu_label: string;
  support_label: string;
  is_active: boolean;
  sort_order: string;
};

export const EMPTY_HALL_FORM: HallFormState = {
  slug: "",
  name: "",
  category: "party_hall",
  min_guests: "",
  max_guests: "",
  default_guests: "",
  advance_amount: "",
  tagline: "",
  description: "",
  capacity_label: "",
  ambience: "",
  menu_label: "",
  support_label: "",
  is_active: true,
  sort_order: "0",
};

export function hallToForm(h: Hall): HallFormState {
  return {
    slug: h.slug,
    name: h.name,
    category: h.category,
    min_guests: String(h.min_guests),
    max_guests: String(h.max_guests),
    default_guests: h.default_guests == null ? "" : String(h.default_guests),
    advance_amount: h.advance_amount,
    tagline: h.tagline,
    description: h.description,
    capacity_label: h.capacity_label,
    ambience: h.ambience,
    menu_label: h.menu_label,
    support_label: h.support_label,
    is_active: h.is_active,
    sort_order: String(h.sort_order),
  };
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const int = (v: string) => /^\d+$/.test(v.trim());

/** Client-side validation; returns field → message. */
export function validateHallForm(
  f: HallFormState,
  mode: "create" | "edit",
): Record<string, string> {
  const e: Record<string, string> = {};
  if (mode === "create") {
    if (!f.slug) e.slug = "Slug is required.";
    else if (f.slug.length > 80) e.slug = "Max 80 characters.";
    else if (!/^[a-z0-9-]+$/.test(f.slug))
      e.slug = "Use lowercase letters, digits and hyphens only.";
  }
  if (!f.name.trim()) e.name = "Name is required.";
  else if (f.name.length > 120) e.name = "Max 120 characters.";

  const min = int(f.min_guests) ? Number(f.min_guests) : NaN;
  const max = int(f.max_guests) ? Number(f.max_guests) : NaN;
  if (!(min >= 1)) e.min_guests = "Enter a whole number, 1 or more.";
  if (!(max >= 1)) e.max_guests = "Enter a whole number, 1 or more.";
  else if (min >= 1 && max < min) e.max_guests = "Must be at least the minimum guests.";

  if (f.default_guests.trim()) {
    const d = int(f.default_guests) ? Number(f.default_guests) : NaN;
    if (!(d >= 1)) e.default_guests = "Enter a whole number, 1 or more.";
    else if (min >= 1 && d < min) e.default_guests = "Must not be below minimum guests.";
    else if (max >= 1 && d > max) e.default_guests = "Must not exceed maximum guests.";
  }

  if (!/^\d+(\.\d{1,2})?$/.test(f.advance_amount.trim())) {
    e.advance_amount = "Enter an amount in rupees with up to 2 decimals.";
  } else if (Number(f.advance_amount) < 1) {
    e.advance_amount = "Must be at least ₹1.";
  }

  if (f.tagline.length > 200) e.tagline = "Max 200 characters.";
  if (f.capacity_label.length > 80) e.capacity_label = "Max 80 characters.";
  if (f.ambience.length > 200) e.ambience = "Max 200 characters.";
  if (f.menu_label.length > 200) e.menu_label = "Max 200 characters.";
  if (f.support_label.length > 200) e.support_label = "Max 200 characters.";
  if (f.sort_order.trim() && !/^-?\d+$/.test(f.sort_order.trim()))
    e.sort_order = "Enter a whole number.";
  return e;
}

function toPayload(f: HallFormState): UpdateHallFields {
  return {
    name: f.name.trim(),
    category: f.category,
    min_guests: Number(f.min_guests),
    max_guests: Number(f.max_guests),
    default_guests: f.default_guests.trim() ? Number(f.default_guests) : null,
    advance_amount: Number(f.advance_amount).toFixed(2),
    tagline: f.tagline.trim(),
    description: f.description.trim(),
    capacity_label: f.capacity_label.trim(),
    ambience: f.ambience.trim(),
    menu_label: f.menu_label.trim(),
    support_label: f.support_label.trim(),
    is_active: f.is_active,
    sort_order: f.sort_order.trim() ? Number(f.sort_order) : 0,
  };
}

export function buildCreatePayload(f: HallFormState): CreateHallFields {
  const p = toPayload(f);
  const out = { slug: f.slug, ...p } as CreateHallFields;
  if (out.default_guests == null) delete out.default_guests;
  return out;
}

/** PATCH body containing only fields that differ from the loaded hall. */
export function buildPatchPayload(f: HallFormState, original: Hall): UpdateHallFields {
  const next = toPayload(f);
  const prev = toPayload(hallToForm(original));
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(next) as (keyof UpdateHallFields)[]) {
    if (next[key] !== prev[key]) out[key] = next[key];
  }
  return out as UpdateHallFields;
}

function Field({
  label,
  error,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  htmlFor: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function HallForm({
  mode,
  value,
  onChange,
  errors,
  saving,
  dirty = true,
  onSubmit,
  submitLabel,
}: {
  mode: "create" | "edit";
  value: HallFormState;
  onChange: (next: HallFormState) => void;
  errors: Record<string, string>;
  saving: boolean;
  dirty?: boolean;
  onSubmit: () => void;
  submitLabel: string;
}) {
  const [slugTouched, setSlugTouched] = useState(false);
  const set = <K extends keyof HallFormState>(k: K, v: HallFormState[K]) =>
    onChange({ ...value, [k]: v });

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (!saving) onSubmit();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name *" htmlFor="hall-name" error={errors.name}>
          <Input
            id="hall-name"
            value={value.name}
            maxLength={120}
            onChange={(e) => {
              const name = e.target.value;
              onChange({
                ...value,
                name,
                ...(mode === "create" && !slugTouched ? { slug: slugify(name) } : {}),
              });
            }}
          />
        </Field>
        <Field
          label="Slug *"
          htmlFor="hall-slug"
          error={errors.slug}
          hint={
            mode === "edit"
              ? "Cannot be changed after creation."
              : "Lowercase letters, digits, hyphens."
          }
        >
          <Input
            id="hall-slug"
            value={value.slug}
            maxLength={80}
            readOnly={mode === "edit"}
            disabled={mode === "edit"}
            placeholder="pearl-banquet-hall"
            onChange={(e) => {
              setSlugTouched(true);
              set("slug", e.target.value);
            }}
          />
        </Field>
        <Field label="Category *" htmlFor="hall-category" error={errors.category}>
          <Select value={value.category} onValueChange={(v) => set("category", v as HallCategory)}>
            <SelectTrigger id="hall-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(HALL_CATEGORY_LABELS) as HallCategory[]).map((c) => (
                <SelectItem key={c} value={c}>
                  {HALL_CATEGORY_LABELS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field
          label="Advance amount (₹) *"
          htmlFor="hall-advance"
          error={errors.advance_amount}
          hint="Up to 2 decimals, e.g. 10000.00"
        >
          <Input
            id="hall-advance"
            inputMode="decimal"
            value={value.advance_amount}
            onChange={(e) => set("advance_amount", e.target.value)}
          />
        </Field>
        <Field label="Min guests *" htmlFor="hall-min" error={errors.min_guests}>
          <Input
            id="hall-min"
            inputMode="numeric"
            value={value.min_guests}
            onChange={(e) => set("min_guests", e.target.value)}
          />
        </Field>
        <Field label="Max guests *" htmlFor="hall-max" error={errors.max_guests}>
          <Input
            id="hall-max"
            inputMode="numeric"
            value={value.max_guests}
            onChange={(e) => set("max_guests", e.target.value)}
          />
        </Field>
        <Field
          label="Default guests"
          htmlFor="hall-default"
          error={errors.default_guests}
          hint="Between min and max."
        >
          <Input
            id="hall-default"
            inputMode="numeric"
            value={value.default_guests}
            onChange={(e) => set("default_guests", e.target.value)}
          />
        </Field>
        <Field label="Sort order" htmlFor="hall-sort" error={errors.sort_order}>
          <Input
            id="hall-sort"
            inputMode="numeric"
            value={value.sort_order}
            onChange={(e) => set("sort_order", e.target.value)}
          />
        </Field>
        <Field label="Tagline" htmlFor="hall-tagline" error={errors.tagline}>
          <Input
            id="hall-tagline"
            value={value.tagline}
            maxLength={200}
            onChange={(e) => set("tagline", e.target.value)}
          />
        </Field>
        <Field label="Capacity label" htmlFor="hall-cap" error={errors.capacity_label}>
          <Input
            id="hall-cap"
            value={value.capacity_label}
            maxLength={80}
            placeholder="40-200 guests"
            onChange={(e) => set("capacity_label", e.target.value)}
          />
        </Field>
        <Field label="Ambience" htmlFor="hall-ambience" error={errors.ambience}>
          <Input
            id="hall-ambience"
            value={value.ambience}
            maxLength={200}
            onChange={(e) => set("ambience", e.target.value)}
          />
        </Field>
        <Field label="Menu label" htmlFor="hall-menu" error={errors.menu_label}>
          <Input
            id="hall-menu"
            value={value.menu_label}
            maxLength={200}
            onChange={(e) => set("menu_label", e.target.value)}
          />
        </Field>
        <Field label="Support label" htmlFor="hall-support" error={errors.support_label}>
          <Input
            id="hall-support"
            value={value.support_label}
            maxLength={200}
            onChange={(e) => set("support_label", e.target.value)}
          />
        </Field>
        <div className="flex items-center gap-3 self-end pb-2">
          <Switch
            id="hall-active"
            checked={value.is_active}
            onCheckedChange={(v) => set("is_active", v)}
          />
          <Label htmlFor="hall-active">Active (visible to customers)</Label>
        </div>
      </div>
      <Field label="Description" htmlFor="hall-desc" error={errors.description}>
        <Textarea
          id="hall-desc"
          rows={5}
          value={value.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </Field>
      <Button type="submit" disabled={saving || !dirty}>
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {submitLabel}
      </Button>
    </form>
  );
}
