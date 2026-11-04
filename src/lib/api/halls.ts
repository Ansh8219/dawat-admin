import { apiFormRequest, apiRequest } from "./client";

export type HallCategory = "kitty_party" | "party_hall";

export const HALL_CATEGORY_LABELS: Record<HallCategory, string> = {
  kitty_party: "Kitty party",
  party_hall: "Party hall",
};

export interface HallImage {
  public_id: string;
  /** Image URL; the backend field name is normalised in `normalizeHall`. */
  url: string;
}

export interface HallSlot {
  public_id: string;
  code: string;
  label: string;
  /** HH:MM */
  start_time: string;
  end_time: string;
  is_active: boolean;
  sort_order: number;
}

export interface HallBlackout {
  public_id: string;
  /** YYYY-MM-DD */
  date: string;
  reason: string;
}

export interface Hall {
  public_id: string;
  slug: string;
  name: string;
  category: HallCategory;
  tagline: string;
  description: string;
  capacity_label: string;
  ambience: string;
  menu_label: string;
  support_label: string;
  min_guests: number;
  max_guests: number;
  default_guests: number | null;
  /** Rupees as a decimal string, e.g. "10000.00". */
  advance_amount: string;
  is_active: boolean;
  sort_order: number;
  images: HallImage[];
  slots: HallSlot[];
}

export interface CreateHallFields {
  slug: string;
  name: string;
  category: HallCategory;
  min_guests: number;
  max_guests: number;
  advance_amount: string;
  default_guests?: number | null;
  tagline?: string;
  description?: string;
  capacity_label?: string;
  ambience?: string;
  menu_label?: string;
  support_label?: string;
  is_active?: boolean;
  sort_order?: number;
}

export type UpdateHallFields = Partial<Omit<CreateHallFields, "slug">>;

export interface CreateSlotFields {
  code: string;
  label: string;
  start_time: string;
  end_time: string;
}

export type UpdateSlotFields = Partial<{
  label: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
  sort_order: number;
}>;

type Raw = Record<string, unknown>;

const hhmm = (v: unknown) => (typeof v === "string" ? v.slice(0, 5) : "");

function normalizeSlot(s: Raw): HallSlot {
  return {
    public_id: String(s.public_id ?? ""),
    code: String(s.code ?? ""),
    label: String(s.label ?? ""),
    start_time: hhmm(s.start_time),
    end_time: hhmm(s.end_time),
    is_active: s.is_active !== false,
    sort_order: Number(s.sort_order ?? 0),
  };
}

function normalizeImage(i: unknown): HallImage | null {
  if (typeof i === "string") return { public_id: i, url: i };
  if (!i || typeof i !== "object") return null;
  const r = i as Raw;
  const url = r.image ?? r.url ?? r.image_url;
  return { public_id: String(r.public_id ?? ""), url: typeof url === "string" ? url : "" };
}

export function normalizeHall(h: Raw): Hall {
  const images = Array.isArray(h.images) ? h.images : [];
  const slots = Array.isArray(h.slots) ? h.slots : [];
  return {
    public_id: String(h.public_id ?? ""),
    slug: String(h.slug ?? ""),
    name: String(h.name ?? ""),
    category: (h.category as HallCategory) ?? "party_hall",
    tagline: String(h.tagline ?? ""),
    description: String(h.description ?? ""),
    capacity_label: String(h.capacity_label ?? ""),
    ambience: String(h.ambience ?? ""),
    menu_label: String(h.menu_label ?? ""),
    support_label: String(h.support_label ?? ""),
    min_guests: Number(h.min_guests ?? 0),
    max_guests: Number(h.max_guests ?? 0),
    default_guests: h.default_guests == null ? null : Number(h.default_guests),
    advance_amount: String(h.advance_amount ?? "0"),
    is_active: h.is_active !== false,
    sort_order: Number(h.sort_order ?? 0),
    images: images.map(normalizeImage).filter((i): i is HallImage => i !== null),
    slots: slots.map((s) => normalizeSlot(s as Raw)),
  };
}

const base = "/api/admin/halls";

export async function listHalls(accessToken: string): Promise<Hall[]> {
  const data = await apiRequest<unknown>(`${base}/`, { accessToken });
  const rows = Array.isArray(data)
    ? data
    : ((data as { results?: unknown[] } | null)?.results ?? []);
  return rows.map((r) => normalizeHall(r as Raw));
}

export async function getHall(accessToken: string, id: string): Promise<Hall> {
  return normalizeHall(await apiRequest<Raw>(`${base}/${id}/`, { accessToken }));
}

export async function createHall(accessToken: string, body: CreateHallFields): Promise<Hall> {
  return normalizeHall(await apiRequest<Raw>(`${base}/`, { method: "POST", accessToken, body }));
}

export async function updateHall(
  accessToken: string,
  id: string,
  body: UpdateHallFields,
): Promise<Hall> {
  return normalizeHall(
    await apiRequest<Raw>(`${base}/${id}/`, { method: "PATCH", accessToken, body }),
  );
}

export function deleteHall(accessToken: string, id: string) {
  return apiRequest<unknown>(`${base}/${id}/`, { method: "DELETE", accessToken });
}

export async function uploadHallImage(
  accessToken: string,
  id: string,
  file: File,
): Promise<HallImage | null> {
  const body = new FormData();
  body.append("image", file);
  const data = await apiFormRequest<unknown>(`${base}/${id}/images/`, {
    method: "POST",
    accessToken,
    body,
  });
  return normalizeImage(data);
}

export function reorderHallImages(accessToken: string, id: string, imagePublicIds: string[]) {
  return apiRequest<unknown>(`${base}/${id}/images/order/`, {
    method: "PUT",
    accessToken,
    body: { image_public_ids: imagePublicIds },
  });
}

export function deleteHallImage(accessToken: string, id: string, imageId: string) {
  return apiRequest<unknown>(`${base}/${id}/images/${imageId}/`, {
    method: "DELETE",
    accessToken,
  });
}

export async function createHallSlot(
  accessToken: string,
  id: string,
  body: CreateSlotFields,
): Promise<HallSlot> {
  return normalizeSlot(
    await apiRequest<Raw>(`${base}/${id}/slots/`, { method: "POST", accessToken, body }),
  );
}

export async function updateHallSlot(
  accessToken: string,
  id: string,
  slotId: string,
  body: UpdateSlotFields,
): Promise<HallSlot> {
  return normalizeSlot(
    await apiRequest<Raw>(`${base}/${id}/slots/${slotId}/`, {
      method: "PATCH",
      accessToken,
      body,
    }),
  );
}

export function deleteHallSlot(accessToken: string, id: string, slotId: string) {
  return apiRequest<unknown>(`${base}/${id}/slots/${slotId}/`, {
    method: "DELETE",
    accessToken,
  });
}

function normalizeBlackout(b: Raw): HallBlackout {
  return {
    public_id: String(b.public_id ?? ""),
    date: String(b.date ?? "").slice(0, 10),
    reason: String(b.reason ?? ""),
  };
}

export async function listHallBlackouts(
  accessToken: string,
  id: string,
  from?: string,
): Promise<HallBlackout[]> {
  const qs = from ? `?from=${encodeURIComponent(from)}` : "";
  const data = await apiRequest<unknown>(`${base}/${id}/blackouts/${qs}`, { accessToken });
  const rows = Array.isArray(data)
    ? data
    : ((data as { results?: unknown[] } | null)?.results ?? []);
  return rows.map((r) => normalizeBlackout(r as Raw));
}

export async function createHallBlackout(
  accessToken: string,
  id: string,
  body: { date: string; reason?: string },
): Promise<HallBlackout> {
  return normalizeBlackout(
    await apiRequest<Raw>(`${base}/${id}/blackouts/`, { method: "POST", accessToken, body }),
  );
}

export function deleteHallBlackout(accessToken: string, id: string, blackoutId: string) {
  return apiRequest<unknown>(`${base}/${id}/blackouts/${blackoutId}/`, {
    method: "DELETE",
    accessToken,
  });
}
