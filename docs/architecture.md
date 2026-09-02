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

Dependencies point inward: route handlers call services, services call the database through Drizzle. Services never import Express types. Route handlers never write raw SQL.

## Backend architecture

### Feature modules

Each business domain lives under `src/features/<name>/`. Routes stay thin, while complex domains may split business policy, persistence, provider adapters, and workflows into focused collaborators:

| File | Responsibility |
| --- | --- |
| `<name>.routes.ts` | Express router. Binds HTTP methods to handlers. Applies middleware (auth guards, validation). Transforms request/response shapes. |
| `<name>.service.ts` and collaborators | Typed business workflows and domain logic. Complex services may delegate to repositories, policies, or focused workflow services. Never touches `req` or `res`. |

Current feature modules:

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

Payment reconciliation retains one public facade for route and webhook compatibility. It delegates signature/provider-state verification, transactional capture/failure finalization, stale and expired-reservation recovery, provider-order recovery, and observation-only updates to separate collaborators. This keeps all existing errors and transaction boundaries stable while allowing attempts, refunds, and settlement matching to evolve independently.

### Inventory and concurrency model

The inventory system tracks physical on-hand stock and active reservations at the `store_products` level:

- **Source-of-Truth Invariants**:
  ```text
  available_quantity = on_hand_quantity - active_reserved_quantity

  sellable = products.is_available
          && store_products.is_available
          && (on_hand_quantity IS NULL || available_quantity > 0)
  ```
- **Customization aggregation**: Customized cart lines share the same base product availability (demand is aggregated across variants by `productId`).
- **Global lock order**: Every operation that mutates stock or reservations acquires locks in strict ascending order to prevent deadlocks:
  ```text
  1. Existing owning row when required (cart, order, or payment)
  2. store_products rows, ordered by ascending store_products.id
  3. inventory_reservations rows, ordered by ascending inventory_reservations.id
  4. inventory_movements append
  ```
- **Movement audit ledger**: `inventory_movements` is append-only and strictly checks `new_quantity = previous_quantity + quantity_change`.
- **Manual availability independence**: Manual toggles (`is_available`) are managed solely by admins and are never overwritten by inventory logic.

### Middleware layer

| Middleware | Purpose |
| --- | --- |
| `authenticateUser` | Extracts and verifies the JWT from the `Authorization: Bearer` header. Attaches decoded user to `req.user`. |
| `authenticateAdmin` | Same as above, plus verifies `role === "admin"`. |
| `validateBody` | Accepts a Zod schema and validates `req.body` before the route handler executes. Returns 400 with structured errors on failure. |
| `asyncHandler` | Wraps async route handlers to forward thrown errors to Express error middleware. |
| `globalErrorHandler` | Catches all errors. Returns structured JSON with status code and message. Logs errors via Winston. |

### Database layer

The database client is initialized in `src/db/index.ts` using `drizzle-orm/node-postgres`. The schema is defined across domain files in `src/db/schema/` with central relations in `_relations.ts`.

Migrations are managed by `drizzle-kit`. Configuration lives in `drizzle.config.ts` at the backend root.

### Real-time events

Socket.IO is initialized alongside the Express server. Events flow in both directions:

| Event | Direction | Payload | Purpose |
| --- | --- | --- | --- |
| `joinRoom` | Client → Server | `{ userId }` | Associates a socket with a user for targeted events |
| `orderPlaced` | Server → Client | `{ orderId, total, status }` | Notifies admin dashboard of new/finalized orders |
| `lowStock` | Server → Client | `LowStockAlert` object | Notifies admin panel of downward stock threshold crossings post-commit |
| `chatRequest` | Server → Client | `{ userId }` | Notifies admin of new support requests |
| `newMessage` | Server → Client | `Message` object | Delivers chat messages to the other party |

### Static file serving

Product images uploaded via Multer are stored in `backend/uploads/` and served statically by Express at the `/uploads` path.

### Environment and configuration

All environment variables are validated at startup using a Zod schema in `src/utils/zodSchema.ts`. The validated values are exported from `src/constants.ts`. The server will not start if any required variable is missing or malformed.

## Frontend architecture

### Rendering and routing

The app uses React Router 7 with a `BrowserRouter`. Routes are defined in `src/routes.tsx` and organized into three layout shells:

| Layout | Routes | Purpose |
| --- | --- | --- |
| `MainLayout` | `/`, `/cart`, `/checkout`, `/profile/*` | Public storefront with navbar and footer |
| `ProfileLayout` | `/profile`, `/address`, `/orders`, `/order/:id` | Nested within MainLayout, adds profile sidebar |
| `AdminLayout` | `/admin/*` | Admin panel with sidebar; guards against non-admin users |

Cart and Checkout pages are lazy-loaded with `React.lazy()` and wrapped in `<Suspense>`.

### State management

The frontend separates server state from client state:

| Concern | Tool | What it manages |
| --- | --- | --- |
| Server state | TanStack Query | All API data: products, cart, orders, users, dashboard, chat |
| Auth state | Zustand (persisted) | Current user, JWT token, login/logout |
| UI state | Zustand (ephemeral) | Modal open/close, socket instance, chat session, date filters |

The Axios instance (`src/lib/axios.ts`) attaches the JWT from the Zustand user store to every outgoing request via a request interceptor.

### Hooks architecture

API interactions are abstracted into hook modules under `src/hooks/`. Each module exports a namespace object (e.g., `CART_API_HOOKS`, `ORDER_API_HOOKS`) containing custom hooks that wrap `useQuery`, `useSuspenseQuery`, and `useMutation` from TanStack Query.

Three factory functions in `src/hooks/useApi.ts` reduce boilerplate:

| Factory | Wraps | Purpose |
| --- | --- | --- |
| `createQuery` | `useQuery` | Standard data fetching with optional data key extraction |
| `createSuspenseQuery` | `useSuspenseQuery` | Suspense-compatible data fetching |
| `createMutation` | `useMutation` | Mutations with automatic query invalidation |

### Component organization

Components are organized by domain:

```text
components/
  admin/       Admin-specific UI (sidebar, dashboard cards, transfer)
  auth/        Login and register forms
  common/      Shared components (global modal, error boundary, chat, order display)
  main/        Storefront components (navbar, footer, product cards, menu, customization)
  table/       Reusable data table with pagination and search
```

### Form validation

Client-side validation uses React Hook Form with Zod resolvers. Validation schemas are defined in `src/lib/zodSchema.ts` for registration, login, product creation, and menu creation. The address form defines its schema inline.

## Cross-cutting concerns

### Authentication flow

1. User submits credentials via login/register form.
2. Backend validates, hashes password (register) or compares hash (login), and returns a JWT + user object.
3. Frontend stores both in Zustand's persisted user store (localStorage).
4. Every subsequent Axios request attaches `Authorization: Bearer <token>` via interceptor.
5. Backend middleware decodes the JWT and attaches the user to the request.

### Error handling

- **Backend**: `asyncHandler` catches thrown errors. `AppError` class carries a status code and message. The global error handler formats and returns the response.
- **Frontend**: TanStack Query's global `MutationCache.onError` catches mutation errors and shows a Mantine notification. Individual `onSuccess` callbacks show success notifications.

### Image handling

Product and menu images are uploaded as `multipart/form-data` via Multer. Files are stored on disk in `backend/uploads/` with generated filenames. The frontend constructs image URLs as `${BASE_URL}${product.image}`.
