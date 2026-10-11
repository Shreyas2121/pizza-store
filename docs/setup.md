# Local setup

Run workspace commands from the repository root unless a command explicitly names a package. Required tools: Node.js 22.13 or newer, pnpm, and PostgreSQL. Use a separate development database.

## Install and configure

```sh
pnpm install --frozen-lockfile
```

Copy [backend/.env.example](../backend/.env.example) to `backend/.env` and [frontend/.env.example](../frontend/.env.example) to `frontend/.env`. Both servers load configuration relative to their package working directory.

| Backend variable | Behavior |
| --- | --- |
| `PORT` | Required four-character string; use `3000` locally |
| `DATABASE_URL` | Preferred PostgreSQL connection string; otherwise provide all `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` fields |
| `JWT_SECRET` | Required server-only signing secret; choose a random value |
| `FE_URL` | Required frontend origin for HTTP and Socket.IO CORS; locally `http://localhost:3150` |
| `NODE_ENV` | `development`, `test`, or `production`; default development |
| `JWT_ALGORITHM` | Only HS256 |
| `JWT_ISSUER` / `JWT_AUDIENCE` | Defaults `pizzastore-api` / `pizzastore-web` |
| `JWT_EXPIRES_IN` | `4h`, `6h`, or `8h`; default `6h` |
| `METRICS_BEARER_TOKEN` | At least 32 characters when supplied; mandatory in production for protected metrics |
| `STAFF_INVITATION_EXPIRY_HOURS` | Integer 1–168; default 48 |
| `PAYMENT_PROVIDER_MODE` | Default `simulator`; optional `razorpay_test`; live mode rejected |
| `RAZORPAY_ENABLED` | Default `false`; gates new/retried Test Mode attempts, ignored in simulator mode |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | All three together or none; required for Test Mode; live key IDs rejected |
| `REFUND_MANAGER_APPROVAL_LIMIT_PAISE` | Positive integer up to 2,147,483,647; default 500,000 |
| `EXPENSE_MANAGER_APPROVAL_LIMIT_PAISE` | Positive integer up to 50,000,000; default 500,000 |
| `PAYROLL_ENCRYPTION_KEY` | Optional, at least 32 characters; required for encrypted bank/PAN-like demo fields |

The exact startup rules are in [zodSchema.ts](../backend/src/utils/zodSchema.ts). Database URL/component fields are optional in that schema, so a successful environment parse does not prove valid database connectivity. [constants.ts](../backend/src/constants.ts) chooses the URL, and [db/index.ts](../backend/src/db/index.ts) configures the pool.

The frontend requires `VITE_BACKEND_URL` as the backend origin, without `/api/v1`. Optional `VITE_DOCS_REPOSITORY_URL` is a public HTTPS GitHub repository root. These values are compiled into the browser bundle.

## Create and migrate the database

Create the database named in your connection string. For example, using local PostgreSQL:

```sh
psql -U postgres -c "CREATE DATABASE pizzastore;"
pnpm db:migrate
```

Apply the checked-in history through `0030_remove_legacy_coupons`. Drizzle configuration points to `backend/migrations`. Keep migration metadata and custom SQL: ledger balance/immutability triggers are not fully represented by Drizzle table declarations.

Use `pnpm db:generate` after deliberate schema changes and review generated SQL. `db:push` exists as a development shortcut, but does not replace the complete migration history or its custom triggers. The repository's documented data policy is fresh disposable databases; an existing-data upgrade/backfill is not established.

## Choose initial data

| Option | When to use it |
| --- | --- |
| [Recruiter seed](recruiter-demo.md) | An existing admin in otherwise cleared application tables; recent showcase history, all staff roles and generated receipts/banners |
| `pnpm demo:reset` | A disposable local development database; destructive reset plus deterministic July/August finance history |
| `pnpm db:seed` | Base users, catalogue, default store and promotion fixtures; not the complete finance/showcase scenario |
| Manual configuration | Configure stores/products/stock/zones in the admin UI; [store pricing defaults](store-checkout-pricing.md) explain automatic rules and repair |

Do not combine complete seed/reset strategies on the same populated database. The recruiter seed preserves existing admins but requires existing food-image files in `backend/uploads`; those files are ignored by Git and are not included in a fresh clone. Its `--plan` mode works without connecting to the database. The fixed demo reset refuses remote hosts and any environment other than development. No seed or reset runs on application startup.

The smaller backend seed scripts include `seed:users`, `seed:addresses`, `seed:orders`, `seed:catalog`, `seed:default-store`, `seed:promotions`, and `seed:staff`. They have different prerequisites; use `pnpm --filter backend <script>` and inspect their source before using them on existing data. The staff command only assigns existing users to existing stores; see [staff authorization](store-staff-authorization.md).

## Start and smoke-check

```sh
pnpm dev
```

Open `http://localhost:3150` and `http://localhost:3150/docs`. The API is `http://localhost:3000/api/v1` unless you change `PORT`. Register/sign in using the header modal. Choose a serviceable address and an open store, add an available item, inspect the server quote, and place COD or simulated online checkout. Staff screens begin at `/admin`; backend permissions determine available actions.

The simulator is credential-free and supports successful, failed, delayed, duplicate and out-of-order scenarios through its authenticated API. Normal browser checkout requests `successful`. Provider state is in memory; persisted old demo payment IDs are not reconstructed after a process restart. Demonstrate retries/refunds with fresh checkout orders.

Method discovery and retry are mounted. Retry restores saved inventory and promotion capacity in one transaction and keeps the saved payable amount; shortages can reject recovery. See [reservation recovery](payment-inventory-retry.md).

## Optional Razorpay Test Mode

Configure all three server-only credentials, select `razorpay_test` and enable `RAZORPAY_ENABLED`. Do not configure provider secrets in the frontend. The initiation response supplies the public key, exact amount and provider order ID.

The raw-body webhook endpoint is `/api/v1/payments/razorpay/webhook`. The adapter checks signatures, provider identity, currency, amount and captured/paid state before fulfillment. See [the runbook](razorpay-runbook.md) and [Test Mode credentials](razorpay-test-credentials.md) for setup and release checks. This documentation audit did not call the provider.

## Verification and operational commands

```sh
pnpm preflight
pnpm docs:check
pnpm finance:reconcile-fixture
```

The second command verifies offline report/CSV fixtures, not live database totals. Current results are in [verification](case-study-verification.md).

These commands use the configured database and mutate operational state. Run them deliberately in the intended environment:

| Command from root | Purpose |
| --- | --- |
| `pnpm --filter backend finance:post-events` | One batch of up to 100 supported financial events |
| `pnpm --filter backend payments:reconcile` | Stale payments; default 15 minutes and 25 candidates, maximum 50 |
| `pnpm --filter backend inventory:reconcile-reservations` | Expired inventory/payment holds; default 25 candidates, maximum 100 |
| `pnpm --filter backend promotions:cleanup-media` | Unreferenced managed promotion media older than 24 hours |

The Render Free configuration enables in-process maintenance with `MAINTENANCE_ENABLED=true`: financial posting every minute, reservation recovery every five minutes, and payment recovery every five minutes in Razorpay test mode. It runs immediately at startup and pauses while the host sleeps. One-shot commands remain available; inspect conflicts and per-item outcomes separately. See [deployment](deployment.md), [finance operations](finance-operations-runbook.md) and [promotion operations](promotions-operations.md).

## Files and hosting

Public catalogue/promotion images live under `backend/uploads`. Private expense receipts live under `backend/.private/expense-receipts` and require authorized download. Both directories are ignored by Git. Keep assets and their database references together when moving a demo.

Build with `pnpm build`. Serve `frontend/dist` with an asset-preserving SPA fallback to `index.html` for application routes, including direct `/docs/*` loads. Configure `VITE_BACKEND_URL` before building. No verified hosting topology or scheduler configuration is supplied.

If checkout fails, inspect store hours, delivery zones, product mapping/availability, stock and applicable pricing rules. For CORS, match `FE_URL` to the exact frontend origin. For images, verify the backend origin and local files. For reports, select the seed's reporting dates and drain the financial outbox.
