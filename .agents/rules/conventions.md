---
trigger: model_decision
---

# Coding Conventions

## Money

- All monetary values are **integer paise** in domain logic and database columns.
- Never use floating-point for money calculations.
- Convert to formatted INR (`formatPaise`, `formatPrice`) only at presentation boundaries.
- Never trust a browser-calculated price, discount, tax, total, or refund amount.

## Database

- All multi-write operations must use transactions. Pass a transaction executor through multi-write workflows.
- Never start nested independent transactions.
- Never delete or mutate posted financial history — reverse it.
- Use UTC timestamps in storage; store-aware business dates/timezones for reporting.
- Use idempotency keys and unique constraints as correctness controls.
- Schema files live in `backend/src/db/schema/`, exports in `index.ts`, relations in `_relations.ts`.

## Feature Modules

Feature modules are self-contained under `backend/src/features/<domain>/`:

- `*.routes.ts` — thin handlers: authenticate, authorize, validate, call service, map response
- `*.service.ts` — business logic
- `*.logic.ts` — pure domain rules and helpers (optional)
- `*.test.ts` — unit tests
- `*.schemas.ts` — Zod validation schemas (optional)

Frontend features follow `frontend/src/features/<domain>/`:

- `api/` — query/mutation hooks
- `model/` — types, schemas, query keys
- `components/` — UI components
- `pages/` — route-level pages
- `index.ts` — public barrel exports

## Test Naming

Test files follow the pattern: `<module>.<layer>.test.ts`

Examples: `pricing.service.test.ts`, `inventory.logic.test.ts`, `order.mapper.test.ts`

## Import Boundaries

- No cross-feature deep imports. Import from the feature's barrel `index.ts`.
- Shared utilities go in `shared/` (frontend) or `utils/` (backend).

## State Transitions

- Make state transitions explicit with enum values.
- Deny invalid transitions with stable `AppError` codes.
- Put source mutation, audit record, and critical state transition in the same transaction.

## Security

- Never log secrets, signatures, full provider payloads, bank data, or PAN-like identifiers.
- Never expose cross-store resource existence.