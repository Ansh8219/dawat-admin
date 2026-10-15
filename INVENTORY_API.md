# Inventory Module — API Contract (live)

**Auth / envelope:** same as other `/api/admin/*` APIs. Staff Bearer token.  
**Scope:** `business_public_id` = current restaurant / bakery.

**Model:** Item master and stock are separate.  
`available` = sum of stock entry quantities (stock APIs coming next).

---

## Enums

| Field | Values |
|--------|--------|
| `unit` | `kg` \| `gram` \| `litre` \| `pcs` |

Categories come from `GET /api/admin/inventory/categories/` (not a hard-coded enum).

---

## 1. Categories

### `GET /api/admin/inventory/categories/`

Optional query: `?is_active=true`

Use `public_id` as `category_public_id` when creating items.

---

## 2. Inventory items

### `GET /api/admin/inventory/items/?business_public_id=<uuid>`

Auth: staff Bearer token  
Optional: `is_active=true`

```json
{
  "success": true,
  "status_code": 200,
  "message": "Success",
  "data": {
    "count": 2,
    "results": [
      {
        "public_id": "9c8b7a6d-5e4f-3210-9876-543210fedcba",
        "business_public_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "category_public_id": "f0e1d2c3-b4a5-6789-0abc-def123456789",
        "category_slug": "grains",
        "category_name": "Grains",
        "sku": "ATT-001",
        "name": "Atta",
        "unit": "kg",
        "reorder_level": 10,
        "is_active": true,
        "available": 45,
        "created_at": "2026-10-09T14:00:00+00:00",
        "updated_at": "2026-10-09T14:00:00+00:00"
      }
    ]
  },
  "error": null
}
```

### `POST /api/admin/inventory/items/`

| Field | Required | Notes |
|--------|----------|--------|
| `business_public_id` | yes | restaurant / bakery |
| `category_public_id` | yes | from categories list |
| `sku` | yes | unique per business |
| `name` | yes | |
| `unit` | yes | `kg` \| `gram` \| `litre` \| `pcs` |
| `reorder_level` | no | default `0` |
| `is_active` | no | default `true` |

No `quantity` / `cost_per_unit` on item create — stock is separate.

### `PATCH /api/admin/inventory/items/{item_public_id}/stock/`

| Field | Required | Notes |
|--------|----------|--------|
| `quantity` | yes | `>= 0` |
| `cost_per_unit` | no | |
| `stock_date` | no | default today (`YYYY-MM-DD`) |
| `notes` | no | |

```json
{
  "quantity": 45,
  "cost_per_unit": 120,
  "stock_date": "2026-10-09",
  "notes": "weekly restock"
}
```

### Frontend status

| Action | Status |
|--------|--------|
| List categories | ✅ wired |
| List items | ✅ wired |
| Create item | ✅ wired |
| Update stock | ✅ wired |
| PATCH item (catalog) | ⏳ waiting on API |
| Stock purchase log list | ⏳ waiting on API |

---

## Stock badge (frontend)

- `available <= 0` → Out  
- `available <= reorder_level` → Low  
- else → In Stock  
