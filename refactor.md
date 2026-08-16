# Frontend feature-first architecture refactor

## 1. Goal

Refactor `frontend/src` from technical top-level buckets such as `components`, `pages`, `hooks`, `layouts`, `lib`, and `store` into a feature-first architecture.

The desired outcome is that a developer working on products, orders, checkout, support, or account management can find the feature's page, components, API hooks, schemas, types, state, and utilities in one place. Truly cross-application infrastructure remains global, but global code must have a clear role and must not become a miscellaneous dumping ground.

This is an organizational refactor first. It should not intentionally change routes, API contracts, UI behavior, or styling. Functional changes should be separate commits unless a tiny correction is required to complete a move.

## 2. Why the current structure should change

The current folders answer “what kind of file is this?” but not “what business capability owns this file?” For example, the order feature is currently spread across:

- `pages/main/profile/orders.tsx`
- `pages/main/profile/order-details.tsx`
- `pages/admin/orders/*`
- `components/main/orders/*`
- `components/admin/order/*`
- `components/common/order-*`
- `hooks/order.ts`
- order types in `lib/types.ts`
- order status constants in `lib/constants.ts`

That increases navigation time, makes ownership unclear, encourages broad barrel imports, and makes accidental coupling easy. The large global `@/lib`, `@/hooks`, and component barrels also hide where a dependency comes from.

A feature-first structure keeps code that changes together close together.

## 3. Architectural model

Use three top-level architectural layers:

```text
src/
├── app/                 # Application assembly and runtime composition
├── features/            # Business capabilities
├── shared/              # Business-agnostic reusable building blocks
├── assets/              # Truly global static assets
├── index.css            # Global CSS entry and design tokens
├── main.tsx             # Browser entry point only
└── vite-env.d.ts
```

The dependency direction is one-way:

```text
app  ───────>  features  ───────>  shared
 │                                 ▲
 └─────────────────────────────────┘
```

Rules:

1. `shared` must not import from `features` or `app`.
2. `features` may import from `shared`.
3. A feature must not reach into another feature's internal folders.
4. Cross-feature imports must use that feature's public entry point.
5. `app` may compose features and shared infrastructure.
6. Route definitions, providers, top-level error handling, and application shells belong to `app`.
7. Business-specific components, hooks, schemas, types, state, and route pages belong to their feature.

## 4. Recommended target tree

```text
frontend/src/
├── app/
│   ├── layouts/
│   │   ├── admin-layout.tsx
│   │   ├── main-layout.tsx
│   │   └── profile-layout.tsx
│   ├── providers/
│   │   ├── app-providers.tsx
│   │   ├── query-provider.tsx
│   │   └── socket-provider.tsx
│   ├── router/
│   │   ├── guards/
│   │   │   ├── admin-route.tsx
│   │   │   └── protected-route.tsx
│   │   ├── route-fallback.tsx
│   │   └── routes.tsx
│   ├── app.tsx
│   └── index.ts
│
├── features/
│   ├── auth/
│   ├── account/
│   ├── catalog/
│   ├── cart/
│   ├── checkout/
│   ├── orders/
│   ├── support/
│   ├── admin-dashboard/
│   └── admin-navigation/
│
├── shared/
│   ├── api/
│   ├── config/
│   ├── ui/
│   ├── lib/
│   ├── model/
│   ├── types/
│   └── assets/
│
├── assets/
├── index.css
├── main.tsx
└── vite-env.d.ts
```

The root should stay intentionally small. Do not retain global `components`, `pages`, `hooks`, `layouts`, `store`, or `lib` directories after migration.

## 5. Standard feature anatomy

Not every feature needs every folder. Create only the folders a feature actually uses.

```text
features/orders/
├── api/
│   ├── order.api.ts
│   ├── order.keys.ts
│   └── order.queries.ts
├── components/
│   ├── order-address.tsx
│   ├── order-items.tsx
│   ├── order-status.tsx
│   └── order-summary.tsx
├── pages/
│   ├── customer-orders-page.tsx
│   ├── customer-order-details-page.tsx
│   ├── admin-orders-page.tsx
│   └── admin-order-details-page.tsx
├── admin/
│   └── components/
│       └── order-columns.tsx
├── model/
│   ├── order.constants.ts
│   ├── order.schema.ts
│   └── order.types.ts
├── lib/
│   └── get-next-order-action.ts
└── index.ts
```

Folder responsibilities:

- `api/`: request functions, query keys, TanStack Query hooks, response adapters.
- `components/`: UI owned by this feature and reusable within it.
- `pages/`: route-level components. Pages compose feature components and invoke feature APIs.
- `model/`: domain types, schemas, constants, selectors, and feature-owned client state.
- `lib/`: pure helpers that are meaningful only within the feature.
- `admin/` or `customer/`: optional presentation subdivisions when both roles use the same domain.
- `index.ts`: the feature's deliberately small public API.

Do not create generic folders like `helpers`, `misc`, or `common` inside every feature.

## 6. Proposed feature ownership

### 6.1 `auth`

Owns authentication, session identity, login/register UI, and auth-specific validation.

```text
features/auth/
├── api/
│   └── auth.mutations.ts
├── components/
│   ├── auth-header.tsx
│   ├── login-form.tsx
│   └── register-form.tsx
├── model/
│   ├── auth.schema.ts
│   ├── auth.store.ts
│   └── auth.types.ts
└── index.ts
```

Move here:

- `components/auth/*`
- authentication portions of `hooks/user.ts`
- `store/user.ts`
- `loginSchema`, `registerSchema`, `TLogin`, and `TRegister`
- `User`, `Role`, and session-related types

The public API should expose only what consumers require, for example `LoginForm`, `useAuth`, `useCurrentUser`, and `User`.

### 6.2 `account`

Owns profile and saved-address management.

```text
features/account/
├── api/
│   ├── address.queries.ts
│   └── profile.queries.ts
├── components/
│   ├── address-form.tsx
│   └── profile-navigation.tsx
├── pages/
│   ├── profile-page.tsx
│   └── addresses-page.tsx
├── model/
│   ├── address.schema.ts
│   └── account.types.ts
└── index.ts
```

Move here:

- `components/main/address-form.tsx`
- `components/main/profile/*`
- `pages/main/profile/profile.tsx`
- `pages/main/profile/address.tsx`
- profile/address portions of `hooks/user.ts`
- `Address`, `AddressType`, and address schemas

`ProfileLayout` remains in `app/layouts` because it composes account and order destinations rather than belonging wholly to one feature.

### 6.3 `catalog`

Owns customer product discovery and admin product/menu/customization management. These concepts are tightly related and currently share categories, products, menu sections, images, and assignment flows. Start with one `catalog` feature; split it later only if it becomes independently large.

```text
features/catalog/
├── api/
│   ├── category.queries.ts
│   ├── customization.queries.ts
│   ├── menu.queries.ts
│   ├── product.queries.ts
│   └── catalog.keys.ts
├── components/
│   ├── customer/
│   │   ├── customization-drawer.tsx
│   │   ├── menu-category-rail.tsx
│   │   ├── product-card.tsx
│   │   └── product-grid.tsx
│   └── admin/
│       ├── customization-groups.tsx
│       ├── menu-form.tsx
│       ├── product-assignment.tsx
│       ├── product-columns.tsx
│       └── product-form.tsx
├── pages/
│   ├── home-page.tsx
│   ├── admin-products-page.tsx
│   ├── admin-new-product-page.tsx
│   ├── admin-menu-page.tsx
│   └── admin-customizations-page.tsx
├── model/
│   ├── catalog.schemas.ts
│   ├── catalog.types.ts
│   └── catalog.constants.ts
├── lib/
│   └── product-mappers.ts
└── index.ts
```

Move here:

- `components/main/products/*`
- `components/main/customize.tsx`
- `pages/main/home.tsx`
- `components/admin/products/*`
- `components/admin/menu/*`
- `components/admin/transfer.tsx`
- `pages/admin/products/*`
- `pages/admin/menu/*`
- `pages/admin/customization/*`
- `hooks/products.ts`, `category.ts`, `menu.ts`, and `customize.ts`
- product, category, menu, customization types and schemas

### 6.4 `cart`

Owns cart state, mutations, cart presentation, and cart-specific customization editing.

```text
features/cart/
├── api/
│   └── cart.queries.ts
├── components/
│   ├── cart-item.tsx
│   ├── cart-summary.tsx
│   └── quantity-stepper.tsx
├── pages/
│   └── cart-page.tsx
├── model/
│   └── cart.types.ts
└── index.ts
```

Move `pages/main/cart.tsx`, `hooks/cart.ts`, and cart types here. If cart customization imports catalogue types, import them through `@/features/catalog`, never from a catalogue internal file.

### 6.5 `checkout`

Owns checkout orchestration, coupon application in checkout, payment selection, and order placement UI.

```text
features/checkout/
├── api/
│   ├── checkout.queries.ts
│   ├── coupon.mutations.ts
│   └── payment.mutations.ts
├── components/
│   ├── address-step.tsx
│   ├── coupon-field.tsx
│   ├── payment-step.tsx
│   └── checkout-summary.tsx
├── pages/
│   └── checkout-page.tsx
└── index.ts
```

Move here:

- `pages/main/checkout.tsx`
- `hooks/coupon.ts`
- `hooks/payment.ts`
- checkout-only coupon and payment types

Checkout is an orchestration feature and may consume public APIs from `auth`, `account`, `cart`, and `orders`. Avoid reverse imports from those features back into checkout.

### 6.6 `orders`

Owns the order domain for customer and admin experiences.

Move here:

- `pages/main/profile/orders.tsx`
- `pages/main/profile/order-details.tsx`
- `components/main/orders/*`
- `components/common/order-address.tsx`
- `components/common/order-coupon.tsx`
- `components/common/order-items.tsx`
- `components/common/order-status.tsx`
- `pages/admin/orders/*`
- `components/admin/order/*`
- `hooks/order.ts`
- order, item, payment, coupon, and status types/constants used by orders

The shared order-detail primitives are not globally shared UI; they are domain-owned order components. Both admin and customer pages should consume them from the order feature.

### 6.7 `support`

Owns support request state, socket-backed chat behavior, customer support UI, and the admin queue.

```text
features/support/
├── api/
│   └── support.queries.ts
├── components/
│   ├── chat.tsx
│   ├── customer/
│   │   ├── chat-request-form.tsx
│   │   └── support-action.tsx
│   └── admin/
│       ├── support-actions.tsx
│       ├── support-columns.tsx
│       └── support-status.tsx
├── pages/
│   ├── admin-support-page.tsx
│   └── admin-chat-page.tsx
├── model/
│   ├── support.store.ts
│   └── support.types.ts
└── index.ts
```

Move here:

- `components/common/chat.tsx`
- `components/main/chat/*`
- `components/admin/support/*`
- `pages/admin/support.tsx`
- `pages/admin/admin-chat.tsx`
- `hooks/chat.ts`
- `store/chat.ts`
- chat and support types/constants

### 6.8 `admin-dashboard`

Owns dashboard metrics, date-range state, charts, and dashboard page composition.

Move here:

- `components/admin/dashboard/*`
- `pages/admin/home.tsx`
- `hooks/dashboard.ts`
- `store/datepicker.ts`
- dashboard types and period constants

### 6.9 `admin-navigation`

Owns admin sidebar configuration and presentation, but not `AdminLayout` itself.

Move here:

- `components/admin/sidebar.tsx`
- `sidebarLinks`

`AdminLayout` in `app/layouts` imports the public `AdminSidebar` export from this feature.

## 7. What remains global

Global code should be business-agnostic and useful to multiple unrelated features.

### 7.1 `app`

`app` owns application assembly:

- root `App`
- router and route guards
- application providers
- main, profile, and admin layouts
- global modal mounting
- global error boundary mounting
- socket connection lifecycle if it truly spans features
- Mantine and TanStack Query provider configuration

`main.tsx` should only mount `<AppProviders><App /></AppProviders>`.

### 7.2 `shared/api`

```text
shared/api/
├── api-client.ts
├── create-query.ts
├── create-mutation.ts
└── index.ts
```

Move `lib/axios.ts` and `hooks/useApi.ts` here. The API client must not depend directly on feature internals. Authentication token injection can use a small session adapter exposed by auth, or the token can be supplied through a provider. During the first migration pass, the existing store access may remain temporarily and should be documented as a dependency exception.

### 7.3 `shared/ui`

Only generic visual primitives belong here:

```text
shared/ui/
├── data-table/
│   ├── data-table.tsx
│   ├── data-table-pagination.tsx
│   ├── data-table-search.tsx
│   └── index.ts
├── empty-state.tsx
├── error-boundary.tsx
├── global-modal.tsx
├── page-header.tsx
├── skeletons.tsx
└── index.ts
```

Move here:

- `components/table/*`
- `components/common/empty-state.tsx`
- `components/common/error-boundary.tsx`
- `components/common/global-modal.tsx`
- `components/common/page-header.tsx`
- generic skeletons

Do not move order, product, cart, account, or support components into `shared/ui`. Reuse across admin and customer screens does not automatically make a component global; shared domain ownership is still feature ownership.

### 7.4 `shared/lib`

Pure, domain-neutral helpers only:

- `cn`
- generic string capitalization if retained
- generic date helpers
- generic notification wrappers

`formatPrice` may live in `shared/lib/format-price.ts` because price display crosses catalogue, cart, checkout, and orders and has no feature-specific behavior.

### 7.5 `shared/config`

Owns environment and visual configuration:

```text
shared/config/
├── env.ts
├── routes.ts
├── theme.ts
└── design-tokens.ts
```

- Validate and export `VITE_BACKEND_URL` from `env.ts`.
- Keep design tokens and Mantine theme configuration here.
- Route path constants may live here if they are used widely; otherwise keep paths close to router definitions.

Do not keep all feature constants in one global `constants.ts`.

### 7.6 `shared/model`

Generic app-wide UI state only. The modal store can live here if the global modal remains store-driven:

```text
shared/model/modal.store.ts
```

Auth, support sockets, dashboard dates, and other business state must remain inside their owning features.

## 8. Public API and barrel rules

Each feature may have one root `index.ts`. It is an explicit contract, not an automatic export of every file.

Good:

```ts
// features/orders/index.ts
export { CustomerOrdersPage } from "./pages/customer-orders-page";
export { CustomerOrderDetailsPage } from "./pages/customer-order-details-page";
export { AdminOrdersPage } from "./pages/admin-orders-page";
export { AdminOrderDetailsPage } from "./pages/admin-order-details-page";
export { OrderStatus } from "./components/order-status";
export { useOrders, useOrder } from "./api/order.queries";
export type { Order, OrderStatusValue } from "./model/order.types";
```

Avoid:

```ts
export * from "./api";
export * from "./components";
export * from "./model";
```

Broad wildcard barrels make private implementation details public, increase circular dependency risk, weaken tree-shaking visibility, and make symbol ownership hard to discover.

Within a feature, use relative imports for nearby internal modules:

```ts
import { OrderItems } from "../components/order-items";
```

Outside a feature, use the feature public API:

```ts
import { OrderStatus, type Order } from "@/features/orders";
```

Never use an external deep import such as:

```ts
import { OrderStatus } from "@/features/orders/components/order-status";
```

The same rule applies to `shared`: use focused entry points such as `@/shared/ui`, `@/shared/api`, and `@/shared/lib`, not a single giant `@/shared` barrel.

## 9. Query and API organization

Replace the global `QUERY_KEYS` object with keys owned by each feature.

```ts
// features/orders/api/order.keys.ts
export const orderKeys = {
  all: ["orders"] as const,
  lists: () => [...orderKeys.all, "list"] as const,
  list: (status?: string) => [...orderKeys.lists(), { status }] as const,
  details: () => [...orderKeys.all, "detail"] as const,
  detail: (id: number) => [...orderKeys.details(), id] as const,
  adminLists: () => [...orderKeys.all, "admin-list"] as const,
  adminList: (status: string) => [...orderKeys.adminLists(), status] as const,
};
```

Prefer separating raw API calls from React Query hooks when a feature grows:

```ts
// order.api.ts
export const getOrder = async (id: number): Promise<OrderResponse> => {
  const response = await apiClient.get(`/order/${id}`);
  return response.data.data;
};

// order.queries.ts
export const useOrder = (id: number) =>
  useQuery({
    queryKey: orderKeys.detail(id),
    queryFn: () => getOrder(id),
    enabled: Number.isInteger(id) && id > 0,
  });
```

Recommended naming:

- `useOrders`, not `useGetOrders`
- `useCreateProduct`, `useUpdateOrderStatus`
- `productKeys`, `orderKeys`, `supportKeys`
- `getProducts`, `createProduct` for non-hook request functions

The current names can remain during file moves and be renamed in a later cleanup commit to keep diffs reviewable.

## 10. Types and schemas

Split `lib/types.ts` by domain. A large shared type file makes unrelated features appear coupled.

Examples:

- `features/auth/model/auth.types.ts`: `User`, `Role`
- `features/account/model/account.types.ts`: `Address`, `AddressType`
- `features/catalog/model/catalog.types.ts`: `Product`, `Category`, `MenuItem`, customization types
- `features/cart/model/cart.types.ts`: `Cart`, `CartItem`, `CartResponse`
- `features/orders/model/order.types.ts`: `Order`, `OrderItem`, `Payment`, order response types
- `features/support/model/support.types.ts`: `ChatSession`, `Message`, `ChatStatus`
- `features/admin-dashboard/model/dashboard.types.ts`: dashboard cards and grouping types

Place Zod schemas beside the domain they validate. Infer form types from those schemas in the same feature.

Avoid duplicating backend entity shapes blindly. Use UI/API-specific names where useful:

```ts
type ProductListItem = { ... };
type ProductFormValues = z.infer<typeof productFormSchema>;
type ProductResponse = { ... };
```

This distinguishes database concepts from transport and form models.

## 11. Routing and page composition

Routes remain centralized in `app/router/routes.tsx` because route topology is application composition. Route page components live inside features.

Use relative nested route paths where possible:

```tsx
<Route path="admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
  <Route index element={<AdminDashboardPage />} />
  <Route path="products" element={<AdminProductsPage />} />
  <Route path="products/new" element={<AdminNewProductPage />} />
  <Route path="customizations" element={<AdminCustomizationsPage />} />
  <Route path="menu" element={<AdminMenuPage />} />
  <Route path="orders" element={<AdminOrdersPage />} />
  <Route path="orders/:id" element={<AdminOrderDetailsPage />} />
  <Route path="support" element={<AdminSupportPage />} />
  <Route path="support/:userId" element={<AdminChatPage />} />
</Route>
```

The current public URLs should initially remain unchanged to avoid mixing a routing migration with file movement. Normalizing singular paths such as `/admin/product/new` and `/admin/order/:id` can be a follow-up with redirects for old URLs.

Prefer lazy-loading route pages at the route boundary:

```ts
const AdminProductsPage = lazy(() =>
  import("@/features/catalog").then((module) => ({
    default: module.AdminProductsPage,
  }))
);
```

If named-export lazy imports become noisy, each route page may default-export while other feature APIs remain named exports.

Move `ProtectedRoutes` and `AdminProtectedRoute` out of `routes.tsx` into `app/router/guards`. Their behavior should not be duplicated in layouts.

## 12. Layout ownership

Layouts belong to `app` when they provide a shell across multiple features:

- `MainLayout`: catalogue, cart, checkout, account, and orders
- `ProfileLayout`: account and customer orders
- `AdminLayout`: dashboard, catalogue administration, orders, and support

Shell-specific pieces can still be feature-owned:

- storefront navbar/footer/brand lockup can live under `features/storefront-shell`
- admin sidebar can live under `features/admin-navigation`

If these folders feel too granular, place shell-only components directly under `app/layouts/components`. The important rule is that they must not go back into an unowned global `components/main` or `components/admin` bucket.

Recommended pragmatic choice for this repository:

```text
app/layouts/
├── components/
│   ├── admin-sidebar.tsx
│   ├── brand-lockup.tsx
│   ├── storefront-footer.tsx
│   └── storefront-navbar.tsx
├── admin-layout.tsx
├── main-layout.tsx
└── profile-layout.tsx
```

This is simpler than creating `admin-navigation` and `storefront-shell` features while those areas remain small.

## 13. State management rules

State should live at the narrowest valid scope:

1. Component-only interaction state stays in the component.
2. URL-relevant state uses route/search parameters.
3. Server state uses TanStack Query.
4. Cross-component feature state may use a feature-local Zustand store.
5. Truly app-global UI state may live in `shared/model` or an app provider.

Current store destinations:

| Current store | Target | Reason |
|---|---|---|
| `store/user.ts` | `features/auth/model/auth.store.ts` | Authentication domain state |
| `store/chat.ts` | `features/support/model/support.store.ts` | Support/socket session state |
| `store/datepicker.ts` | `features/admin-dashboard/model/dashboard-date.store.ts` | Dashboard-only state |
| `store/modal.ts` | `shared/model/modal.store.ts` | Generic application UI service |

Do not create a new global `stores` barrel that exports every feature's state.

## 14. Naming conventions

Use predictable names:

- Files: lowercase kebab-case, such as `product-form.tsx` and `order.queries.ts`.
- Route components: `*-page.tsx`.
- React components: PascalCase.
- Hooks: `useSomething`.
- Query files: `<domain>.queries.ts`.
- Raw request files: `<domain>.api.ts`.
- Query key files: `<domain>.keys.ts`.
- Zustand stores: `<domain>.store.ts`.
- Zod schemas: `<domain>.schema.ts`.
- Types: `<domain>.types.ts`.
- Pure helpers: a descriptive action such as `format-price.ts` or `get-order-status-meta.ts`.

Avoid ambiguous names such as `index2`, `utils2`, `data`, `common`, `main`, `Comp`, or abbreviations such as `OrdersA` and `OrderDetailsA`. Prefer `AdminOrdersPage` and `AdminOrderDetailsPage`.

## 15. Import alias policy

The existing `@/* -> src/*` alias is sufficient. Add optional focused aliases only if they improve clarity and are configured in both TypeScript and Vite.

Recommended imports:

```ts
import { apiClient } from "@/shared/api";
import { DataTable, PageHeader } from "@/shared/ui";
import { formatPrice } from "@/shared/lib";
import { useCurrentUser } from "@/features/auth";
import { OrderStatus } from "@/features/orders";
```

Do not add many aliases such as `@components`, `@hooks`, `@pages`, and `@utils`; those preserve the old technical-bucket architecture under shorter names.

## 16. Dependency boundaries and cycle prevention

Enforce these boundaries during review and eventually through ESLint:

```text
shared  X--> features
shared  X--> app
feature X--> another feature's internals
feature X--> app
```

When two features need each other:

1. Check whether one is actually orchestration. Checkout can consume cart and account without cart consuming checkout.
2. Move only genuinely domain-neutral code to `shared`.
3. Expose a narrow type or hook through the owning feature's public API.
4. If both directions remain necessary, compose them in `app` instead of creating a cycle.

Do not solve cycles by moving business code into `shared` merely because both sides import it.

An ESLint boundary rule can be added after the move using `eslint-plugin-boundaries` or `no-restricted-imports`.

## 17. Testing placement

Co-locate unit/component tests with their owner:

```text
features/orders/components/
├── order-status.tsx
└── order-status.test.tsx
```

Place broader feature integration tests in `features/<feature>/tests`. End-to-end tests remain in a top-level frontend test directory such as `frontend/e2e` because they cross feature boundaries.

Tests should import public APIs when testing feature integration and may import internal modules when unit-testing that module directly.

## 18. Migration strategy

Do not move everything in one unreviewable commit. Use small vertical migrations while keeping the app functional.

### Phase 0 — Establish rules

1. Create `app`, `features`, and `shared` directories.
2. Add a short architecture note linking to this document.
3. Keep the current alias.
4. Do not add compatibility aliases for old folders.
5. Agree that new business code must use the target structure immediately.

### Phase 1 — Extract shared infrastructure

Move first because every feature depends on it:

1. `lib/axios.ts` → `shared/api/api-client.ts`
2. `hooks/useApi.ts` → focused helpers in `shared/api`
3. generic `lib/utils.ts` functions → `shared/lib`
4. theme/tokens/environment constants → `shared/config`
5. `components/table/*` → `shared/ui/data-table`
6. generic common UI → `shared/ui`
7. modal store → `shared/model`

Update imports immediately after each group. Avoid leaving duplicate source files.

### Phase 2 — Move app composition

1. `App.tsx` → `app/app.tsx`
2. `routes.tsx` → `app/router/routes.tsx`
3. route guards → `app/router/guards`
4. layouts → `app/layouts`
5. navbar/footer/sidebar shell components → `app/layouts/components`
6. provider creation from `main.tsx` → `app/providers`
7. reduce `main.tsx` to mounting the application

### Phase 3 — Migrate low-coupling features

Move features with relatively clear boundaries first:

1. `auth`
2. `admin-dashboard`
3. `support`

For each feature:

1. Create its target folders.
2. Move types and schemas.
3. Move API hooks and query keys.
4. Move components.
5. Move pages.
6. Create a narrow `index.ts`.
7. Update outside imports to use the feature public API.
8. Remove old barrels and empty directories.

### Phase 4 — Migrate commerce features

Recommended order based on dependencies:

1. `catalog`
2. `cart`
3. `account`
4. `orders`
5. `checkout`

Checkout goes last because it orchestrates the most other domains.

### Phase 5 — Remove compatibility structure

1. Delete old `components`, `pages`, `hooks`, `layouts`, `lib`, and `store` directories once empty.
2. Remove broad legacy barrels.
3. Search for old import prefixes.
4. Rename unclear symbols in a separate cleanup pass.
5. Add import-boundary lint rules.
6. Document the final tree in the frontend README.

## 19. Per-feature migration checklist

Use this checklist for every feature:

- [ ] Identify all pages, components, hooks, types, schemas, stores, constants, and helpers owned by the feature.
- [ ] Identify imports into and out of the feature.
- [ ] Decide its public API before moving files.
- [ ] Move domain types and schemas first.
- [ ] Move API/query code second.
- [ ] Move components and pages last.
- [ ] Replace broad imports with feature/shared public APIs.
- [ ] Confirm the feature does not import from `app`.
- [ ] Confirm `shared` does not import from the feature.
- [ ] Confirm other features do not deep-import its internals.
- [ ] Remove obsolete barrel exports.
- [ ] Remove empty legacy folders.
- [ ] Verify route lazy imports and chunk loading.
- [ ] Verify query invalidation keys after key migration.
- [ ] Verify persisted Zustand state remains compatible before renaming storage keys.

## 20. Concrete old-to-new file map

| Current location | Target owner/location |
|---|---|
| `App.tsx` | `app/app.tsx` |
| `routes.tsx` | `app/router/routes.tsx` |
| `layouts/*` | `app/layouts/*` |
| `components/main/navbar.tsx` | `app/layouts/components/storefront-navbar.tsx` |
| `components/main/footer.tsx` | `app/layouts/components/storefront-footer.tsx` |
| `components/main/brand-lockup.tsx` | `app/layouts/components/brand-lockup.tsx` |
| `components/admin/sidebar.tsx` | `app/layouts/components/admin-sidebar.tsx` |
| `components/common/global-modal.tsx` | `shared/ui/global-modal.tsx` |
| `components/common/error-boundary.tsx` | `shared/ui/error-boundary.tsx` |
| `components/common/page-header.tsx` | `shared/ui/page-header.tsx` |
| `components/common/empty-state.tsx` | `shared/ui/empty-state.tsx` |
| `components/table/*` | `shared/ui/data-table/*` |
| `lib/axios.ts` | `shared/api/api-client.ts` |
| `hooks/useApi.ts` | `shared/api/query-helpers.ts` |
| `lib/utils.ts` | split between `shared/lib/*` files |
| `lib/constants.ts` | split across `shared/config` and feature models |
| `lib/types.ts` | split across feature `model/*.types.ts` files |
| `lib/zodSchema.ts` | split across feature `model/*.schema.ts` files |
| `store/modal.ts` | `shared/model/modal.store.ts` |
| `components/auth/*` | `features/auth/components/*` |
| `store/user.ts` | `features/auth/model/auth.store.ts` |
| `components/main/profile/*` | `features/account/components/*` |
| profile/address pages | `features/account/pages/*` |
| `components/main/products/*` | `features/catalog/components/customer/*` |
| catalogue admin components/pages | `features/catalog/components/admin` and `pages` |
| catalogue hooks | `features/catalog/api/*` |
| `pages/main/cart.tsx` | `features/cart/pages/cart-page.tsx` |
| `hooks/cart.ts` | `features/cart/api/cart.queries.ts` |
| `pages/main/checkout.tsx` | `features/checkout/pages/checkout-page.tsx` |
| coupon/payment hooks | `features/checkout/api/*` |
| all customer/admin order UI | `features/orders/*` |
| `hooks/order.ts` | `features/orders/api/order.queries.ts` |
| all customer/admin chat UI | `features/support/*` |
| `hooks/chat.ts` | `features/support/api/support.queries.ts` |
| `store/chat.ts` | `features/support/model/support.store.ts` |
| dashboard components/page/hook/store | `features/admin-dashboard/*` |
| `pages/main/not-found.tsx` | `app/router/not-found-page.tsx` |

## 21. Example completed imports

An admin order page should look conceptually like this:

```tsx
import { useState } from "react";
import { Select } from "@mantine/core";
import { DataTable, PageHeader } from "@/shared/ui";
import { formatPrice } from "@/shared/lib";
import {
  orderStatusOptions,
  useAdminOrders,
  type OrderStatusValue,
} from "@/features/orders";
import { orderColumns } from "../admin/components/order-columns";
```

It should not import from a global `hooks`, global `lib`, global `components/admin`, and global `pages` barrel simultaneously.

## 22. Decisions for this repository

Use these decisions unless requirements materially change:

1. Use feature-first organization with `app`, `features`, and `shared`.
2. Keep route definitions centralized but route pages feature-owned.
3. Keep cross-feature layouts in `app/layouts`.
4. Keep shell components next to layouts rather than introducing shell features immediately.
5. Start with one `catalog` feature containing products, categories, menu sections, and customizations.
6. Keep admin and customer order interfaces in one `orders` feature.
7. Keep admin and customer support interfaces in one `support` feature.
8. Use TanStack Query for server state and Zustand only for genuine cross-component client state.
9. Use narrow feature barrels and forbid external deep imports.
10. Split the current global types, schemas, constants, query keys, and stores by ownership.
11. Preserve behavior and routes during structural commits.
12. Do not add a generic global `common` or `utils` bucket as a shortcut.

## 23. Definition of done

The architecture refactor is complete when:

1. `src` contains only `app`, `features`, `shared`, global assets/styles, and entry files.
2. There are no global business-oriented `components`, `pages`, `hooks`, `store`, or `lib` buckets.
3. Every route page has an obvious feature owner.
4. Every query hook, query key, schema, type, and store is owned by a feature or a justified shared layer.
5. `shared` contains no business-domain components or types.
6. Features do not import from `app` or from another feature's internals.
7. Public feature barrels are small and intentional.
8. The application URLs and behavior remain unchanged unless separately documented.
9. Old barrels and empty folders are removed.
10. Type checking, linting, production build, and relevant user flows pass after the migration.

## 24. Recommended first implementation slice

The safest first slice is shared infrastructure plus authentication:

1. Create `shared/api`, `shared/ui`, `shared/lib`, `shared/config`, and `shared/model`.
2. Move API client/query helpers and generic UI.
3. Move modal state.
4. Create `features/auth` and move auth forms, schemas, user/session types, and auth state.
5. Update `main.tsx`, `App`, and route guard imports.
6. Remove only the legacy files made empty by this slice.

This establishes the dependency direction and import style before moving the larger catalogue, order, and checkout areas.
