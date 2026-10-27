# Daawat Admin — Module & Feature Status

**Scope:** Super Admin + business panels (Restaurant / Bakery / Banquet)  
**Audience:** Client & frontend team  
**Last reviewed:** Codebase check (Oct 2025)

---

## Status symbols

| Symbol | Meaning |
|--------|---------|
| ✅ | Live — backend API se connected |
| 🟡 | UI hai — abhi mock / local / incomplete |
| ❌ | Abhi start nahi / coming soon |

---

## Overall completion (%)

**Kaise calculate:** Is document ke **90 features** count kiye. Har feature ko:

- ✅ = **100%** (API live)
- 🟡 = **50%** (UI / mock — backend baaki)
- ❌ = **0%** (start nahi)

| Metric | % | Matlab |
|--------|---|--------|
| **Fully complete** | **~57%** | Sirf ✅ — production-ready with API |
| **Partial (UI only)** | **~38%** | 🟡 — dikhta hai, API / logic baaki |
| **Not started** | **~6%** | ❌ — coming soon / N/A row |

| **Overall progress (weighted)** | **~76%** | ✅ + half of 🟡 — typical “project % done” |

**Baaki / pending (fully complete ke hisaab se):** **~43%** abhi 100% live nahi hai.

### Module-wise % (weighted)

| Module | Fully ✅ | Overall (weighted) |
|--------|----------|---------------------|
| Login & access | 100% | 100% |
| Menu & Products | 100% | 100% |
| Menu Categories | 100% | 100% |
| Home Services | 100% | 100% |
| Tables (QR) | 83%* | 92%* |
| Orders | 86% | 93% |
| Customers | 88% | 94% |
| People (Partners + Store Keepers) | 88% | 88% |
| Dashboard | 33% | 67% |
| Settings | 44% | 67% |
| Inventory | 0% | 38% |
| Tables & Bookings | 0% | 33% |
| POS / Billing | 0% | 50% |
| Marketing | 0% | 50% |
| Finance | 0% | 50% |
| Reports | 0% | 50% |
| Notifications | 0% | 50% |
| Managers (People) | 0% | 0% |

\*Banquet par module N/A — 5/6 applicable features ✅.

### Super Admin focus (approx.)

**Core** — Login, People (Partners + Store Keepers), Home Services, Delivery + Security settings *(21 features)*:

| Metric | % |
|--------|---|
| Fully complete (✅) | **~95%** |
| Overall weighted | **~95%** |
| Pending | **~5%** (Managers tab ❌) |

**Core + Customers + Orders oversight** *(37 features — ops jo Super Admin bhi dekhta hai)*:

| Metric | % |
|--------|---|
| Fully complete (✅) | **~78%** |
| Overall weighted | **~86%** |
| Abhi fully live nahi | **~22%** |

---

## 1. Login & access

| Feature | Status |
|---------|--------|
| Admin login (email + password) | ✅ |
| Forgot password | ✅ |
| Reset password (link se) | ✅ |
| Session refresh / logout | ✅ |
| Business select (Restaurant / Bakery / Banquet) | ✅ |
| Super Admin — password change (Settings → Security) | ✅ |

---

## 2. Dashboard

| Feature | Status |
|---------|--------|
| New / Preparing / Ready order counts (live) | ✅ |
| New orders list + Accept / Reject | ✅ |
| Today revenue, avg ticket, rating cards | 🟡 Mock data |
| Low stock alert | 🟡 Mock data |
| “Accepting orders” on/off switch | 🟡 Sirf UI — API nahi |
| Banquet panel — events snapshot | 🟡 Mock data |

---

## 3. Orders

| Feature | Status |
|---------|--------|
| Tabs: New, Preparing, Ready, Past | ✅ |
| Pagination + tab counts | ✅ |
| Order detail (items, address, payment) | ✅ |
| Accept order (prep time) | ✅ |
| Reject order (reason) | ✅ |
| Start preparing / Mark ready | ✅ |
| Search | 🟡 Loaded page par hi filter |

---

## 4. POS / Billing

| Feature | Status |
|---------|--------|
| Item search + cart | 🟡 Mock menu |
| Pay modes + bill / receipt UI | 🟡 Local only |
| Past bills list | 🟡 Hardcoded sample |
| Print & save bill | 🟡 Toast only — API nahi |

---

## 5. Menu & Products

| Feature | Status |
|---------|--------|
| List menu items | ✅ |
| Add / Edit / Delete item | ✅ |
| Variants, add-ons, tax, images | ✅ |
| Available / unavailable (single + bulk) | ✅ |
| Category dropdown (API) | ✅ |
| Restaurant vs Bakery form labels | ✅ |

---

## 6. Menu Categories

| Feature | Status |
|---------|--------|
| List categories | ✅ |
| Active / inactive filter | ✅ |
| Create / Edit / Delete | ✅ |
| Category image upload | ✅ |

---

## 7. Inventory

| Feature | Status |
|---------|--------|
| Stock overview table | 🟡 Mock stock |
| Stock In-Out, PO, Suppliers, Wastage, Recipes tabs | 🟡 Demo UI + toasts |
| Add stock entry dialog | 🟡 Local toast only |
| Filters | ❌ “Coming soon” |

---

## 8. Tables & Bookings

| Feature | Status |
|---------|--------|
| Restaurant — table floor / reservations UI | 🟡 Mock |
| Banquet — events & decoration packages | 🟡 Mock |
| Backend bookings API | ❌ |

---

## 9. Tables (QR) — dine-in

| Feature | Status |
|---------|--------|
| List tables (search, pagination, active filter) | ✅ |
| Add / Edit / Delete table | ✅ |
| Seats, active toggle | ✅ |
| QR preview, download PNG, copy link | ✅ |
| Print QR | ✅ |
| Banquet panel | ❌ Module hide / not applicable |

---

## 10. Customers

| Feature | Status |
|---------|--------|
| Customer list + search | ✅ |
| Level filter (loaded from `/api/admin/reward-tiers/`) | ✅ |
| Sort + pagination | ✅ |
| Summary stats (one card per level from `summary.tiers`) | ✅ |
| Detail sheet (shows `tier_name`) | ✅ |
| Activate / deactivate customer | ✅ |
| Delete customer | ✅ |
| Customer levels side card (read-only + link) | ✅ |
| Manually change a customer's level | ❌ Not in API yet |
| Coins (earning, balance, history) | ❌ Not in API yet |

### Customer Levels (`/customer-levels`)

| Feature | Status |
|---------|--------|
| List levels (sorted by unlock coins) | ✅ |
| Create / edit level (name, key auto-suggest, coins, description) | ✅ |
| Delete level with confirmation | ✅ |
| Starting level: coins locked at 0, delete hidden | ✅ |
| Inline field errors (validation, key / threshold taken) | ✅ |
| Rewards catalog and redemptions | ❌ Not in API yet |

---

## 11. Marketing

| Feature | Status |
|---------|--------|
| Offers list + create + toggle | 🟡 Local / mock |
| Campaigns (WhatsApp / Push / SMS) | 🟡 Demo forms — send = toast |
| Occasion banners | 🟡 UI only |

---

## 12. People *(Super Admin heavy)*

### Partners

| Feature | Status |
|---------|--------|
| List (Pending / Approved / Rejected / All) | ✅ |
| Pagination | ✅ |
| Partner detail + documents | ✅ |
| Approve / Reject with reason & fields | ✅ |

### Store Keepers

| Feature | Status |
|---------|--------|
| List (+ Draft status) | ✅ |
| Detail + documents | ✅ |
| Approve / Reject | ✅ |

### Managers

| Feature | Status |
|---------|--------|
| List / onboarding | ❌ “Managers coming soon” |

---

## 13. Home Services *(Super Admin)*

| Feature | Status |
|---------|--------|
| List services | ✅ |
| Active / inactive filter | ✅ |
| Create / Edit / Delete | ✅ |
| Image on create | ✅ |

---

## 14. Finance

| Feature | Status |
|---------|--------|
| Expenses | 🟡 Mock + local add/remove |
| Daily cash closing | 🟡 UI only |
| P&L | 🟡 Static / mock |
| Vendor payments | 🟡 Mock |
| Purchase records | 🟡 Mock |

---

## 15. Reports

| Feature | Status |
|---------|--------|
| Sales charts | 🟡 Mock data |
| Menu / branch filters | 🟡 UI only |
| P&L table | 🟡 Static |
| Export CSV / PDF | 🟡 Toast only |

---

## 16. Notifications

| Feature | Status |
|---------|--------|
| Notification list | 🟡 Mock |
| Mark read / dismiss | 🟡 Local state |
| Top bar bell | 🟡 Same mock list |

---

## 17. Settings

| Tab | Feature | Status |
|-----|---------|--------|
| **Delivery** | Pickup location, radius, fees, map | ✅ |
| **Business** | Name, address, phone, logo | 🟡 Defaults + save toast |
| **Tax** | GST / tax fields | 🟡 UI only |
| **Printer** | KOT / bill printer config | 🟡 UI only |
| **Payment** | Payment modes | 🟡 UI only |
| **Appearance** | Dark / light mode | ✅ |
| **Security** | Account info | ✅ |
| **Security** | Change password | ✅ Super Admin only |
| **Business** | Logo upload | ❌ Coming soon |

---

## 18. Panel-wise availability (sidebar)

| Module | Restaurant | Bakery | Banquet |
|--------|:----------:|:------:|:-------:|
| Orders, POS, Menu, Categories, Inventory | ✅ | ✅ | ❌ |
| Tables (QR) | ✅ | ✅ | ❌ |
| Tables & Bookings | ✅ | ❌ | ✅ (bookings focus) |
| Customers, Marketing, People, Home Services | ✅ | ✅ | ✅ |
| Finance, Reports, Notifications, Settings | ✅ | ✅ | ✅ |

---

## Summary — kya ready hai client demo ke liye?

| View | Number |
|------|--------|
| Poora app — fully live | **~57%** |
| Poora app — weighted progress | **~76%** |
| Abhi baki (100% API wala) | **~43%** |
| Super Admin core (Login + People + Home + Settings) — fully live | **~95%** |
| Super Admin core + Customers + Orders — fully live | **~78%** |

**Strong (API ready):** Login, business switch, Orders flow, Menu + Categories, Tables QR, Customers, Partners & Store Keepers review, Home Services, Delivery settings.

**Demo UI only (backend baad mein):** POS, Inventory, Bookings, Marketing, Finance, Reports, Notifications, most Settings tabs.

**Not started:** Managers, Businesses create/edit admin, real loyalty, inventory/bookings/finance APIs.

---

*File: `SUPER_ADMIN_MODULE_STATUS.md` — update jab koi feature API pe live ho.*
