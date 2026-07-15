
# Daawat Baker's — Admin Panel (UI-only, mock data)

A production-grade multi-page admin panel with 14 screens, persistent sidebar, brand-driven design system, and realistic Indian mock data. No backend — all interactions use local state.

## Design system (src/styles.css)
- Brand primary: `#FF3951` (coral red) — buttons, active nav, key highlights
- Accent gold: `#C9A227` — premium touches
- Neutrals: charcoal `#1A1A1A` text, off-white `#FAFAF7` bg, white cards
- Status: success green, warning amber, error red, info blue
- Font: SF Pro stack (`-apple-system, "SF Pro Display", "SF Pro Text", system-ui`)
- Rounded 2xl cards, soft shadows, 8px spacing grid
- Dark mode toggle (keeps `#FF3951` accent)
- Uploaded logo saved as Lovable asset, shown in sidebar top

## Shell & navigation
- **AppShell** layout route (`src/routes/_app.tsx`) with:
  - Collapsible left sidebar (icon-only mode) — grouped nav, lucide icons, Daawat Baker's logo lockup
  - Top bar: search, notification bell w/ dropdown, branch switcher (Bakery/Restaurant/Banquet), profile menu
  - Mobile: hamburger drawer + bottom nav
- Consistent page header: title + breadcrumb + primary action button
- Skeleton loaders on tab switches

## Routes (14 pages under `_app`)
1. `/` Dashboard — 4 KPI cards w/ sparklines, sales area chart (Daily/Weekly/Monthly), channel donut, business-type tabs, inventory alerts, recent orders feed, hot sellers, upcoming bookings, banner shortcut
2. `/orders` — tabs (All/Dine-In/Takeaway/Delivery/Online/Zomato), filterable table + Kanban toggle, slide-over drawer with itemized details, status stepper, code-entry chip input, 30-min prep countdown
3. `/pos` — split POS: product grid + cart panel, code-entry field (`22+67`), GST breakdown, dine-in +25% toggle, payment mode buttons, receipt preview modal, Bill History tab with editable past bills (cash edit info tag vs edit-history timeline)
4. `/menu` — grid/list toggle, availability switches, add/edit modal w/ variants + image drop, categories sidebar w/ reorder, branch filter, bulk actions
5. `/inventory` — overview cards + tabs (Stock Overview / In-Out / POs / Suppliers / Wastage / Recipes), stock entry modal, recipe→ingredient consumption, Smart Production Planning widget w/ forecast
6. `/bookings` — sub-tabs Restaurant Tables (color-coded floor-plan grid) / Banquet Hall (month calendar + event details + new-booking form with decoration packages, catering, 25% advance calculator)
7. `/customers` — CRM table w/ loyalty tiers, profile drawer (orders/addresses/points/notes), loyalty settings panel
8. `/marketing` — offer cards grid, create-offer modal, campaign tabs (WhatsApp/Push/SMS) + history stats, occasion banner scheduler calendar
9. `/drivers` — driver cards, profile view w/ earnings chart, live assignment board
10. `/staff` — staff table, pending approvals highlight, role-permission matrix, device login audit
11. `/finance` — overview cards, tabs (Expenses / Cash Closing / P&L / Vendor Payments / Purchase Records), cash-closing form w/ discrepancy flag, P&L bar chart, top product/month highlights
12. `/reports` — Sales/Product/Inventory/Financial tabs, date+branch filters, mixed charts, product profitability table w/ color-coded margins, Export CSV/PDF buttons (non-functional)
13. `/notifications` — grouped list (Today/Earlier), priority left-border, mark-as-read, delivery channel settings
14. `/settings` — sub-tabs Business (per-branch GST) / Tax / Printer / Payment / Delivery (radius slider + zone rules), dark-mode toggle

## Tech
- TanStack Router file-based routing (all pages under `_app` layout)
- shadcn/ui components + Tailwind v4 (semantic tokens only)
- `lucide-react` icons, `recharts` charts, `framer-motion` for drawer/modal transitions
- Mock data in `src/lib/mock/*.ts` — Indian names, ₹ currency, real menu items (Daal Makhni, Butter Chapati, Chocolate Truffle Cake, etc.)
- Local component state for all interactivity (toggles, filters, modals, cart, code-entry parser)
- Zustand for lightweight cross-page state (branch switcher, cart, dark mode)

## Deliverables
- 14 functional routes with sidebar/topbar shell
- Design tokens + dark mode
- All modals/drawers/tabs/filters interactive
- Realistic populated mock data on every screen
- Empty states designed (icon + copy + CTA) — visible when filters yield no rows
- Consistent status badge system
- Responsive down to mobile

Scope note: this is a large single build. I'll ship a cohesive first pass across all 14 screens with real interactivity on the highest-value flows (POS, Orders, Inventory, Bookings, Dashboard); lighter screens (Notifications, Drivers, Staff audit, Reports export) will be visually complete with mock data but may have some placeholder-only actions (e.g. Export buttons open a toast). I'll call these out on delivery.
