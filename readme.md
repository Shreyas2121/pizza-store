# PizzaStore — Food Delivery Platform

PizzaStore is a full-stack food delivery application with a React storefront, an Express API server, and a PostgreSQL database. It covers product browsing with multi-level customization, cart management, coupon application, Cash on Delivery checkout, real-time order and chat notifications over Socket.IO, and a role-separated admin panel with analytics.

The project is structured as two independent packages (`backend/` and `frontend/`) in a single repository. Each package manages its own dependencies and dev server.

## Product principles

1. Users browse a menu-driven product catalogue with customizable items and real-time stock availability badges.
2. Cart operations are transactional — price consistency and available stock limits are enforced server-side.
3. Orders are placed atomically: cart items, customizations, stock deductions/reservations, and coupon redemptions resolve in a single database transaction.
4. Admin operations (product creation, order status updates, inventory management, coupon management, dashboard analytics) are role-gated.
5. Real-time communication uses Socket.IO for order placement notifications, low-stock threshold alerts, and live chat support.
6. All environment-specific values are loaded through validated environment variables.

## Chosen stack

- React with Vite and TypeScript for the storefront and admin interfaces
- Mantine 7 component library with Tailwind CSS 3 for styling
- TanStack Query 5 for server-state management and caching
- TanStack Table for admin data tables
- Zustand 5 for transient client state (auth, modals, chat, date filters)
- React Hook Form with Zod resolvers for form validation
- Socket.IO Client for real-time events
- Recharts and Mantine Charts for admin analytics visualizations
- Node.js with Express for the API server
- Drizzle ORM with PostgreSQL for schema, queries, and migrations
- Zod for request and environment validation
- Socket.IO for server-side WebSocket events
- JSON Web Tokens with current-user and token-version validation on authenticated requests
- bcrypt for password hashing
- Multer for image uploads
- Winston for structured file and console logging

See [architecture.md](docs/architecture.md) for component boundaries and [database-schema.md](docs/database-schema.md) for the full data model.

Package manifests and lockfiles define dependency versions. See the dated
[case-study evidence audit](docs/case-study-evidence.md) for the verification
baseline and implementation limits, including payment route wiring and a local
frontend dependency mismatch. Re-audit those claims after financial changes merge.

## Engineering case study

The frontend publishes a public engineering notebook at `/docs`. In local
development, open `http://localhost:3150/docs`. It covers application boundaries,
checkout and payment states, inventory locking and reservations, engineering
decisions, and recovery evidence. The inventory page includes a deterministic
last-item scenario explorer; it is a teaching model rather than a database test.

Use the [two-minute walkthrough](docs/case-study-walkthrough.md) for a guided tour
and its current publication gaps. A public repository URL, deployed URL, current
screenshot, and personal contribution statement are intentionally omitted until
verified.

## Documentation map

| Document | Purpose |
| --- | --- |
| [architecture.md](docs/architecture.md) | System components, dependency rules, data flow, and frontend/backend boundaries |
| [database-schema.md](docs/database-schema.md) | All tables, columns, relations, constraints, and Drizzle schema conventions |
| [api-reference.md](docs/api-reference.md) | Complete REST API endpoint reference with request/response shapes |
| [setup.md](docs/setup.md) | Local development environment setup, database provisioning, and seeding |
| [store-staff-authorization.md](docs/store-staff-authorization.md) | Staff role matrix, lifecycle operations, deployment, rollback, and security verification |
| [razorpay-runbook.md](docs/razorpay-runbook.md) | Online payment lifecycle, inventory reservations, monitoring, and reconciliation |
| [case-study-evidence.md](docs/case-study-evidence.md) | Reviewed source claims, transaction/cancellation maps, test categories, baseline results, and limitations |
| [case-study-walkthrough.md](docs/case-study-walkthrough.md) | Two-minute case-study tour, interview prompts, and remaining publication inputs |
| [public-docs.md](docs/public-docs.md) | Public docs authoring, evidence-link, hosting, and verification guidance |

## Application in one workflow

A user opens the storefront, browses menu categories, selects a product with optional customizations (e.g., toppings, sizes), and adds it to their cart subject to available store stock. Checkout uses a saved delivery address and optional coupon. COD creation atomically records the order/payment, deducts tracked stock, copies item/customization prices, and clears the cart; its route emits notifications after commit. Online initiation reserves tracked stock locally before calling Razorpay, with provider verification and reconciliation handled separately. Payment method discovery/retry route gaps and notification limits at the reviewed revision are documented in the evidence audit. Staff interfaces expose order fulfillment and stock operations, and the app includes support chat.

## Development

Prerequisites: a Node.js version compatible with both package manifests (backend requires at least 22.13.0), pnpm, and a running PostgreSQL instance. Use an isolated database for development and seeds.

```text
# Backend
cd backend
cp .env.example .env        # configure database credentials and JWT secret
pnpm install
pnpm run db:migrate         # apply committed migrations; follow migration preflight in the staff runbook
pnpm run seed:users         # seed test users
pnpm run seed:addresses     # seed test addresses
pnpm run seed:orders        # seed test orders
pnpm run test               # review case-study baseline first: one payment test currently reaches the configured DB
pnpm run dev                # start Express on port 3000

# Frontend
cd frontend
cp .env.example .env        # set VITE_BACKEND_URL
pnpm install
pnpm run test               # run deterministic frontend model tests
pnpm run build              # create the production bundle in frontend/dist
pnpm run dev                # start Vite on port 3150
```

## Repository layout

```text
food/
  backend/
    src/
      db/                    Drizzle client and schema definitions
      features/              Feature modules (routes + services)
        users/               Registration, login, addresses
        products/            CRUD, menu filtering, sorting
        category/            Category management
        customization/       Groups, options, product mapping
        menu/                Menu items and product assignments
        cart/                Add, update, remove, clear (transactional stock checks)
        order/               Order creation, status, admin views
        payments/            COD and Razorpay payment processing
        inventory/           Stock queries, bulk restock, adjustments, movements
        coupon/              CRUD, validation, redemption
        dashboard/           Revenue, orders, active users, low stock analytics
        chat/                Real-time support sessions and messaging
      middleware/            JWT auth (user and admin guards)
      utils/                 Error handling, logging, multer, Zod schemas, types
      scripts/               Database seeding and payment/inventory reconciliation
    migrations/              Generated SQL migrations
    uploads/                 User-uploaded product images
  frontend/
    src/
      app/                   Layouts, providers, router
      features/              Feature modules (api, components, model, pages)
        docs/                Public engineering case study and inventory explorer
        inventory/           Admin stock table, restock modals, movement drawer
        catalog/             Product cards, customization drawer, stock badges
        cart/                Cart page, item mutations, stock conflict handling
        checkout/            COD and Razorpay checkout flows
        admin-dashboard/     KPI cards (including Low Stock), analytics charts
        support/             Live customer chat
      shared/                Reusable UI primitives, error parsing, and utilities
    public/                  Static assets
  docs/                      Project documentation
```

## License

No license has been selected yet.
