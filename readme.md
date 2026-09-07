# PizzaStore — Food Delivery Platform

PizzaStore is a full-stack food delivery and management-accounting application with a React storefront, an Express API server, and PostgreSQL. It covers authoritative checkout pricing, COD and credential-free simulated online payments, inventory, refunds, settlements, expenses, append-only double-entry posting, period close, store/consolidated finance reports, CSV exports, and real-time operations.

The project is structured as two independent packages (`backend/` and `frontend/`) in a single repository. Each package manages its own dependencies and dev server.

## Product principles

1. Users browse a menu-driven product catalogue with customizable items and real-time stock availability badges.
2. Cart operations are transactional — price consistency and available stock limits are enforced server-side.
3. Orders are placed atomically: cart items, customizations, stock deductions/reservations, and coupon redemptions resolve in a single database transaction.
4. Admin operations (product creation, order status updates, inventory management, coupon management, dashboard analytics) are role-gated.
5. Real-time communication uses Socket.IO for order placement notifications, low-stock threshold alerts, and live chat support.
6. All environment-specific values are loaded through validated environment variables.
7. Financial amounts are exact integer paise; payment capture and delivery recognition are distinct, and posted journals are corrected through reversal rather than editing.

## Chosen stack

- React 19 with Vite 8 and TypeScript for the storefront and admin interfaces
- Mantine 7 component library with Tailwind CSS 3 for styling
- TanStack Query 5 for server-state management and caching
- TanStack Table 8 for admin data tables
- Zustand 5 for transient client state (auth, modals, chat, date filters)
- React Hook Form with Zod resolvers for form validation
- Socket.IO Client for real-time events
- Recharts and Mantine Charts for admin analytics visualizations
- Node.js 22 with Express 5 for the API server
- Drizzle ORM 0.45 with PostgreSQL for schema, queries, and migrations
- Zod for request and environment validation
- Socket.IO for server-side WebSocket events
- JSON Web Tokens for stateless authentication
- bcrypt for password hashing
- Multer for image uploads
- Winston for structured file and console logging

See [architecture.md](docs/architecture.md) for component boundaries and [database-schema.md](docs/database-schema.md) for the full data model.

## Documentation map

| Document | Purpose |
| --- | --- |
| [architecture.md](docs/architecture.md) | System components, dependency rules, data flow, and frontend/backend boundaries |
| [database-schema.md](docs/database-schema.md) | All tables, columns, relations, constraints, and Drizzle schema conventions |
| [api-reference.md](docs/api-reference.md) | Complete REST API endpoint reference with request/response shapes |
| [setup.md](docs/setup.md) | Local development environment setup, database provisioning, and seeding |
| [Architecture decision records](docs/adr/README.md) | Accepted financial semantics for money, recognition, tax, and business dates |
| [Finance lifecycle and event contracts](docs/finance-lifecycle-contracts.md) | Planned state machines, event payloads, reversals, and database lock order |
| [Finance API compatibility and rollout map](docs/finance-api-compatibility-rollout.md) | Endpoint contracts, server quote consolidation, error codes, and permission matrix |
| [Deterministic two-store financial fixtures](docs/two-store-financial-fixtures.md) | Reference scenario, P&L benchmarks, settlement matching, and expected outputs |
| [Finance demo walkthrough](docs/finance-demo-walkthrough.md) | Credential-free online/COD walkthrough from source transaction through P&L and CSV |
| [Finance operations runbook](docs/finance-operations-runbook.md) | Reconciliation, refunds, outbox recovery, period close, migrations, and limitations |
| [Finance report performance](docs/finance-report-performance.md) | Report latency target, query-plan harness, and index decision |
| [store-staff-authorization.md](docs/store-staff-authorization.md) | Staff role matrix, lifecycle operations, deployment, rollback, and security verification |
| [razorpay-runbook.md](docs/razorpay-runbook.md) | Online payment lifecycle, inventory reservations, monitoring, and reconciliation |

## Application in one workflow

A user opens the storefront, browses menu categories, selects a product with optional customizations (e.g., toppings, sizes), and adds it to their cart subject to available store stock. At checkout, they select a saved delivery address, optionally apply a coupon code, and choose Cash on Delivery or online payment. The backend atomically creates the order, verifies/deducts or reserves stock, copies cart items and customizations to order records, clears the cart, and emits a Socket.IO event. The admin panel receives real-time order and low-stock notifications, monitors inventory counts, performs restocks or adjustments, and updates orders through fulfillment. A live chat system allows users to request support and exchange messages with an admin in real time.

## Development

Prerequisites: Node.js 22.13+, pnpm, and a local PostgreSQL instance.

```text
# Backend
cd backend
# create .env using the values in docs/setup.md
pnpm install
pnpm run db:migrate         # apply checked-in migrations
pnpm run test               # run backend unit test suite
pnpm run dev                # start Express on port 3000

# Frontend
cd frontend
# create .env using the values in docs/setup.md
pnpm install
pnpm run dev                # start Vite on port 3150
```

For the deterministic two-store portfolio demo, configure a local development database, apply migrations, then run this destructive local-only command from the repository root:

```text
pnpm demo:reset
```

It creates owner, customer, and finance-manager personas and refuses remote or production databases. Continue with the [finance demo walkthrough](docs/finance-demo-walkthrough.md).

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
        finance-reports/     Ledger-backed overview, P&L, sales/margins, CSV exports
        ledger/              Chart, balanced journals, reversal, trial balance, periods
        finance-events/      Transactional outbox and idempotent posting worker
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
