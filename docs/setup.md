# Setup Guide

## Prerequisites

- **Node.js** 22.13.0+ and **pnpm** package manager
- **PostgreSQL** 15+ running locally or remotely
- A terminal (PowerShell, CMD, or bash)

## 1. Clone the repository

```bash
git clone <repository-url>
cd food
```

## 2. Backend setup

### Install dependencies

```bash
cd backend
pnpm install
```

### Configure environment

Create a `.env` file in the `backend/` directory:

```env
PORT=3000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=pizzastore

# Auth
JWT_SECRET=your_jwt_secret_here

# Dedicated 32+ character secret for Prometheus scrapes
METRICS_BEARER_TOKEN=replace_with_a_random_metrics_only_secret

# Frontend URL (for CORS and Socket.IO)
FE_URL=http://localhost:3150

# Credential-free simulator is the safe default
PAYMENT_PROVIDER_MODE=simulator

# Required only when storing bank/PAN-like payroll metadata (32+ characters)
# PAYROLL_ENCRYPTION_KEY=<dedicated random secret from your secret manager>

# Optional Razorpay Test Mode (configure all three together)
RAZORPAY_ENABLED=false
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=your_test_key_secret
RAZORPAY_WEBHOOK_SECRET=your_test_webhook_secret
```

All variables are validated at startup via Zod. The server will not start if any required variable is missing or invalid.

#### Environment variable reference

| Variable | Required | Description |
| --- | --- | --- |
| `PORT` | Yes | Server port (must be exactly 4 digits, e.g. `3000`) |
| `DB_HOST` | No* | PostgreSQL host |
| `DB_PORT` | No* | PostgreSQL port |
| `DB_USER` | No* | PostgreSQL username |
| `DB_PASSWORD` | No* | PostgreSQL password |
| `DB_NAME` | No* | PostgreSQL database name |
| `DATABASE_URL` | No* | Full connection URL (alternative to individual DB_* vars) |
| `JWT_SECRET` | Yes | Secret key for signing JSON Web Tokens |
| `METRICS_BEARER_TOKEN` | Production | Dedicated 32+ character bearer token required by `GET /metrics`; do not reuse `JWT_SECRET` |
| `FE_URL` | Yes | Frontend origin URL for CORS configuration |
| `PAYMENT_PROVIDER_MODE` | No | `simulator` (default) or `razorpay_test`; `razorpay_live` refuses startup |
| `RAZORPAY_KEY_ID` | No** | Public Razorpay Test Mode key ID |
| `RAZORPAY_KEY_SECRET` | No** | Server-only Razorpay API key secret |
| `RAZORPAY_WEBHOOK_SECRET` | No** | Server-only secret used to validate webhook signatures |
| `RAZORPAY_ENABLED` | No | Set to `true` to offer new/retried online checkouts; defaults to `false` |
| `PAYROLL_ENCRYPTION_KEY` | Conditional | Dedicated 32+ character secret used for authenticated encryption of payroll-sensitive identifiers |

\* Either `DATABASE_URL` or the individual `DB_*` variables must be provided.

\** Razorpay variables may be omitted in simulator mode. If any one is set, all three are required. Live key IDs are rejected, and secrets must never be exposed to the frontend.

`PAYROLL_ENCRYPTION_KEY` is required before creating or updating a payroll profile containing bank/PAN-like metadata. Generate it independently from `JWT_SECRET`, retain it in a secret manager, and do not rotate it without a data re-encryption plan.

`RAZORPAY_ENABLED=true` requires all three credentials. Setting it to `false`
immediately removes Razorpay from checkout and blocks new/retried attempts while
COD remains available. Keep the credentials configured during a rollback so
verification, webhooks, and reconciliation can safely finish in-flight payments.

### Create the database

```bash
# Using psql
psql -U postgres -c "CREATE DATABASE pizzastore;"
```

### Apply the schema and migrations

```bash
# Apply the checked-in migration history
pnpm run db:migrate
```

### Reset and seed the deterministic demo (recommended)

After applying migrations, run from the repository root:

```bash
pnpm demo:reset
```

This is a destructive development command. It accepts only a local PostgreSQL URL, refuses `NODE_ENV` values other than `development`, truncates application tables, restarts identities, and seeds two stores, catalogue/stock, costs, ledger accounts, demo personas, and the complete deterministic July/August 2026 finance scenario. The scenario includes discounted and refunded orders, a failed payment, reconciled settlements, a COD variance, allocated expenses, compensation history and posted payroll, a closed July period, processed source events, and balanced journals. Reset output prints stable source mappings and the expected headline totals from the checked-in fixture. It never runs automatically during application startup. See the [finance demo walkthrough](./finance-demo-walkthrough.md).

### Seed individual data sets (optional)

The project includes seed scripts in `src/scripts/`:

```bash
# Seed users (creates test user and admin accounts)
pnpm run seed:users

# Seed addresses for test users
pnpm run seed:addresses

# Seed sample orders with items and customizations
pnpm run seed:orders

# Optionally assign existing users as development store staff
pnpm run seed:staff -- --actor=admin@pizzastore.com --store=mumbai-central --member=manager:manager@example.com
```

The staff seed is development-only, creates no accounts or passwords, and requires existing users and stores. See the [store staff authorization runbook](./store-staff-authorization.md) for all arguments, role rules, migration preflight, and deployment order.

### Start the development server

```bash
pnpm run dev
```

The backend will start on `http://localhost:3000` (or whatever `PORT` is set to). The API is available at `http://localhost:3000/api/v1/`.

## 3. Frontend setup

### Install dependencies

```bash
cd frontend
pnpm install
```

### Configure environment

Create a `.env` file in the `frontend/` directory:

```env
VITE_BACKEND_URL=http://localhost:3000
```

| Variable | Required | Description |
| --- | --- | --- |
| `VITE_BACKEND_URL` | Yes | Base URL of the backend API server |

### Start the development server

```bash
pnpm run dev
```

The frontend will start on `http://localhost:3150`. It connects to the backend URL specified in `.env`.

### Build and host the public case study

The public engineering case study is available at `/docs` and does not require
authentication or a working backend. Build the frontend with `pnpm run build`
and deploy the generated `frontend/dist/` directory as a single-page app.

Configure the host to serve `index.html` for application paths that do not map
to a real static file. This fallback is required for direct loads and refreshes
of `/docs`, `/docs/architecture`, `/docs/order-lifecycle`, `/docs/inventory`,
`/docs/decisions`, and `/docs/reliability`. Preserve normal 404 handling for
missing assets. The nested docs router handles unknown `/docs/*` paths after the
SPA entry point loads.

Optional `VITE_DOCS_REPOSITORY_URL` may contain the public HTTPS GitHub repository
root. Omit it when no public repository is available; repository actions then
remain hidden. Verify the host's fallback with direct URLs after deployment,
because local client navigation does not establish hosted refresh behavior.

## 4. Verify the setup

1. Open `http://localhost:3150` in a browser.
2. You should see the PizzaStore home page with the menu section and real-time stock statuses.
3. Register a new account or log in with a seeded user.
4. Browse products, add items to cart, and test the checkout flow.

Online payment uses the deterministic local simulator by default, so the full
browser flow works without provider credentials or network access. Set
`PAYMENT_PROVIDER_MODE=razorpay_test`, configure all three Razorpay variables,
and set `RAZORPAY_ENABLED=true` only when exercising the optional Test Mode
adapter. The backend creates provider orders and returns the
public key ID; the API key secret and webhook secret remain server-only. Apply
the payment lifecycle migration before calling the Razorpay payment endpoints.
Configure automatic capture in the Razorpay Dashboard: verification deliberately
keeps an order in `awaiting_payment` until Razorpay reports its payment as
`captured` and its order as `paid`.

The frontend contains Razorpay Checkout and retry integration. Do not add a
Razorpay key or secret to the frontend environment: the public key ID, amount,
currency, and provider order ID belong in the authenticated initiation response.
At the audited revision, however, the frontend calls payment-method discovery
and retry endpoints that are not registered by `payment.routes.ts`, and retry
service code does not recreate released inventory reservations. Treat the
browser steps below as release checks that remain blocked until that wiring and
recovery behavior are completed and re-audited.

To exercise the default simulator browser flow, select **Pay online** and submit
the order. The frontend requests the deterministic `successful` scenario and
the server performs the same reconciliation/finalization policy used by the
Razorpay adapter. To exercise Razorpay Test Mode instead:

1. Add an item to the cart, select an address, and choose **Pay online**.
2. Complete Checkout with a Razorpay Test Mode payment method.
3. Confirm that the order moves from `awaiting_payment` to `pending` only after
   server verification.
4. Close Checkout on another attempt and confirm that **Retry payment** appears
   on that order's details page.

Configure the Dashboard webhook URL as:

```text
https://<public-backend-host>/api/v1/payments/razorpay/webhook
```

Subscribe to `payment.captured`, `payment.failed`, and `order.paid`, and set the
Dashboard webhook secret to the exact `RAZORPAY_WEBHOOK_SECRET` value. The URL
must be public HTTPS. Do not send browser requests to this endpoint and do not
place it behind JWT authentication or JSON-transforming middleware.

Run stale-payment reconciliation from a trusted scheduler or operations shell:

```bash
pnpm run payments:reconcile
```

Optional `RECONCILE_OLDER_THAN_MINUTES` (default `15`) and `RECONCILE_LIMIT`
(default `25`, maximum `50`) environment variables control each batch. The
command exits non-zero when its result reports one or more errors. Failed or
unchanged payment outcomes remain in the JSON result and need inspection. The
equivalent admin API is `POST /api/v1/payments/razorpay/reconcile`.

Expired inventory reservations use a separate one-shot command:

```bash
pnpm run inventory:reconcile-reservations
```

`RECONCILE_LIMIT` defaults to `25` and has a maximum of `100` for this command.
It exits non-zero on reported errors; conflicts are separate results and must
also be inspected. Neither reconciliation command is scheduled by application
startup, and no scheduler is included in this repository.
See [the Razorpay operations runbook](./razorpay-runbook.md) for optional Test
Mode validation, monitoring, rollback, and reconciliation. Live mode is unsupported.
For step-by-step credential creation during development, see the
[Razorpay Test Mode credentials guide](./razorpay-test-credentials.md).

### Access the admin panel

1. Log in with an admin account (created via seeding or by manually setting `role = 'admin'` in the database).
2. Navigate to `/admin` in the browser.
3. You should see the admin dashboard with real-time metrics (including low stock counts), inventory management, and charts.

## 5. Available scripts

### Backend (`backend/package.json`)

| Script | Command | Description |
| --- | --- | --- |
| `dev` | `nodemon src/index.ts` | Start the development server with restart-on-change behavior |
| `test` | `vitest run src --pool=threads` | Run backend unit test suite |
| `test:watch` | `vitest src --pool=threads` | Run backend tests in interactive watch mode |
| `build` | `tsc -p tsconfig.json` | Compile TypeScript backend to JavaScript |
| `typecheck` | `tsc --noEmit` | Check TypeScript types without emitting files |
| `payments:reconcile` | `ts-node src/scripts/reconcile-payments.ts` | Run one bounded stale-payment reconciliation batch |
| `inventory:reconcile-reservations` | `ts-node src/scripts/reconcile-inventory-reservations.ts` | Run one bounded expired-reservation reconciliation batch |
| `seed:users` | `ts-node src/scripts/user.ts` | Seed user accounts |
| `seed:addresses` | `ts-node src/scripts/address.ts` | Seed delivery addresses |
| `seed:orders` | `ts-node src/scripts/order.ts` | Seed sample orders |
| `seed:staff` | `ts-node src/scripts/staff.ts` | Idempotently assign existing users to a store in development only |
| `demo:reset` | `ts-node src/scripts/demo-reset.ts --confirm-local-demo-reset` | Destructively reset and seed the local two-store demo |
| `finance:post-events` | `ts-node src/scripts/post-financial-events.ts` | Claim and post up to 100 pending financial events |
| `finance:reconcile-fixture` | `ts-node src/scripts/reconcile-financial-scenario.ts` | Reconcile every finance report and CSV export against the checked-in two-store expected results |
| `db:migrate` | `drizzle-kit migrate` | Apply checked-in migrations through repository head |

### Frontend (`frontend/package.json`)

| Script | Command | Description |
| --- | --- | --- |
| `dev` | `vite --port 3150` | Start Vite dev server |
| `build` | `tsc -b && vite build` | Type-check and build for production |
| `lint` | `eslint .` | Run ESLint |
| `test` | `vitest run` | Run deterministic frontend unit tests |
| `preview` | `vite preview` | Preview production build locally |

## 6. Database migrations

To generate a new migration after changing `src/db/schema/`:

```bash
pnpm run db:generate
```

To apply pending migrations:

```bash
pnpm run db:migrate
```

To open Drizzle Studio (visual database browser):

```bash
npx drizzle-kit studio
```

Do not use `db:push` as a production migration substitute. For backup, forward-only recovery, failed migration handling, and post-migration finance checks, follow the [finance operations runbook](./finance-operations-runbook.md#migration-deployment-and-recovery).

## File upload directory

Product and menu images are uploaded to `backend/uploads/`. This directory is created automatically on first upload and served statically by Express. It is excluded from version control via `.gitignore`.

## Troubleshooting

### "Access denied, no token provided"
The request requires authentication. Ensure you're logged in and the `Authorization: Bearer <token>` header is being sent.

### Database connection errors
Verify that PostgreSQL is running and the credentials in `.env` match your database configuration. Test with `psql -U <user> -d <dbname>`.

### CORS errors in the browser
Ensure `FE_URL` in the backend `.env` matches the exact origin of your frontend (including protocol and port).

### Images not loading
Verify the `VITE_BACKEND_URL` in the frontend `.env` points to the correct backend URL. Images are served from `<backend-url>/uploads/<filename>`.
