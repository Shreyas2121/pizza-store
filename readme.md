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

- React 19 with Vite 6 and TypeScript for the storefront and admin interfaces
- Mantine 7 component library with Tailwind CSS 3 for styling
- TanStack Query 5 for server-state management and caching
- TanStack Table 8 for admin data tables
- Zustand 5 for transient client state (auth, modals, chat, date filters)
- React Hook Form with Zod resolvers for form validation
- Socket.IO Client for real-time events
- Recharts and Mantine Charts for admin analytics visualizations
- Node.js with Express 4 for the API server
- Drizzle ORM 0.38 with PostgreSQL for schema, queries, and migrations
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
| [store-staff-authorization.md](docs/store-staff-authorization.md) | Staff role matrix, lifecycle operations, deployment, rollback, and security verification |
| [razorpay-runbook.md](docs/razorpay-runbook.md) | Online payment lifecycle, inventory reservations, monitoring, and reconciliation |

## Application in one workflow

A user opens the storefront, browses menu categories, selects a product with optional customizations (e.g., toppings, sizes), and adds it to their cart subject to available store stock. At checkout, they select a saved delivery address, optionally apply a coupon code, and choose Cash on Delivery or online payment. The backend atomically creates the order, verifies/deducts or reserves stock, copies cart items and customizations to order records, clears the cart, and emits a Socket.IO event. The admin panel receives real-time order and low-stock notifications, monitors inventory counts, performs restocks or adjustments, and updates orders through fulfillment. A live chat system allows users to request support and exchange messages with an admin in real time.

## Development

Prerequisites: Node.js 20+, pnpm, and a running PostgreSQL instance.

```text
# Backend
cd backend
cp .env.example .env        # configure database credentials and JWT secret
pnpm install
pnpm run db:generate        # generate migrations
npx drizzle-kit push        # apply schema to database
pnpm run seed:users         # seed test users
pnpm run seed:addresses     # seed test addresses
pnpm run seed:orders        # seed test orders
pnpm run test               # run backend unit test suite
pnpm run dev                # start Express on port 3000

# Frontend
cd frontend
cp .env.example .env        # set VITE_BACKEND_URL
pnpm install
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
