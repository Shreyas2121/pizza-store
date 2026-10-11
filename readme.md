# PizzaStore

A multi-store food ordering and operations application with management accounting. Built with React, TypeScript, Express and PostgreSQL, it connects customer checkout to inventory, fulfillment, refunds, cash control and a double-entry ledger.

## Start with the engineering case study

The public `/docs` pages explain the architecture, payment lifecycle, inventory reservations, design decisions and recovery policies without requiring a login or a running API.

- [High-level design](docs/high-level-design.md): system diagram and financial outbox.
- [Recruiter walkthrough](docs/demo-walkthrough.md): a focused demo and interview discussion points.
- [Source and test evidence](docs/case-study-evidence.md): implemented guarantees and their limits.
- [Verification record](docs/case-study-verification.md): checks run against the current working tree.

## What the application demonstrates

| Engineering problem | Implemented approach |
| --- | --- |
| Prices change while a cart is open | Server-owned quotes; checkout revalidates and saves item, customization, tax, promotion and bundle snapshots |
| Two customers want the last item | Transactional stock checks and ordered row locks; online checkout reserves stock before capture |
| Payment succeeds across an unreliable network | Local request identity, provider verification, repeat-event guards, saved-price retries and reconciliation commands |
| Staff work in different stores | Current-user JWT checks, store memberships, resource-derived authorization and principal-scoped client caches |
| Money changes after delivery | Exact integer paise, delivery-based recognition, immutable posted journals and linked reversals |
| Posting stops after a business write | Transactional financial outbox with leases, bounded retries and idempotent journal source identities |
| Reports disagree with exports | Shared report policies and deterministic fixture reconciliation for store and consolidated results |

These are implementation choices supported by source and tests. The inventory explorer is a teaching model; it does not establish real database contention or production performance.

## Product scope

Customers can browse store-priced menus, customize products, buy component-backed combos, discover offers, apply eligible coupons, pay by COD or simulated online payment, inspect saved orders and use support chat. Staff workspaces cover fulfillment, inventory, store configuration, invitations, audits, refunds, settlements, cash sessions, expenses, private receipts and restricted payroll.

Automatic offers and manual coupons are exclusive discount modes. Bundle compare-at markdown is displayed separately from actual promotion savings. Pricing policy v5 applies the store's ordinary free-delivery threshold before promotions. Payments and revenue remain separate: capture records collection, while delivery recognizes revenue and standard cost.

## Stack

| Layer | Tools |
| --- | --- |
| Frontend | React 19, Vite 8, TypeScript, React Router, Mantine 7, Tailwind 3 |
| State and forms | TanStack Query, TanStack Table, Zustand, React Hook Form, Zod 4 |
| API | Node.js 22.13+, Express 5, JWT, Zod 4, Socket.IO |
| Persistence | PostgreSQL, Drizzle ORM and checked-in SQL migrations |
| Operations | Winston, request IDs, protected Prometheus metrics, one-shot reconciliation/posting commands |
| Tests | Vitest; pure policies, mocked services, generated-SQL checks and an isolated PGlite recruiter-seed test |

Package manifests and the workspace lockfile define exact dependency resolution.

## Run locally

Install Node.js 22.13+, pnpm and PostgreSQL. Run commands from the repository root:

```sh
pnpm install --frozen-lockfile
# Copy backend/.env.example to backend/.env and fill in your local values.
# Copy frontend/.env.example to frontend/.env.
# Create the database named by DATABASE_URL, then apply committed migrations:
pnpm db:migrate
pnpm dev
```

The frontend runs at `http://localhost:3150`; the default API is `http://localhost:3000/api/v1`. Public docs are at `http://localhost:3150/docs`.

Choose demo data deliberately:

- [Recruiter showcase seed](docs/recruiter-demo.md) populates an otherwise cleared application database, preserves an existing admin, and includes recent history and all five staff roles. It requires the existing food image assets.
- [Deterministic finance demo](docs/finance-demo-walkthrough.md) uses `pnpm demo:reset`, a destructive local-development reset, for a fixed July/August 2026 scenario.
- [Setup](docs/setup.md) explains manual configuration and smaller seed commands.

The online simulator needs no provider credentials. Razorpay Test Mode is optional; live processing is rejected. The simulator keeps provider state in process memory, so use fresh checkout orders after restarting the backend.

## Validation

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm docs:check
pnpm finance:reconcile-fixture
```

The documentation check validates relative file links, mounted API handlers, schema columns and public evidence paths. The fixture command runs offline. It does not reconcile your database or call a payment provider. `pnpm preflight` runs lint, typecheck, tests and build in sequence.

## Documentation

For Render, Vercel and Neon deployment settings, persistent storage and scheduled recovery jobs, see the [deployment guide](docs/deployment.md).

See the [documentation index](docs/README.md) for API and schema references, decision records, demo guides and operational runbooks. The [frontend README](frontend/README.md) covers feature organization and UI conventions.

```text
backend/src/features/    Domain routes, workflows, repositories and policies
backend/src/db/schema/   Current Drizzle tables and relations
backend/migrations/      SQL history, including custom ledger constraints/triggers
backend/src/scripts/     Seeds and one-shot operational commands
frontend/src/app/        Router, providers and layouts
frontend/src/features/   Customer, staff and public case-study features
frontend/src/shared/     API transport, UI, configuration and realtime utilities
docs/                    Maintainer and recruiter documentation
```

## Scope and tradeoffs

This is an INR portfolio application for company-operated stores. Its tax rules, receipts and payroll calculations are demo data; it has no statutory filing or invoice service. Standard product costs are a reporting proxy, not recipe-level inventory valuation.

The free Render deployment uses Cloudinary for new images and authenticated private receipts, while existing public images are bundled at their original upload paths. Logs, simulator state and Socket.IO audiences depend on the serving process. Optional maintenance timers post financial events and reconcile reservations while the backend is awake; they pause when the free service sleeps. The financial outbox makes accounting recoverable, while realtime notifications remain best-effort. Production invitation delivery, multi-instance socket coordination, full PostgreSQL race testing and hosted browser verification remain explicit limitations.

No repository-wide license file is present; the backend package's ISC metadata does not establish a license for the whole project.
