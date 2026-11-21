# Graph Report - dawat-admin  (2026-11-21)

## Corpus Check
- 203 files · ~138,069 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 10 file(s) not represented in the graph (top: (none) 5, .example 1, .lock 1)

## Summary
- 2125 nodes · 7445 edges · 92 communities (76 shown, 16 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 68 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Orders Socket Hooks
- Home Services & Tables API
- Invoice Document
- Hall Booking Drawer
- Accordion/Breadcrumb UI
- Hall Form Payloads
- Row Actions & Avatar
- Offers API & Form Requests
- Booking Settings & Tabs
- Partner Routes
- Inventory API
- Reward Rules
- Campaign Badges
- Analytics API
- Sheet/Separator UI
- UI Dependencies
- Auth Shell
- Business Profile Form
- Auth API
- Reward Tiers
- Package Dependencies
- Notifications Bell
- Inventory API Contract Doc
- Account Status & Hall Images
- Hall Form
- Store Keepers
- Lint Config
- Customer Coins
- Manager Create Form
- Dashboard Sales
- Managers List
- Partner Normalizers
- Menu Categories
- Mock Data
- Table QR
- Route Definitions
- Campaign Form
- Partner Listing
- Stat Cards
- Menu Recipe Types
- Components Config
- Home Service CRUD
- TS Config
- Business Invoice Details
- API Client & Activity
- Menu API
- Customer Picker
- Docker Compose
- Error Capture
- Pickup Map
- Hall Blackouts
- Build Tooling
- App Sidebar
- Carousel UI
- Order Mock Data
- Partners API
- Auth State
- Form UI
- Campaigns API
- Community 59
- Community 60
- Community 61
- Community 62
- Community 63
- Community 64
- Community 65
- Community 66
- Community 67
- Community 68
- Community 69
- Community 70
- Community 71
- Community 72
- Community 73
- Community 74
- Community 75
- Community 76
- Community 77
- Community 78
- Community 79
- Community 80
- Community 81
- Community 82
- Community 83
- Community 84
- Community 85
- Community 86
- Community 87
- Community 88
- Community 89
- Community 90
- Community 91

## God Nodes (most connected - your core abstractions)
1. `cn()` - 330 edges
2. `withAuthRetry()` - 185 edges
3. `apiRequest()` - 142 edges
4. `Button` - 132 edges
5. `react` - 112 edges
6. `lucide-react` - 82 edges
7. `useAuth` - 79 edges
8. `MenuPage()` - 77 edges
9. `Input` - 71 edges
10. `Label` - 71 edges

## Surprising Connections (you probably didn't know these)
- `StatCard()` --calls--> `cn()`  [EXTRACTED]
  src/components/app/stat-card.tsx → src/lib/utils.ts
- `AlertTitle` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/alert.tsx → src/lib/utils.ts
- `Carousel` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/carousel.tsx → src/lib/utils.ts
- `CommandInput` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/command.tsx → src/lib/utils.ts
- `CommandList` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/command.tsx → src/lib/utils.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Inventory items API endpoints** — inventory_api_categories_endpoint, inventory_api_items_list_endpoint, inventory_api_items_create_endpoint, inventory_api_item_stock_endpoint [EXTRACTED 0.95]
- **Modules with demo UI awaiting backend** — super_admin_module_status_pos_billing, super_admin_module_status_marketing, super_admin_module_status_finance, super_admin_module_status_reports, super_admin_module_status_notifications, super_admin_module_status_inventory [INFERRED 0.85]
- **Modules fully live on backend API** — super_admin_module_status_login_access, super_admin_module_status_orders, super_admin_module_status_menu_products, super_admin_module_status_menu_categories, super_admin_module_status_tables_qr, super_admin_module_status_customers, super_admin_module_status_home_services [INFERRED 0.85]

## Communities (92 total, 16 thin omitted)

### Community 0 - "Orders Socket Hooks"
Cohesion: 0.05
Nodes (91): @tanstack/react-query, isOrdersPath(), shortId(), useAdminOrdersSocket(), UseAdminOrdersSocketOptions, fetchAllOrders(), useLateOrderWatcher(), WATCHED_TABS (+83 more)

### Community 1 - "Home Services & Tables API"
Cohesion: 0.03
Nodes (89): HOME_SERVICE_KEY_PATTERN, getTable(), AdminOrderAddon, AdminOrderAddress, AdminOrderAppliedOffer, AdminOrderBusiness, AdminOrderCustomer, AdminOrderDriver (+81 more)

### Community 2 - "Invoice Document"
Cohesion: 0.06
Nodes (83): Field(), InvoiceDocument(), Td(), Th(), TotalRow(), OrderInvoices(), amountInWords(), belowHundred() (+75 more)

### Community 3 - "Hall Booking Drawer"
Cohesion: 0.07
Nodes (60): HallRefundBadge(), HallStatusBadge(), REFUND_CLASS, STATUS_CLASS, Confirm, HallBookingDrawer(), run(), saveNote() (+52 more)

### Community 4 - "Accordion/Breadcrumb UI"
Cohesion: 0.06
Nodes (46): AccordionContent, AccordionItem, AccordionTrigger, Breadcrumb, BreadcrumbEllipsis(), BreadcrumbItem, BreadcrumbLink, BreadcrumbList (+38 more)

### Community 5 - "Hall Form Payloads"
Cohesion: 0.09
Nodes (50): buildCreatePayload(), buildPatchPayload(), EMPTY_HALL_FORM, HallFormState, hallToForm(), toPayload(), validateHallForm(), upload() (+42 more)

### Community 6 - "Row Actions & Avatar"
Cohesion: 0.07
Nodes (45): RowActionItem, Avatar, AvatarFallback, AvatarImage, DropdownMenuContent, DropdownMenuItem, listBusinesses(), deleteCustomer() (+37 more)

### Community 7 - "Offers API & Form Requests"
Cohesion: 0.07
Nodes (47): apiFormRequest(), appendChannels(), appendField(), appendNumberField(), appendStringField(), buildOfferForm(), createOffer(), deleteOffer() (+39 more)

### Community 8 - "Booking Settings & Tabs"
Cohesion: 0.08
Nodes (49): TabsContent, TabsList, TabsTrigger, buildPerGuestRatePatch(), getBookingSettings(), RatePatchResult, updateBookingSettings(), canRetryRefund() (+41 more)

### Community 9 - "Partner Routes"
Cohesion: 0.04
Nodes (50): Route, Route, AppAnalyticsRoute, AppBookingsRoute, AppBusinessesRoute, AppCampaignsCampaignIdEditRoute, AppCampaignsCampaignIdRoute, AppCampaignsNewRoute (+42 more)

### Community 10 - "Inventory API"
Cohesion: 0.06
Nodes (47): createInventoryItem(), describeInventoryHistory(), InventoryHistoryDisplay, inventoryKeys, listInventoryCategories(), listInventoryItemHistory(), parseShortBy(), updateInventoryItemStock() (+39 more)

### Community 11 - "Reward Rules"
Cohesion: 0.08
Nodes (43): RadioGroup, RadioGroupItem, listRewardRules(), REWARD_RULE_COINS_MAX, REWARD_RULE_DESCRIPTION_MAX, REWARD_RULE_HELP, REWARD_RULE_TITLE_MAX, updateRewardRule() (+35 more)

### Community 12 - "Campaign Badges"
Cohesion: 0.12
Nodes (35): CampaignStatusBadge(), ChannelIcons(), CampaignRecipients(), STATUS_CLASS, EmptyState(), PageHeader(), Props, map (+27 more)

### Community 13 - "Analytics API"
Cohesion: 0.11
Nodes (42): analyticsKeys, buildQuery(), downloadAnalyticsCsv(), fillHourlySales(), formatSharePct(), getAnalyticsFinancial(), getAnalyticsInventory(), getAnalyticsProducts() (+34 more)

### Community 14 - "Sheet/Separator UI"
Cohesion: 0.07
Nodes (38): Separator, SheetContent, SheetContentProps, SheetDescription, SheetFooter(), SheetHeader(), SheetOverlay, SheetTitle (+30 more)

### Community 15 - "UI Dependencies"
Cohesion: 0.05
Nodes (41): dependencies, class-variance-authority@^0.7.1, input-otp@^1.4.2, lucide-react@^0.575.0, @radix-ui/react-accordion@^1.2.12, @radix-ui/react-alert-dialog@^1.1.15, @radix-ui/react-avatar@^1.1.11, @radix-ui/react-context-menu@^2.2.16 (+33 more)

### Community 16 - "Auth Shell"
Cohesion: 0.18
Nodes (24): lucide-react, react, @tanstack/react-router, zod, AuthShell(), FEATURES, FOOD_IMAGES, STATS (+16 more)

### Community 17 - "Business Profile Form"
Cohesion: 0.12
Nodes (30): ALLOWED_LOGO_TYPES, BusinessProfileForm(), titleCase(), validateLogo(), validateName(), updateBusinessProfile(), buildDeliverySettingsPatch(), DeliverySettingsForm (+22 more)

### Community 18 - "Auth API"
Cohesion: 0.10
Nodes (29): adminLogin(), changePassword(), forgotPassword(), getMe(), getMyAccess(), refreshAccessToken(), resetPassword(), apiRequest() (+21 more)

### Community 19 - "Reward Tiers"
Cohesion: 0.11
Nodes (29): createRewardTier(), deleteRewardTier(), getRewardTier(), listRewardTiers(), REWARD_TIER_DESCRIPTION_MAX, REWARD_TIER_KEY_MAX, REWARD_TIER_KEY_PATTERN, REWARD_TIER_NAME_MAX (+21 more)

### Community 20 - "Package Dependencies"
Cohesion: 0.06
Nodes (30): clsx@^2.1.1, cmdk@^1.1.1, framer-motion@^12.42.2, leaflet@^1.9.4, @radix-ui/react-aspect-ratio@^1.1.8, @radix-ui/react-dialog@^1.1.15, @radix-ui/react-hover-card@^1.1.15, @radix-ui/react-menubar@^1.1.16 (+22 more)

### Community 21 - "Notifications Bell"
Cohesion: 0.14
Nodes (25): NotificationsBell(), typeIcon(), adminNotificationsKeys, formatNotificationTime(), formatUnreadBadge(), getAdminNotificationsUnreadCount(), listAdminNotifications(), markAdminNotificationRead() (+17 more)

### Community 22 - "Inventory API Contract Doc"
Cohesion: 0.08
Nodes (31): GET /api/admin/inventory/categories/, Inventory frontend wiring status, Inventory Module API Contract, PATCH /api/admin/inventory/items/{id}/stock/, Item master and stock separation, POST /api/admin/inventory/items/, GET /api/admin/inventory/items/, Stock badge logic (Out/Low/In Stock) (+23 more)

### Community 23 - "Account Status & Hall Images"
Cohesion: 0.27
Nodes (23): sonner, AccountStatusToggle(), deactivateMessage(), ACCEPT, HallImagesTab(), drop(), remove(), OutletToggle() (+15 more)

### Community 24 - "Hall Form"
Cohesion: 0.12
Nodes (22): Field(), HallForm(), slugify(), SelectContent, SelectItem, SelectScrollDownButton, SelectScrollUpButton, SelectTrigger (+14 more)

### Community 25 - "Store Keepers"
Cohesion: 0.12
Nodes (28): EMPTY_DOCUMENTS, formatAssignedStore(), formatStoreKeeperDate(), formatStoreKeeperPhone(), getStoreKeeper(), normalizeStoreKeeper(), REJECT_FIELD_LABELS, reviewStoreKeeper() (+20 more)

### Community 26 - "Lint Config"
Cohesion: 0.08
Nodes (29): devDependencies, eslint@^9.32.0, eslint-config-prettier@^10.1.1, @eslint/js@^9.32.0, eslint-plugin-prettier@^5.2.6, eslint-plugin-react-hooks@^5.2.0, eslint-plugin-react-refresh@^0.4.20, globals@^15.15.0 (+21 more)

### Community 27 - "Customer Coins"
Cohesion: 0.13
Nodes (24): AdjustErrors, AdjustField, AdjustForm, CustomerCoinsPanel(), reviewAdjust(), submitAdjust(), DirectionButton(), EMPTY_ADJUST (+16 more)

### Community 28 - "Manager Create Form"
Cohesion: 0.12
Nodes (26): EMPTY_ERRORS, FieldError(), ManagerCreateForm(), ManagerPermissions(), Props, PermissionSummary(), ALL_MANAGER_PERMISSIONS, CreatedManager (+18 more)

### Community 29 - "Dashboard Sales"
Cohesion: 0.13
Nodes (24): setBusinessAcceptingOrders(), DashboardCategorySales, DashboardHourlySalesPoint, DashboardSalesTrendPoint, DashboardSplitPoint, CategoryBars(), CHART_COLORS, ChartCard() (+16 more)

### Community 30 - "Managers List"
Cohesion: 0.15
Nodes (24): apply(), useIsSuperAdmin(), formatDate(), ManagersList(), closeDelete(), confirmDelete(), deactivateInstead(), PAGE_SIZES (+16 more)

### Community 31 - "Partner Normalizers"
Cohesion: 0.14
Nodes (23): Textarea, formatRupees(), getPartner(), normalizePartner(), normalizeWallet(), PARTNER_REJECT_FIELDS, partnerRejectFieldLabel(), partnerRejectStepLabel() (+15 more)

### Community 32 - "Menu Categories"
Cohesion: 0.09
Nodes (13): listMenuCategoryOptions(), countRecipeMissingMenuItems(), listMenuItems(), dietaryMark(), dietaryOf(), getMenuFormCopy(), itemPrice(), MenuPage() (+5 more)

### Community 33 - "Mock Data"
Cohesion: 0.08
Nodes (25): banquetEvents, categories, Channel, channelSplit, decorationPackages, drivers, expenses, FloorTable (+17 more)

### Community 34 - "Table QR"
Cohesion: 0.14
Nodes (20): renderControls(), RowActions(), createTable(), deleteTable(), downloadBlob(), getTableQrPng(), listTables(), updateTable() (+12 more)

### Community 35 - "Route Definitions"
Cohesion: 0.08
Nodes (25): Route, Route, Route, Route, Route, Route, Route, Route (+17 more)

### Community 36 - "Campaign Form"
Cohesion: 0.17
Nodes (19): CampaignForm(), buildPayload(), onPickImage(), onRemoveImage(), onSubmit(), submit(), validate(), Field() (+11 more)

### Community 37 - "Partner Listing"
Cohesion: 0.14
Nodes (19): InactiveBadge(), isAccountActive(), formatPartnerDate(), formatPartnerPhone(), listPartners(), partnerStatusLabel(), listStoreKeepers(), storeKeeperStatusLabel() (+11 more)

### Community 38 - "Stat Cards"
Cohesion: 0.13
Nodes (12): SoundStatus(), Props, StatCard(), HoverCardContent, PopoverContent, ResizableHandle(), ResizablePanelGroup(), ScrollArea (+4 more)

### Community 39 - "Menu Recipe Types"
Cohesion: 0.10
Nodes (19): CreateMenuRecipeLine, MenuCategoryOption, MenuDietary, MenuItemImage, MenuRecipeLine, MenuUnit, ADDON_GROUP_OPTIONS, BAKERY_ADDON_GROUP_OPTIONS (+11 more)

### Community 40 - "Components Config"
Cohesion: 0.11
Nodes (18): aliases, components, hooks, lib, ui, utils, iconLibrary, registries (+10 more)

### Community 41 - "Home Service CRUD"
Cohesion: 0.16
Nodes (12): appendField(), createHomeService(), deleteHomeService(), listHomeServices(), updateHomeService(), ActiveFilter, EMPTY_FORM, FormState (+4 more)

### Community 42 - "TS Config"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+10 more)

### Community 43 - "Business Invoice Details"
Cohesion: 0.20
Nodes (15): BusinessCard(), BusinessInvoiceDetailsPanel(), CONFLICT_FIELD, FormField(), INVOICE_BUSINESS_TYPES, InvoiceDetailsDialog(), onSubmit(), Row (+7 more)

### Community 44 - "API Client & Activity"
Cohesion: 0.17
Nodes (16): emit(), listeners, trackedFetch(), apiBinaryRequest(), apiFileDownload(), BinaryRequestOptions, fetchBinaryResponse(), formatValidationDetails() (+8 more)

### Community 45 - "Menu API"
Cohesion: 0.12
Nodes (16): formatRecipeQuantity(), ITEM_CODE_PATTERN, menuImageUrl(), MenuItemsPage, menuItemToSummary(), RECIPE_REQUIRED_MESSAGE, recipeUnitOptions(), TAX_OPTIONS (+8 more)

### Community 46 - "Customer Picker"
Cohesion: 0.17
Nodes (15): CustomerPicker(), toggle(), PickedCustomer, toPicked(), COIN_ADJUST_MAX, COIN_ENTRY_LABELS, COIN_NOTE_MAX, formatCustomerPhone() (+7 more)

### Community 47 - "Docker Compose"
Cohesion: 0.12
Nodes (15): build, container_name, environment, image, ports, restart, VITE_API_BASE_URL, args (+7 more)

### Community 48 - "Error Capture"
Cohesion: 0.22
Nodes (10): @tanstack/react-start@^1.168.26, @tanstack/react-start, consumeLastCapturedError(), renderErrorPage(), fetch(), getServerEntry(), isH3SwallowedErrorBody(), normalizeCatastrophicSsrResponse() (+2 more)

### Community 49 - "Pickup Map"
Cohesion: 0.18
Nodes (12): DEFAULT_CENTER, formatPlaceLabel(), LeafletNS, parseCoordPair(), parseTypedCoords(), PickupMap(), onSearchKeyDown(), runSearch() (+4 more)

### Community 50 - "Hall Blackouts"
Cohesion: 0.25
Nodes (13): class-variance-authority, HallBlackoutsTab(), add(), remove(), todayISO(), Alert, AlertDescription, AlertTitle (+5 more)

### Community 51 - "Build Tooling"
Cohesion: 0.14
Nodes (11): @tailwindcss/vite@^4.2.1, vite-tsconfig-paths@^6.0.2, nitro@3.0.260603-beta, vite@^8.0.16, @vitejs/plugin-react@^5.2.0, nitro, @tailwindcss/vite, vite (+3 more)

### Community 52 - "App Sidebar"
Cohesion: 0.22
Nodes (11): zustand, AppSidebar(), bookingLabels, menuLabels, nav, KitchenAlertsState, useKitchenAlerts, isRouteAllowed() (+3 more)

### Community 53 - "Carousel UI"
Cohesion: 0.19
Nodes (13): Carousel, CarouselApi, CarouselContent, CarouselContext, CarouselContextProps, CarouselItem, CarouselNext, CarouselOptions (+5 more)

### Community 54 - "Order Mock Data"
Cohesion: 0.20
Nodes (13): inventory, inventoryAvailable(), inventoryStock, menuItems, Order, orders, getPanelMeta(), panelLabel() (+5 more)

### Community 55 - "Partners API"
Cohesion: 0.15
Nodes (12): EMPTY_DOCUMENTS, REJECT_FIELD_LABELS, REJECT_STEP_LABELS, PartnerCashReceipt, PartnerDetail, PartnerListData, PartnerListParams, PartnerRejectField (+4 more)

### Community 56 - "Auth State"
Cohesion: 0.29
Nodes (13): canCheckPersistedAuth(), getSelectedPanel(), isAuthenticated(), isBrowser(), mustChangePassword(), readPersistedAuthState(), Route, Route (+5 more)

### Community 57 - "Form UI"
Cohesion: 0.23
Nodes (10): FormControl, FormDescription, FormFieldContext, FormFieldContextValue, FormItem, FormItemContext, FormItemContextValue, FormLabel (+2 more)

### Community 58 - "Campaigns API"
Cohesion: 0.20
Nodes (11): listCampaignRecipients(), listCampaigns(), previewCampaignAudience(), qs(), CampaignAudiencePreviewData, CampaignAudiencePreviewPayload, CampaignListData, CampaignListParams (+3 more)

### Community 59 - "Community 59"
Cohesion: 0.27
Nodes (10): ChartConfig, ChartContainer, ChartContext, ChartContextProps, ChartLegendContent, ChartStyle(), ChartTooltipContent, getPayloadConfigFromPayload() (+2 more)

### Community 60 - "Community 60"
Cohesion: 0.20
Nodes (9): Command, CommandDialog(), CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator (+1 more)

### Community 61 - "Community 61"
Cohesion: 0.27
Nodes (9): can(), canWith(), isRouteVisible(), isSuper(), open, ROUTE_RULES, RouteRule, ruleFor() (+1 more)

### Community 62 - "Community 62"
Cohesion: 0.33
Nodes (7): BootSplash(), GlobalProgress(), Phase, Toaster(), ToasterProps, usePendingRequests(), AppLayout()

### Community 63 - "Community 63"
Cohesion: 0.24
Nodes (9): ButtonProps, Pagination(), PaginationContent, PaginationEllipsis(), PaginationItem, PaginationLink(), PaginationLinkProps, PaginationNext() (+1 more)

### Community 64 - "Community 64"
Cohesion: 0.20
Nodes (8): BusinessType, Branch, branches, PANEL_META, PANEL_ORDER, PanelMeta, PANELS, PanelStat

### Community 65 - "Community 65"
Cohesion: 0.24
Nodes (10): detailToForm(), emptyRecipeLine(), addAddonGroup(), addAddonOption(), addRecipeLine(), addVariant(), numToStr(), recipeFromDetail() (+2 more)

### Community 66 - "Community 66"
Cohesion: 0.31
Nodes (7): @radix-ui/react-toggle@^1.1.10, @radix-ui/react-toggle, ToggleGroup, ToggleGroupContext, ToggleGroupItem, Toggle, toggleVariants

### Community 67 - "Community 67"
Cohesion: 0.25
Nodes (8): scripts, build, build:dev, dev, format, lint, preview, start

### Community 68 - "Community 68"
Cohesion: 0.29
Nodes (6): DrawerContent, DrawerDescription, DrawerFooter(), DrawerHeader(), DrawerOverlay, DrawerTitle

### Community 69 - "Community 69"
Cohesion: 0.32
Nodes (7): NavigationMenu, NavigationMenuContent, NavigationMenuIndicator, NavigationMenuList, NavigationMenuTrigger, navigationMenuTriggerStyle, NavigationMenuViewport

### Community 71 - "Community 71"
Cohesion: 0.29
Nodes (7): createMenuItem(), isRecipeValid(), normalizeItemCode(), fieldErrorFromDetails(), itemCodeError(), buildRecipePayload(), saveProduct()

### Community 72 - "Community 72"
Cohesion: 0.29
Nodes (7): deleteMenuItem(), getMenuItem(), scopedQuery(), updateMenuItem(), confirmDelete(), setBulkAvail(), toggleItemAvailability()

### Community 73 - "Community 73"
Cohesion: 0.40
Nodes (6): listInventoryItems(), emptyForm(), clearImages(), loadInventoryOptions(), openAdd(), openEdit()

### Community 74 - "Community 74"
Cohesion: 0.40
Nodes (4): InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot

### Community 75 - "Community 75"
Cohesion: 0.40
Nodes (4): getRouter(), Register, routeTree, startInstance

### Community 76 - "Community 76"
Cohesion: 0.70
Nodes (5): TanStack Start file-based routing, __root.tsx root layout, Route file naming conventions, routeTree.gen.ts (auto-generated), Routes README

## Knowledge Gaps
- **12 isolated node(s):** `Inventory frontend wiring status`, `Login and access module`, `POS / Billing module`, `Customer Levels (reward tiers)`, `Marketing module` (+7 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 505 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `Accordion/Breadcrumb UI` to `Orders Socket Hooks`, `Invoice Document`, `Hall Booking Drawer`, `Hall Form Payloads`, `Row Actions & Avatar`, `Offers API & Form Requests`, `Booking Settings & Tabs`, `Inventory API`, `Reward Rules`, `Campaign Badges`, `Analytics API`, `Sheet/Separator UI`, `Auth Shell`, `Reward Tiers`, `Notifications Bell`, `Account Status & Hall Images`, `Hall Form`, `Store Keepers`, `Customer Coins`, `Dashboard Sales`, `Managers List`, `Partner Normalizers`, `Table QR`, `Campaign Form`, `Partner Listing`, `Stat Cards`, `Home Service CRUD`, `Business Invoice Details`, `Hall Blackouts`, `App Sidebar`, `Carousel UI`, `Form UI`, `Community 59`, `Community 60`, `Community 63`, `Community 66`, `Community 68`, `Community 69`, `Community 74`, `Community 78`?**
  _High betweenness centrality (0.172) - this node is a cross-community bridge._
- **What connects `Inventory frontend wiring status`, `Login and access module`, `POS / Billing module` to the rest of the system?**
  _12 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Orders Socket Hooks` be split into smaller, more focused modules?**
  _Cohesion score 0.051433251433251434 - nodes in this community are weakly interconnected._
- **Why does `withAuthRetry()` connect `Hall Form Payloads` to `Orders Socket Hooks`, `Invoice Document`, `Hall Booking Drawer`, `Row Actions & Avatar`, `Offers API & Form Requests`, `Booking Settings & Tabs`, `Inventory API`, `Reward Rules`, `Campaign Badges`, `Analytics API`, `Auth Shell`, `Business Profile Form`, `Reward Tiers`, `Notifications Bell`, `Account Status & Hall Images`, `Hall Form`, `Store Keepers`, `Customer Coins`, `Manager Create Form`, `Dashboard Sales`, `Managers List`, `Partner Normalizers`, `Menu Categories`, `Table QR`, `Campaign Form`, `Partner Listing`, `Menu Recipe Types`, `Home Service CRUD`, `Business Invoice Details`, `Customer Picker`, `Hall Blackouts`, `Community 71`, `Community 72`, `Community 73`?**
  _High betweenness centrality (0.077) - this node is a cross-community bridge._
- **Should `Home Services & Tables API` be split into smaller, more focused modules?**
  _Cohesion score 0.02653854953099977 - nodes in this community are weakly interconnected._
- **Why does `react` connect `Auth Shell` to `Orders Socket Hooks`, `Invoice Document`, `Hall Booking Drawer`, `Accordion/Breadcrumb UI`, `Hall Form Payloads`, `Row Actions & Avatar`, `Offers API & Form Requests`, `Booking Settings & Tabs`, `Inventory API`, `Reward Rules`, `Campaign Badges`, `Analytics API`, `Sheet/Separator UI`, `UI Dependencies`, `Business Profile Form`, `Reward Tiers`, `Package Dependencies`, `Notifications Bell`, `Account Status & Hall Images`, `Hall Form`, `Store Keepers`, `Customer Coins`, `Manager Create Form`, `Dashboard Sales`, `Managers List`, `Partner Normalizers`, `Table QR`, `Campaign Form`, `Partner Listing`, `Stat Cards`, `Menu Recipe Types`, `Home Service CRUD`, `Business Invoice Details`, `API Client & Activity`, `Customer Picker`, `Pickup Map`, `Hall Blackouts`, `Carousel UI`, `Order Mock Data`, `Form UI`, `Community 59`, `Community 60`, `Community 62`, `Community 63`, `Community 66`, `Community 68`, `Community 69`, `Community 70`, `Community 74`, `Community 78`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Should `Invoice Document` be split into smaller, more focused modules?**
  _Cohesion score 0.057631257631257635 - nodes in this community are weakly interconnected._