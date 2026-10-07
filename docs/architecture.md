# Architecture

The complete promotion path is public discovery → authoritative quote → locked final checkout → COD consumption or online reservation/payment → immutable order/application snapshots → delivered-order event → store journal → platform consolidation. The same [accessible diagram](../frontend/src/features/docs/content/diagrams/promotions.ts) is rendered in `/docs/architecture`. [C14 fixtures/evidence](promotions-c14-handoff.md) documents deterministic seeds, offline reconciliation, governance and the pending database/browser release gates.

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

Backend domains live under `backend/src/features/<name>/`. Routes stay thin; services are common entry points rather than a fixed two-file rule, and complex domains split business policy, persistence, provider adapters, and workflows into focused collaborators:

| File | Responsibility |
| --- | --- |
| `<name>.routes.ts` | Express router. Binds HTTP methods to handlers. Applies middleware (auth guards, validation). Transforms request/response shapes. |
| `<name>.service.ts` and collaborators | Typed business workflows and domain logic. Complex services may delegate to repositories, policies, or focused workflow services. Never touches `req` or `res`. |

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
| `promotions` | Platform governance, store participation, manual coupon validation, automatic offers and immutable applications/allocations |
| `bundles` | Catalogue component definitions, availability and saved order components |
| `dashboard` | Revenue, order count, active users, average order value, low-stock items; time-series charts |
| `chat` | Support session lifecycle, message persistence, Socket.IO integration |

Payment reconciliation retains one public facade for route and webhook compatibility. It delegates signature/provider-state verification, transactional capture/failure finalization, stale and expired-reservation recovery, provider-order recovery, and observation-only updates to separate collaborators. This keeps all existing errors and transaction boundaries stable while allowing attempts, refunds, and settlement matching to evolve independently.

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
- **Allocation/consumption lock ordering**: COD and online checkout share the v4 snapshot writer and the cart/user/store/catalogue/promotion lock order in ADR-006. Existing-order payment finalization uses:
  ```text
  1. Existing order, user eligibility, store, then payment rows
  2. store_products rows, ordered by ascending store_products.id
  3. inventory_reservations rows, ordered by ascending inventory_reservations.id
  4. inventory_movements append
  5. Sorted promotion definitions/settings, then application collection transitions
  ```
- **Limits to the ordering claim**: Release performs a bulk inventory reservation update; cancellation releases reservations before locking stock for restoration. Staff membership locks add other dependencies. Query/unit tests do not establish a universal lock order or deadlock freedom; PostgreSQL concurrency evidence remains deferred.
- **Reservation deadlines**: Active totals include all rows still marked `reserved`, even after their deadline. The default 30-minute deadline requires explicit reconciliation; it does not release stock by itself.
- **Promotion payment recovery**: Online initiation reserves immutable application/allocation and bundle snapshots at the saved provider amount. Failure releases the complete collection; retry restores original inventory quantities and promotion capacity together. Verified capture can restore released promotion capacity under its saved contract, then consume once; physical inventory shortages still require operational resolution. Expiry also finds inactive online holds without tracked stock and rechecks identity/activity before release. Receipt attachment preserves failed and terminal states without restoring capacity. See [promotion operations](./promotions-operations.md).
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

### Private expense receipts

Expense receipts use the `ExpenseReceiptStorage` abstraction and demo-local storage under `.private/expense-receipts`, outside both public `/uploads` mounts. The API accepts only PDF, JPEG, PNG, or WebP files up to 5 MiB, verifies filename, declared type, extension, and content signature, stores a SHA-256 metadata record, and authorizes every list/download request. Generated UUID keys are resolved beneath the configured storage root and are never returned by the API.

Production hardening should replace local disk with private object storage, server-side encryption, malware scanning/quarantine, retention policies, and short-lived signed delivery after the same application authorization check. Receipts must never be moved into the public uploads directory.

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

Access capabilities are cached by authenticated user ID under `accessKeys.principal(userId)`. The `accessKeys.me()` prefix still invalidates every capability query after membership changes or forbidden responses. Requests consume TanStack Query's cancellation signal, so an obsolete account request cannot populate another account's cache. An account switch starts without the previous user's capabilities; backend authorization remains authoritative.

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

Client-side validation uses React Hook Form with Zod resolvers in several features and controlled Zod-validated forms in promotion administration. Schemas live in feature `model/` modules. Promotion drafts retain the captured definition version until explicit confirmed reload; automatic refresh does not replace edits. Money/rate fields use integer paise/basis points, and the browser validates form shape while the server owns eligibility/pricing. Dependency versions should be read from package manifests/lockfiles; the C01 evidence record notes an installed frontend Zod mismatch.

### Promotion governance UI

C11 exposes separate platform definition/media/analytics and same-store manager participation routes and sidebar entries. Governance query keys include principal, store and filters, consume cancellation signals and avoid cross-store placeholder data. Managers see server effective status and read-only global definitions; a reason-backed confirmation changes only their selected store. Platform admins never override a manager choice. Media editing is separate from definition drafts; homepage placement follows save → desktop upload/alt text → versioned edit. Analytics preserve aggregate strings/BigInt and distinguish application attribution from ledger recognition. See the [C11 handoff](promotions-c11-handoff.md) for coverage and remaining manual checks.

C12's `offers` feature reads only `/promotions/offers` and `/promotions/featured`, with store/placement-scoped keys, cancellable requests, explicit refresh and focus refetch. Store resolution changes hide the previous store's content; refresh errors hide stale offer cards. `/offers/:id/products` uses public product/category target IDs to select matching products from store-priced menu pages loaded on demand. This does not evaluate cart eligibility or compute promotional prices. The homepage slider orders priority descending then ID ascending, displays at most five offers, and starts paused. Optional seven-second rotation pauses on pointer hover, focus and page hiding; reduced motion prevents rotation. Responsive uploaded artwork includes alt text and a textual fallback. Bundle cards and cart lines render backend selling/compare-at/savings/component metadata, with one cart add action and native expandable contents. Feature barrels expose only the presentation/types needed across catalogue, cart and offers. See the [C12 handoff](promotions-c12-handoff.md); checkout and historical order UX remain C13.

Checkout quotes and private order, cart, address and profile reads include principal identity in their cache keys. Public anonymous quotes use a separate null-principal key; private reads require authentication. Order pagination avoids placeholder data across account/store changes. Shared query transport consumes cancellation signals, and cache mutations preserve account isolation. See [checkout/order account isolation](checkout-order-account-isolation.md) for the six failing-before/passing-after regressions found during C13 review.

C13 keeps coupon input in an observable session per account/store/cart revision/address. Context changes create an empty session and cancel obsolete validation; a late response cannot apply a coupon to the new context. Only explicit manual validation can set an applied code. Owned-cart quotes preserve cart line identities, refresh on focus and every 30 seconds while visible, and use revision-scoped cancellable queries with bounded transient retries. Refreshing, failed or mismatched quotes hide old totals and disable ordering; mismatched lines trigger a cart refresh. The quote supplies automatic-offer/coupon exclusivity, eligibility reasons and conflict links. A shared pricing breakdown formats supplied monetary fields and separates displayed delivery/bundle savings from payable. Both customer and admin order details render captured names, component counts, promotion allocations and savings, and payment retry describes the saved total. Cart/catalogue keys now share their documented invalidation prefixes; see [cache invalidation regressions](cart-catalog-invalidation.md) and the [C13 handoff](promotions-c13-handoff.md).

## Cross-cutting concerns

### Financial write and reporting architecture

Checkout pricing is server-authoritative and immutable after order creation. Domain services persist source state and a versioned financial-outbox event in the same PostgreSQL transaction. The posting worker claims eligible events with leases and `SKIP LOCKED`, derives typed debit/credit commands, and posts through the ledger kernel. Source identity plus version makes retries idempotent; failed work backs off and eventually dead-letters without leaking raw sensitive errors.

Posted journals are immutable. Every journal has at least two positive one-sided lines and equal debit/credit totals, enforced by service policy and database triggers. Reversal creates a linked counter-entry. Fiscal periods provide open, soft-closed, and closed posting policy with recent-owner authentication and audited reasons for sensitive transitions.

Management reports read posted/reversed journal lines through one repository and one projection policy. Store and platform-owner consolidated scopes share the same date, INR, delivery-recognition, comparison, and included-status metadata. The React Finance workspace and CSV exports call those same service methods; aggregate drill-down filters resolve back to journals and source identities.

```text
quote/order/payment/refund/expense/cash/settlement
                    |
             source transaction
                    +-- financial_outbox (same commit)
                                  |
                           posting worker
                                  |
                    balanced journal entries/lines
                         |                    |
                 reports + CSV          drill-down/audit
```

Operational recovery and limitations are in [finance-operations-runbook.md](finance-operations-runbook.md). The deterministic browser narrative is in [finance-demo-walkthrough.md](finance-demo-walkthrough.md).

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

Order reads share a bounded snapshot query and explicit public projection. Saved promotion/item/customization/bundle names survive catalogue edits; only current product images decorate historical lines. Customer credentials, cost snapshots and provider internals are excluded. The retired coupon module has no persistence or HTTP adapter. See [C10 handoff](promotions-c10-handoff.md).
