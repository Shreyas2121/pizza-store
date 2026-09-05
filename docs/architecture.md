# Architecture

## Overview

PizzaStore is a client-server web application with a React single-page frontend and a Node.js/Express REST API backend. The frontend owns presentation, routing, and client-side state. The backend owns business logic, data access, authentication, file uploads, and real-time event delivery. PostgreSQL is the single source of truth for all persistent data. Socket.IO provides a bidirectional event channel between the server and all connected clients.

```text
React/TypeScript SPA
    | Axios HTTP requests (REST)
    | Socket.IO events (WebSocket)
    |
Express API server
    |-- Feature routers (REST endpoints)
    |-- Feature services (business logic + data access)
    |-- Middleware (auth, validation, error handling)
    |
Drizzle ORM
    |
PostgreSQL
```

Route handlers generally call services, which access the database through Drizzle. Larger domains also have repositories, policy helpers, schemas, and injected collaborators. See [case-study evidence](case-study-evidence.md) for the reviewed source revision, transaction boundaries, and current limitations; this overview does not establish production deployment or concurrency guarantees.

## Backend architecture

### Feature modules

Backend domains live under `backend/src/features/<name>/`. Routes and services are common entry points, not a fixed two-file rule:

| File | Responsibility |
| --- | --- |
| `<name>.routes.ts` | Express router. Binds HTTP methods to handlers. Applies middleware (auth guards, validation). Transforms request/response shapes. |
| `<name>.service.ts` | Data access and business logic. Exports a class instance with methods that accept typed parameters and return domain objects. Never touches `req` or `res`. |

Selected business modules (supporting domains also include `auth`, `access`, `staff`, `audit`, `realtime`, `checkout`, `stores`, and `system-maintenance`):

| Module | Domain |
| --- | --- |
| `users` | Registration, login, JWT issuance, profile, address CRUD |
| `products` | Product CRUD, menu-based listing, category filtering, sorting, pagination |
| `category` | Category CRUD with select-friendly projections |
| `customization` | Customization groups and options, product-to-group mapping |
| `menu` | Menu item CRUD with position ordering and product assignment |
| `cart` | Add, update quantity, remove items; cart totals; transactional price updates |
| `order` | Order creation from cart, order listing with status filtering, admin views |
| `payments` | Cash and Razorpay payment processing, lifecycle, and reconciliation |
| `inventory` | Store-level stock management, reservations, atomic movements, and threshold alerts |
| `coupon` | Coupon CRUD, validation against order totals, redemption tracking |
| `dashboard` | Revenue, order count, active users, average order value, low-stock items; time-series charts |
| `chat` | Support session lifecycle, message persistence, Socket.IO integration |

### Inventory and concurrency model

The inventory system tracks physical on-hand stock and active reservations at the `store_products` level:

- **Source-of-Truth Invariants**:
  ```text
  available_quantity = NULL when on_hand_quantity IS NULL
  otherwise available_quantity = max(0, on_hand_quantity - active_reserved_quantity)

  sellable = products.is_available
          && store_products.is_available
          && (on_hand_quantity IS NULL || available_quantity > 0)
  ```
- **Customization aggregation**: Customized cart lines share the same base product availability (demand is aggregated across variants by `productId`).
- **Allocation/consumption lock ordering**: Checkout locks the cart and stock rows; payment finalization locks the order/payment and then sorted stock/reservation rows. Its consumption path is:
  ```text
  1. Existing order/payment rows locked by finalization
  2. store_products rows, ordered by ascending store_products.id
  3. inventory_reservations rows, ordered by ascending inventory_reservations.id
  4. inventory_movements append
  ```
- **Limits to the ordering claim**: Release performs a bulk reservation update without explicit sorting; cancellation releases reservations before locking stock for restoration. Coupons and staff membership locks add other dependencies. This is not a verified universal lock order or proof of deadlock freedom. See the evidence document's lock-order audit.
- **Reservation deadlines**: Active totals include all rows still marked `reserved`, even after their deadline. The default 30-minute deadline requires explicit reconciliation; it does not release stock by itself.
- **Movement audit ledger**: Normal inventory writes append movement records. Schema/migration checks enforce `new_quantity = previous_quantity + quantity_change` and nonnegative balances, with unique sale/cancellation idempotency keys. The system-maintenance clear operation can truncate these records, so the ledger is not globally immutable.
- **Manual availability independence**: Manual toggles (`is_available`) are managed solely by admins and are never overwritten by inventory logic.

### Middleware layer

| Middleware | Purpose |
| --- | --- |
| `authenticateUser` | Verifies bearer JWT claims and reloads the active user/token version; attaches `req.principal`. |
| `authenticateAdmin` | Authentication plus `req.principal.platformRole === "admin"`. |
| `requireStorePermission` | Checks current active membership/store and a named store permission; platform admins bypass membership checks. Some routes invoke the authorization service directly. |
| `validateBody` | Accepts a Zod schema and validates `req.body` before the route handler executes. Returns 400 with structured errors on failure. |
| `asyncHandler` | Wraps async route handlers to forward thrown errors to Express error middleware. |
| `handleError` | Formats application/unexpected errors from the final Express error middleware. |

Middleware ordering is route-specific. Customer COD creation uses normal body parsing, CORS, HTTP logging, authentication, and body validation before the transactional quote checks. Razorpay webhooks are mounted before normal body parsers and use raw bytes for signature verification.

### Database layer

The database client is initialized in `src/db/index.ts` using `drizzle-orm/node-postgres`. The schema is defined across domain files in `src/db/schema/` with central relations in `_relations.ts`.

Migrations are managed by `drizzle-kit`. Configuration lives in `drizzle.config.ts` at the backend root.

### Real-time events

Socket.IO shares the HTTP server. Handshake authentication derives personal, platform, and store rooms from the current principal and memberships; clients do not select arbitrary rooms through a `joinRoom` event. See [staff authorization](store-staff-authorization.md) for audience definitions.

| Event | Direction | Payload | Purpose |
| --- | --- | --- | --- |
| `orderPlaced` | Server → Client | `{ orderId, total, status }` | Notifies admin dashboard of new/finalized orders |
| `lowStock` | Server → Client | `LowStockAlert` object | Notifies admin panel of downward stock threshold crossings post-commit |
| `chatRequest` | Server → Client | `{ userId }` | Notifies admin of new support requests |
| `newMessage` | Server → Client | `Message` object | Delivers chat messages to the other party |

These are delivery notifications, not a durable event log. COD emits after transaction commit; no outbox was found. Payment route audience selection currently has missing store/user context in some reconciliation return values, and CLI reconciliation does not emit socket events. See claim RT-02 in the evidence document before claiming complete customer/store notification coverage.

### Static file serving

Product images uploaded via Multer are stored in `backend/uploads/` and served statically by Express at the `/uploads` path.

### Environment and configuration

All environment variables are validated at startup using a Zod schema in `src/utils/zodSchema.ts`. The validated values are exported from `src/constants.ts`. The server will not start if any required variable is missing or malformed.

## Frontend architecture

### Rendering and routing

The app uses React Router with a `BrowserRouter`. Routes are defined in `frontend/src/app/router/routes.tsx` and organized into three current layout shells:

| Layout | Routes | Purpose |
| --- | --- | --- |
| `MainLayout` | `/`, `/cart`, `/checkout`, `/staff-invitations/accept`, profile routes | Storefront shell; customer account/cart/checkout routes have their own auth guards |
| `ProfileLayout` | `/profile`, `/address`, `/orders`, `/order/:id` | Nested within MainLayout, adds profile sidebar |
| `AdminLayout` | `/admin/*` | Staff workspace guarded by `StaffProtectedRoute`; platform-only pages have additional guards |

Feature pages are lazy-loaded with `React.lazy()` and rendered under Suspense. The C03 public `DocsLayout` serves `/docs` independently of storefront/admin layouts and guards, with a nested loading/error boundary and docs-specific not-found page. The C02 app boundary excludes `/docs` and its descendants from `BusinessRuntime`, which owns authenticated chat/socket effects and the global app modal. Unmount disconnects and clears the owned socket, closes the modal, and permits in-flight chat sync cancellation. Browser lifecycle checks were not performed and further runtime checks were waived by the owner during C03. See [public docs authoring](public-docs.md) and the implementation guide handoffs.

### State management

The frontend separates server state from client state:

| Concern | Tool | What it manages |
| --- | --- | --- |
| Server state | TanStack Query | All API data: products, cart, orders, users, dashboard, chat |
| Auth state | Zustand (persisted) | Current user, JWT token, login/logout |
| UI state | Zustand (ephemeral) | Modal open/close, socket instance, chat session, date filters |

The Axios instance (`frontend/src/shared/api/api-client.ts`) attaches the JWT through a token getter configured by `frontend/src/app/providers/app-providers.tsx`. This keeps the shared API layer independent of feature stores.

### Hooks architecture

API interactions live in feature-level `api/` modules with query/mutation hooks. Some use shared factories; others call TanStack Query directly.

Three factory functions in `frontend/src/shared/api/query-helpers.ts` reduce boilerplate:

| Factory | Wraps | Purpose |
| --- | --- | --- |
| `createQuery` | `useQuery` | Standard data fetching with optional data key extraction |
| `createSuspenseQuery` | `useSuspenseQuery` | Suspense-compatible data fetching |
| `createMutation` | `useMutation` | Mutations with automatic query invalidation |

### Component organization

Components are organized by domain:

```text
frontend/src/
  app/         Router, layouts, providers, application integration
  features/    Domain pages, components, API hooks, models
  shared/      Reusable UI, API client/helpers, config, utilities
```

### Form validation

Client-side validation uses React Hook Form with Zod resolvers. Schemas live in feature `model/` modules, including auth, catalogue, account address, store, and inventory schemas. Dependency versions should be read from package manifests/lockfiles; the C01 evidence record notes an installed frontend Zod mismatch.

## Cross-cutting concerns

### Authentication flow

1. User submits credentials via login/register form.
2. Backend validates, hashes password (register) or compares hash (login), and returns a JWT + user object.
3. Frontend stores both in Zustand's persisted user store (localStorage).
4. Every subsequent Axios request attaches `Authorization: Bearer <token>` via interceptor.
5. Backend middleware verifies JWT claims, loads the active user and token version, and attaches `req.principal`. Store authorization loads current membership where required; memberships are not embedded in JWTs.

### Error handling

- **Backend**: `asyncHandler` catches thrown errors. `AppError` class carries a status code and message. The global error handler formats and returns the response.
- **Frontend**: TanStack Query's global `MutationCache.onError` catches mutation errors and shows a Mantine notification. Individual `onSuccess` callbacks show success notifications.

### Image handling

Product and menu images are uploaded as `multipart/form-data` via Multer. Files are stored on disk in `backend/uploads/` with generated filenames. The frontend constructs image URLs as `${BASE_URL}${product.image}`.
