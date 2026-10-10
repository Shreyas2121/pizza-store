# Loading UI

Use the shared exports from `@/shared/ui`. Initial loading should reserve the shape of the eventual content. Do not replace populated content with skeletons during a background fetch.

| Content | Shared component |
| --- | --- |
| Product grids | `ProductGridSkeleton` |
| Cards, metrics, addresses, offers | `CardGridSkeleton` (set count, height and grid classes to match) |
| Tables | `TableSkeleton` (set `toolbar={false}` inside panels with existing controls) |
| Order history, queues and receipt lists | `ListSkeleton` |
| Drawers, modal details, document text | `PanelSkeleton` |
| Forms | `PanelSkeleton form` |
| Reports and charts | `ReportSkeleton`, `ChartSkeleton` |
| Detail screens, cart, checkout and profile | `DetailsPageSkeleton`, `CartSkeleton`, `CheckoutSkeleton`, `ProfileSkeleton` |
| Lazy routes and access checks | `RouteSkeleton` |
| Background fetches | `RefreshIndicator` or an existing inline refresh status, alongside cached content |

Use `query.isLoading` for initial requests; `isPending` also covers disabled queries waiting for an input and can leave skeletons displayed indefinitely. For a deliberately enabled query, `isPending` is appropriate. Never use `isFetching` alone to decide whether to hide existing content. Retain error and retry states.

`LoadingRegion` provides the status announcement and hides decorative placeholders from screen readers. Pass a specific label when the page has several loading regions. Reduced-motion preferences disable skeleton and refresh animations in `src/index.css`. Action and compact field indicators use dots through the Mantine theme; they stay attached to their controls.

The destination layout mapping lives in `src/shared/ui/route-loading.ts`. Set `contained` when the surrounding layout supplies page spacing; set `admin` for staff layouts. Add new route shapes there when the default table layout does not apply. Route tests derive absolute paths from the router and check their skeleton fallbacks.

## Page audit

All routed feature pages and their loading subcomponents were reviewed.

| Pages | Initial loading |
| --- | --- |
| Home, offers and offer products | Menu/product skeletons; offer card skeletons |
| Public store details | Detail panel |
| Cart, checkout | Cart/detail layouts |
| Profile, addresses | Profile/form and address cards |
| Customer orders, order details | Lists and detail layouts |
| Admin dashboard | Metrics, charts and recent-order list |
| Categories, products, bundles, customizations, menu | Cards, product tables, bundle form, customization/menu lists |
| Admin orders, order details | Tables and detail layouts |
| Stores, store products, delivery zones, staff, audit | Tables |
| Inventory and detail drawers | Table, detail panel and movement history table |
| Promotions, store promotions, rules, analytics | Tables, definition/target panels and metrics |
| Finance tabs | Reports, tables, queues, detail panels and private receipt lists |
| Payroll runs, profiles, compensation, statements | Table, profile selector form and detail panels |
| Support queue and conversations | Table and message placeholders |
| All documentation pages and diagrams | Document/diagram panels |
| New product, payment reconciliation, system maintenance, staff invitation | Static forms; route skeleton while code loads, dots while submitting |
| Not-found pages | Static content; no data loader |

Unit coverage verifies route fallbacks, status accessibility, background refresh behavior and the global dots default. The current audit ran the frontend suite and build, but did not rerun browser viewport/reduced-motion checks. Rehearse representative loading states at 320px, 390px and 1440px before publication; shared-layout coverage does not establish every authenticated page end to end.
