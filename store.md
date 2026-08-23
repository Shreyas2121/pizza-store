# Feature: Multi-Store Support

## Summary

Transform the single-store PizzaStore application into a multi-store platform. Users are assigned a store based on their pincode (entered manually or detected via IP geolocation). Products come from a shared global catalog, but each store controls its own availability and pricing. Orders are scoped to the resolved store. The admin (single super-admin role) manages all stores, store-product mappings, and store-specific settings from the existing admin panel.

---

## Context & Current State

### Existing Schema Assets (already in `backend/src/db/schema.ts`)

- **`delivery_zones`** — has `id`, `pincode` (unique). Currently unused by any feature module.
- **`delivery_price`** — has `id`, `delivery_charge`, `min_order`. Currently unused. Will remain **global** (not per-store).
- **`addresses`** — already captures user pincode.
- **`products`** — currently global, not scoped to any store.

### Key Decisions Made

| Decision | Choice |
|---|---|
| Product-store relationship | Shared global catalog; each store toggles availability and sets its own price |
| Store selection | System auto-assigns nearest/default store based on pincode |
| Admin model | Single super-admin manages everything (no store-manager role) |
| Operating hours | Stores have operating hours; orders blocked when store is closed |
| User entry flow | IP geolocation for initial pincode guess; user can always override manually |
| Delivery charges | Global (not per-store) |
| Pincode change with items in cart | Clear cart with a warning if the resolved store changes |

---

## Database Changes

### New Tables

#### `stores`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | integer | PK, generated always | |
| `name` | text | NOT NULL | Display name (e.g., "PizzaStore - Koramangala") |
| `slug` | text | UNIQUE, NOT NULL | URL-safe identifier |
| `address` | text | NOT NULL | Store's physical address |
| `city` | text | NOT NULL | |
| `state` | text | NOT NULL | |
| `pincode` | text | NOT NULL | Store's own pincode |
| `phone` | text | NOT NULL | Store contact number |
| `email` | text | | Store contact email (optional) |
| `latitude` | double precision | | For future geo-distance calculations (optional) |
| `longitude` | double precision | | For future geo-distance calculations (optional) |
| `opens_at` | text | NOT NULL | Opening time in 24h format, e.g., "09:00" |
| `closes_at` | text | NOT NULL | Closing time in 24h format, e.g., "23:00" |
| `is_active` | boolean | NOT NULL, default true | Admin can deactivate a store |
| `created_at` | timestamptz | NOT NULL, default now() | |
| `updated_at` | timestamptz | NOT NULL, default now() | Auto-updates |

Relations: one-to-many with `store_products`, `delivery_zones`, `orders`.

#### `store_products`

Junction table that maps products to stores, with store-specific overrides.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | integer | PK, generated always | |
| `store_id` | integer | FK → stores, NOT NULL | |
| `product_id` | integer | FK → products, NOT NULL | |
| `price` | real | NOT NULL | Store-specific price (overrides `products.price`) |
| `is_available` | boolean | NOT NULL, default true | Store-level availability toggle |
| `created_at` | timestamptz | NOT NULL, default now() | |
| `updated_at` | timestamptz | NOT NULL, default now() | Auto-updates |

Unique constraint: `(store_id, product_id)` — a product can only be mapped once per store.

### Modified Tables

#### `delivery_zones` — Add `store_id` FK

| Column | Change | Notes |
|---|---|---|
| `store_id` | **ADD** integer FK → stores, NOT NULL | Each delivery zone (pincode) belongs to a store |

- **Drop** the existing `UNIQUE` constraint on `pincode`.
- **Add** a composite unique constraint on `(store_id, pincode)` — same pincode can be served by multiple stores, but a store can only list a pincode once.
- This means when a user enters a pincode, the system finds all stores that serve it, then picks the best one (see Store Resolution Logic below).

#### `orders` — Add `store_id` FK

| Column | Change | Notes |
|---|---|---|
| `store_id` | **ADD** integer FK → stores, NOT NULL | Every order is assigned to the store it was placed against |

#### `cart` — Add `store_id` FK

| Column | Change | Notes |
|---|---|---|
| `store_id` | **ADD** integer FK → stores, nullable | The currently resolved store for this cart. Nullable because cart might exist before store resolution. |

### Tables NOT Changed

- `products` — remains the global catalog. `products.price` becomes the "base/default price". `products.is_available` remains the global availability flag. Store-level availability and pricing is in `store_products`.
- `delivery_price` — stays global.
- `categories`, `customization_groups`, `customization_options`, `menu_items` — remain global/shared.
- `users`, `addresses`, `payments`, `coupons`, `chat_*` — no changes.

---

## Store Resolution Logic

This is the core business logic that determines which store serves a user.

### Resolution Algorithm

```
Input: user_pincode (string)

1. Query delivery_zones WHERE pincode = user_pincode
   → Returns list of store_ids

2. If no results → return error: "We don't deliver to this area yet"

3. For each store_id, fetch the store record
   → Filter out stores where is_active = false
   → Filter out stores that are currently outside operating hours

4. If no active/open stores remain → return error: "No stores are currently open for your area"

5. If exactly one store → return that store

6. If multiple stores → pick the first one (ordered by store.id ASC as a stable default)
   (Future enhancement: pick by geo-distance using lat/lng)
```

### When Resolution Happens

- **On app load**: Frontend calls IP geolocation API → gets approximate pincode → calls store resolution endpoint.
- **On manual pincode entry**: User types a pincode → calls store resolution endpoint.
- **On checkout validation**: Backend re-validates that the delivery address pincode matches a delivery zone for the order's store.

---

## API Endpoints

### New Feature Module: `stores`

Create `backend/src/features/stores/stores.routes.ts` and `stores.service.ts`.

#### Public Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/stores/resolve` | None | Accepts `{ pincode }`, returns the resolved store object (or error). This is the primary endpoint the frontend calls. |
| `GET` | `/api/stores/:id` | None | Get a single store's public details (name, address, hours). |

#### Admin Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/stores` | Admin | List all stores (with pagination, search). |
| `POST` | `/api/stores` | Admin | Create a new store. |
| `PUT` | `/api/stores/:id` | Admin | Update store details (name, address, hours, active status). |
| `DELETE` | `/api/stores/:id` | Admin | Soft-delete (set `is_active = false`) or hard-delete a store. |
| `GET` | `/api/stores/:id/products` | Admin | List all products mapped to a store with store-specific prices. |
| `POST` | `/api/stores/:id/products` | Admin | Map products to a store (bulk). Body: `[{ productId, price, isAvailable }]`. |
| `PUT` | `/api/stores/:id/products/:productId` | Admin | Update a store-product mapping (price, availability). |
| `DELETE` | `/api/stores/:id/products/:productId` | Admin | Remove a product from a store's offering. |
| `GET` | `/api/stores/:id/delivery-zones` | Admin | List all pincodes served by this store. |
| `POST` | `/api/stores/:id/delivery-zones` | Admin | Add pincodes to a store's delivery zones (bulk). Body: `{ pincodes: ["560001", "560002"] }`. |
| `DELETE` | `/api/stores/:id/delivery-zones/:zoneId` | Admin | Remove a pincode from a store's delivery zones. |

### Modified Existing Endpoints

#### Products

| Endpoint | Change |
|---|---|
| `GET /api/products` (public listing) | **Add query param** `?storeId=<id>`. When present, return only products that exist in `store_products` for that store, using the store-specific price and availability. When absent, return global catalog (backward compat for admin). |
| Product detail endpoints | When a `storeId` context is available, overlay store-specific price on the product response. |

#### Cart

| Endpoint | Change |
|---|---|
| `POST /api/cart/add` | **Accept** `storeId` in body. Validate that the product is available at the specified store. Use the store-specific price from `store_products`. Set `cart.store_id`. |
| `GET /api/cart` | Include `store_id` in cart response. |
| Cart update/remove | No change to API shape, but price recalculations should use store-specific prices. |

#### Orders

| Endpoint | Change |
|---|---|
| `POST /api/orders` (create) | Copy `store_id` from cart to order. Validate that the delivery address pincode is in the store's delivery zones. Validate that the store is currently open. |
| `GET /api/orders` (admin) | **Add query param** `?storeId=<id>` to filter orders by store. |
| Dashboard analytics | **Add query param** `?storeId=<id>` to filter revenue/order metrics by store. |

---

## Frontend Changes

### New: Store Context (Zustand Store)

Create a new Zustand store: `src/store/storeStore.ts`

```
State:
  - resolvedStore: Store | null        // The currently resolved store
  - userPincode: string | null         // The user's entered/detected pincode
  - isStoreResolved: boolean           // Whether we have a valid store
  - isLoading: boolean                 // Resolution in progress

Actions:
  - setPincode(pincode: string)        // Triggers store resolution
  - setResolvedStore(store: Store)     // Sets the resolved store
  - clearStore()                       // Clears resolution (for pincode change)
```

Persist `userPincode` and `resolvedStore` to localStorage so returning users don't re-enter.

### New: Pincode Entry Modal / Banner

- **On first visit** (no stored pincode): Show a prominent modal/overlay asking for pincode.
  - Simultaneously, call an IP geolocation API (e.g., `https://ipapi.co/json/` or similar free service) to pre-fill the pincode field.
  - User can accept the pre-filled value or type their own.
  - "Detect my location" button as alternative.
  - If user dismisses without entering: show a persistent banner at the top: "Enter your delivery pincode to see available items."
- **On subsequent visits**: Use stored pincode, silently re-resolve store in background.
- **Pincode change**: Small UI element in navbar showing current pincode (clickable to change). On change:
  1. Re-resolve store.
  2. If resolved store is different from current `cart.store_id` AND cart has items → show confirmation dialog: "Changing your area will clear your cart. Continue?"
  3. If user confirms → clear cart (API call) → update store context.

### Modified: Product Listing & Detail Pages

- All product queries include `storeId` as a query parameter.
- Product cards show the **store-specific price** (not `products.price`).
- Products not available at the current store are **not shown** (filtered server-side).
- If no store is resolved, show the pincode entry prompt instead of products.

### Modified: Cart

- Cart operations send `storeId` in the request body.
- Cart response includes store info for display (e.g., "Ordering from: PizzaStore - Koramangala").

### Modified: Checkout

- Before order placement, validate:
  - Store is still open (check operating hours client-side as a UX guard; backend re-validates).
  - Delivery address pincode matches a delivery zone for the resolved store.
- Show store name and estimated info on checkout page.
- If store is closed at time of checkout → show error, block order.

### New: Admin Pages

#### Store Management Page (`/admin/stores`)

- Table listing all stores (name, city, pincode, status, hours).
- Create/Edit store form (all store fields).
- Toggle store active/inactive.

#### Store Product Mapping Page (`/admin/stores/:id/products`)

- Table showing all products with columns: product name, global price, store price, availability toggle.
- Bulk "Add products to store" action — select from global catalog.
- Inline edit for store-specific price.
- Remove product from store.

#### Store Delivery Zones Page (`/admin/stores/:id/delivery-zones`)

- List of pincodes served by this store.
- Add pincodes (comma-separated or one-by-one).
- Remove pincodes.

#### Dashboard Modifications

- Add a store filter dropdown to the dashboard.
- When a store is selected, all analytics (revenue, orders, etc.) filter by that store.

---

## Business Rules & Validation

### Store Operating Hours

- Operating hours are stored as simple time strings (`opens_at`, `closes_at`) in the store's local timezone.
- Assume all stores operate in IST (Indian Standard Time) for simplicity.
- If `opens_at` > `closes_at`, it means the store operates across midnight (e.g., opens 18:00, closes 02:00).
- Backend validates operating hours on order creation. Frontend shows a "Store is currently closed" state but doesn't hard-block browsing (user can still browse the menu, just can't checkout).

### Cart-Store Consistency

- A cart is bound to exactly one store at a time via `cart.store_id`.
- When adding the first item, `cart.store_id` is set.
- If the user changes pincode and a different store is resolved:
  - Backend clears all cart items.
  - `cart.store_id` is updated to the new store.
  - Frontend shows a warning toast: "Your cart has been cleared because you changed your delivery area."
- If the same store is resolved after pincode change, cart is preserved.

### Price Consistency

- When adding to cart, use the price from `store_products` (not `products.price`).
- `products.price` serves as the base/default price and is used when creating a new `store_products` mapping (pre-fills the store price field in admin).
- Cart item prices are still snapshotted at add-time (existing behavior).

### Product Availability

- A product is visible to a user only if:
  1. `products.is_available = true` (global kill switch)
  2. A `store_products` row exists for the resolved store
  3. `store_products.is_available = true`
- Admin can use `products.is_available` to pull a product from ALL stores at once (e.g., recalled item).

---

## IP Geolocation Strategy

### Approach

- Use a free IP geolocation API on the frontend (client-side call).
- Suggested services (pick one):
  - `https://ipapi.co/json/` — free tier: 1000 req/day, returns `postal` field.
  - `https://ip-api.com/json/` — free for non-commercial, returns `zip` field.
- Call on app load if no pincode is stored in localStorage.
- The result is a **suggestion only** — always allow user override.
- If the API fails or returns no postal code, silently fall back to manual entry.

### Implementation Notes

- Do NOT proxy through backend (unnecessary load, the user's IP must be visible to the geo API).
- Cache the result in localStorage with a TTL (e.g., 24 hours) to avoid repeat calls.
- Handle VPN/proxy cases gracefully — if the resolved pincode has no delivery zone, show the manual entry UI.

---

## Edge Cases to Handle

| Scenario | Behavior |
|---|---|
| Pincode has no delivery zone | Show "We don't deliver to this area yet" with option to try another pincode |
| All stores for a pincode are inactive | Same as above |
| All stores for a pincode are closed | Show "Stores in your area are currently closed. Opens at HH:MM" |
| User has items in cart, changes pincode, new store is different | Clear cart with confirmation dialog |
| User has items in cart, changes pincode, same store resolves | Keep cart as-is |
| Store deactivated while user is browsing | On next API call (add to cart, checkout), return error, prompt re-resolution |
| Product removed from store while it's in user's cart | On checkout validation, reject with specific error identifying the unavailable item(s) |
| Admin creates a store with no products mapped | Store resolves but shows empty menu with "No items available at this store" |
| Admin creates a store with no delivery zones | Store never resolves for any user (it's unreachable) |
| IP geolocation API fails | Silently fall back to manual pincode entry (no error shown to user) |
| IP geolocation returns wrong pincode | User sees "no delivery zones" or wrong store — they manually correct via the pincode change UI |

---

## Migration Strategy

Since the app currently assumes a single implicit store:

1. **Create the new tables** (`stores`, `store_products`) and modify existing tables (`delivery_zones`, `orders`, `cart`).
2. **Seed a default store** — create one store record representing the current implicit store.
3. **Migrate existing data**:
   - Create `store_products` entries for all existing products, copying `products.price` as the store price.
   - Update existing `delivery_zones` rows to point to the default store.
   - Update existing `orders` to reference the default store.
   - Update existing `cart` rows to reference the default store.
4. **Then** make `store_id` columns NOT NULL after backfill.

This ensures zero data loss and backward compatibility during development.

---

## File Changes Summary

### Backend — New Files

| File | Purpose |
|---|---|
| `src/features/stores/stores.routes.ts` | Store routes (public + admin) |
| `src/features/stores/stores.service.ts` | Store resolution logic, CRUD, product mapping, zone management |

### Backend — Modified Files

| File | Change |
|---|---|
| `src/db/schema.ts` | Add `stores`, `store_products` tables; modify `delivery_zones`, `orders`, `cart` |
| `src/features/products/products.service.ts` | Support `storeId` filtering with store-specific prices |
| `src/features/products/products.routes.ts` | Accept `storeId` query param |
| `src/features/cart/cart.service.ts` | Store-aware pricing, store_id on cart |
| `src/features/cart/cart.routes.ts` | Accept `storeId` in add-to-cart body |
| `src/features/order/order.service.ts` | Copy store_id to order, validate store hours + delivery zone |
| `src/features/order/order.routes.ts` | Accept storeId filter on admin order listing |
| `src/features/dashboard/dashboard.service.ts` | Add store filter to analytics queries |
| `src/utils/types.ts` | Add any new type enums if needed |
| `src/utils/zodSchema.ts` | Add validation schemas for store endpoints |
| `drizzle/` | New migration files |

### Frontend — New Files

| File | Purpose |
|---|---|
| `src/store/storeStore.ts` | Zustand store for resolved store + pincode state |
| `src/hooks/useStore.ts` | TanStack Query hooks for store API |
| `src/components/main/PincodeModal.tsx` | Pincode entry/change modal |
| `src/components/main/StoreBanner.tsx` | Persistent banner showing current store + change option |
| `src/pages/admin/StoreManagement.tsx` | Admin store CRUD page |
| `src/pages/admin/StoreProducts.tsx` | Admin store-product mapping page |
| `src/pages/admin/StoreDeliveryZones.tsx` | Admin store delivery zone management page |

### Frontend — Modified Files

| File | Change |
|---|---|
| `src/routes.tsx` | Add admin store routes |
| `src/components/admin/Sidebar.tsx` | Add store management nav items |
| `src/components/main/Navbar.tsx` | Show current pincode/store with change option |
| `src/hooks/useProducts.ts` | Pass storeId to product queries |
| `src/hooks/useCart.ts` | Pass storeId in cart mutations |
| `src/hooks/useOrder.ts` | Include storeId validation |
| `src/pages/main/Home.tsx` | Gate on store resolution, show pincode prompt if unresolved |
| `src/pages/main/Checkout.tsx` | Validate store hours, show store info |
| `src/pages/admin/Dashboard.tsx` | Add store filter dropdown |
| `src/pages/admin/Orders.tsx` | Add store filter to order listing |
| `src/lib/types.ts` | Add Store, StoreProduct types |
| `src/lib/zodSchema.ts` | Add store-related validation schemas |

---

## Suggested Implementation Order

1. **Database schema changes** — new tables + migrations
2. **Backend: Store CRUD** — admin endpoints for managing stores
3. **Backend: Delivery zone management** — admin endpoints + modify existing table
4. **Backend: Store-product mapping** — admin endpoints for mapping products with store prices
5. **Backend: Store resolution endpoint** — `POST /api/stores/resolve` with the resolution algorithm
6. **Backend: Modify product listing** — store-aware product queries
7. **Backend: Modify cart** — store-aware cart operations
8. **Backend: Modify order creation** — store assignment + validation
9. **Backend: Modify dashboard** — store filter on analytics
10. **Frontend: Zustand store + pincode modal** — store context management
11. **Frontend: Admin store pages** — CRUD, product mapping, delivery zones
12. **Frontend: Storefront integration** — product listing, cart, checkout gated on store
13. **Frontend: IP geolocation** — auto-detect pincode on first visit
14. **Seed script** — default store + migration of existing data
15. **Testing & edge cases**
