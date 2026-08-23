# PizzaStore — Food Delivery Platform

PizzaStore is a full-stack food delivery application with a React storefront, an Express API server, and a PostgreSQL database. It covers product browsing with multi-level customization, cart management, coupon application, Cash on Delivery checkout, real-time order and chat notifications over Socket.IO, and a role-separated admin panel with analytics.

The project is structured as two independent packages (`backend/` and `frontend/`) in a single repository. Each package manages its own dependencies and dev server.

## Product principles

1. Users browse a menu-driven product catalogue with customizable items.
2. Cart operations are transactional — price consistency is enforced server-side.
3. Orders are placed atomically: cart items, customizations, and coupon redemptions resolve in a single database transaction.
4. Admin operations (product creation, order status updates, coupon management, dashboard analytics) are role-gated.
5. Real-time communication uses Socket.IO for order placement notifications and live chat support.
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

## Application in one workflow

A user opens the storefront, browses menu categories, selects a product with optional customizations (e.g., toppings, sizes), and adds it to their cart. At checkout, they select a saved delivery address, optionally apply a coupon code, and place the order as Cash on Delivery. The backend atomically creates the order, copies cart items and customizations to order records, clears the cart, and emits a Socket.IO event. The admin panel receives a real-time notification, views the order, and updates its status through the order lifecycle. A live chat system allows users to request support and exchange messages with an admin in real time.

## Development

Prerequisites: Node.js 20+, pnpm, and a running PostgreSQL instance.

```text
# Backend
cd backend
cp .env.example .env        # configure database credentials and JWT secret
pnpm install
npx drizzle-kit push        # apply schema to database
pnpm run seed:users         # seed test users
pnpm run seed:addresses     # seed test addresses
pnpm run seed:orders        # seed test orders
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
        cart/                Add, update, remove, clear (transactional)
        order/               Order creation, status, admin views
        payments/            COD payment processing
        coupon/              CRUD, validation, redemption
        dashboard/           Revenue, orders, active users analytics
        chat/                Real-time support sessions and messaging
      middleware/            JWT auth (user and admin guards)
      utils/                 Error handling, logging, multer, Zod schemas, types
      scripts/               Database seeding (users, addresses, orders)
    migrations/              Generated SQL migrations
    uploads/                 User-uploaded product images
  frontend/
    src/
      components/
        admin/               Sidebar, dashboard cards, transfer, product forms
        auth/                Login and register forms
        common/              Global modal, error boundary, chat, order components
        main/                Navbar, footer, product cards, menu, customization
        table/               Reusable data table with pagination and search
      hooks/                 React Query wrappers per feature domain
      layouts/               Admin, main, and profile layout shells
      lib/                   Axios instance, types, constants, Zod schemas, utils
      pages/
        admin/               Dashboard, products, orders, customization, menu, support
        main/                Home, cart, checkout, profile, orders
      store/                 Zustand stores (user, modal, chat, datepicker)
      routes.tsx             Route definitions with lazy loading and auth guards
    public/                  Static assets
  docs/                      Project documentation
```

## License

No license has been selected yet.
