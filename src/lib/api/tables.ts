import { tables as seedFloorTables } from "@/lib/mock/data";
import { ApiError } from "./types";
import type {
  CreateRestaurantTableFields,
  DetailData,
  RestaurantTable,
  RestaurantTableListData,
  RestaurantTableListParams,
  UpdateRestaurantTableFields,
} from "./types";

/**
 * In-memory mock store for restaurant tables until
 * `/api/admin/tables/` is available on the backend.
 */
let mockStore: RestaurantTable[] | null = null;

function nowIso() {
  return new Date().toISOString();
}

function slugToken(tableNumber: string) {
  return tableNumber
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function makeQrToken(tableNumber: string) {
  return `tbl_${slugToken(tableNumber) || "table"}_${Date.now().toString(36)}`;
}

function seedStore(businessPublicId: string): RestaurantTable[] {
  const stamp = nowIso();
  return seedFloorTables.map((t, index) => ({
    public_id: `tbl_${String(index + 1).padStart(4, "0")}`,
    table_number: t.id,
    seats: t.seats,
    is_active: t.qrActive,
    qr_token: t.qrToken,
    business_public_id: businessPublicId,
    created_at: stamp,
    updated_at: stamp,
  }));
}

function getStore(businessPublicId: string): RestaurantTable[] {
  if (!mockStore) {
    mockStore = seedStore(businessPublicId);
  }
  return mockStore;
}

function requireStore(): RestaurantTable[] {
  if (!mockStore) {
    throw new ApiError(404, "not_found", "Table not found.");
  }
  return mockStore;
}

function delay(ms = 220) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeTableNumber(value: string) {
  return value.trim().toUpperCase();
}

function assertUniqueNumber(
  businessPublicId: string,
  tableNumber: string,
  excludePublicId?: string,
) {
  const conflict = getStore(businessPublicId).find(
    (t) =>
      t.business_public_id === businessPublicId &&
      t.table_number.toLowerCase() === tableNumber.toLowerCase() &&
      t.public_id !== excludePublicId,
  );
  if (conflict) {
    throw new ApiError(400, "validation_error", `Table ${tableNumber} already exists.`, {
      table_number: ["Table number must be unique."],
    });
  }
}

export async function listTables(
  _accessToken: string,
  params: RestaurantTableListParams,
): Promise<RestaurantTableListData> {
  await delay();
  const store = getStore(params.business_public_id);
  let results = store.filter((t) => t.business_public_id === params.business_public_id);

  if (params.is_active !== undefined) {
    results = results.filter((t) => t.is_active === params.is_active);
  }

  const needle = params.q?.trim().toLowerCase();
  if (needle) {
    results = results.filter(
      (t) =>
        t.table_number.toLowerCase().includes(needle) ||
        t.qr_token.toLowerCase().includes(needle),
    );
  }

  results = [...results].sort((a, b) =>
    a.table_number.localeCompare(b.table_number, undefined, { numeric: true }),
  );

  return { count: results.length, results };
}

export async function createTable(
  _accessToken: string,
  fields: CreateRestaurantTableFields,
): Promise<RestaurantTable> {
  await delay();
  const tableNumber = normalizeTableNumber(fields.table_number);
  if (!tableNumber) {
    throw new ApiError(400, "validation_error", "Table number is required.", {
      table_number: ["This field is required."],
    });
  }
  if (!Number.isFinite(fields.seats) || fields.seats < 1 || fields.seats > 24) {
    throw new ApiError(400, "validation_error", "Seats must be between 1 and 24.", {
      seats: ["Enter a number from 1 to 24."],
    });
  }

  assertUniqueNumber(fields.business_public_id, tableNumber);

  const stamp = nowIso();
  const created: RestaurantTable = {
    public_id: `tbl_${Date.now().toString(36)}`,
    table_number: tableNumber,
    seats: Math.floor(fields.seats),
    is_active: fields.is_active ?? true,
    qr_token: makeQrToken(tableNumber),
    business_public_id: fields.business_public_id,
    created_at: stamp,
    updated_at: stamp,
  };

  mockStore = [...getStore(fields.business_public_id), created];
  return created;
}

export async function updateTable(
  _accessToken: string,
  publicId: string,
  fields: UpdateRestaurantTableFields,
): Promise<RestaurantTable> {
  await delay();
  const store = requireStore();
  const index = store.findIndex((t) => t.public_id === publicId);
  if (index < 0) {
    throw new ApiError(404, "not_found", "Table not found.");
  }

  const current = store[index];
  const nextNumber =
    fields.table_number !== undefined
      ? normalizeTableNumber(fields.table_number)
      : current.table_number;

  if (!nextNumber) {
    throw new ApiError(400, "validation_error", "Table number is required.", {
      table_number: ["This field is required."],
    });
  }

  if (fields.seats !== undefined) {
    if (!Number.isFinite(fields.seats) || fields.seats < 1 || fields.seats > 24) {
      throw new ApiError(400, "validation_error", "Seats must be between 1 and 24.", {
        seats: ["Enter a number from 1 to 24."],
      });
    }
  }

  assertUniqueNumber(current.business_public_id, nextNumber, publicId);

  const updated: RestaurantTable = {
    ...current,
    table_number: nextNumber,
    seats: fields.seats !== undefined ? Math.floor(fields.seats) : current.seats,
    is_active: fields.is_active ?? current.is_active,
    updated_at: nowIso(),
  };

  const next = [...store];
  next[index] = updated;
  mockStore = next;
  return updated;
}

export async function rotateTableQrToken(
  _accessToken: string,
  publicId: string,
): Promise<RestaurantTable> {
  await delay();
  const store = requireStore();
  const index = store.findIndex((t) => t.public_id === publicId);
  if (index < 0) {
    throw new ApiError(404, "not_found", "Table not found.");
  }

  const current = store[index];
  const updated: RestaurantTable = {
    ...current,
    qr_token: makeQrToken(current.table_number),
    updated_at: nowIso(),
  };
  const next = [...store];
  next[index] = updated;
  mockStore = next;
  return updated;
}

export async function deleteTable(
  _accessToken: string,
  publicId: string,
): Promise<DetailData> {
  await delay();
  const store = requireStore();
  const exists = store.some((t) => t.public_id === publicId);
  if (!exists) {
    throw new ApiError(404, "not_found", "Table not found.");
  }
  mockStore = store.filter((t) => t.public_id !== publicId);
  return { detail: "Table deleted." };
}
