# C05 implementation handoff

Commit/branch: C05 / `feature/promotions-overhaul`.

Session starting SHA: `9ddac870cc8db398156ab3a8d73289f456a0bed5` (C00-C04 complete). C05 starting SHA after prerequisite fixes: `c7bfcbf865d48e54d980fc5f3d00b31e0ca2d8ed`.

Final commits:

- `3600ad7d439b584325ff3ca4999f308b4cf45b8e`: payment persistence preserves transaction and constraint failures.
- `c7bfcbf865d48e54d980fc5f3d00b31e0ca2d8ed`: validate coupon length after Unicode uppercase normalization.
- C05: `feat(promotions): add platform governance store opt-outs and media`; its SHA is reported in the completion response and available in branch history.

## Completed behavior and files

The promotion feature now owns platform administration, version-checked definition replacement and deactivation, manager-only store participation, bounded public offer/featured discovery, global and per-store application analytics, validated image storage/replacement/removal, and orphan cleanup.

New feature modules are `promotion.mapper.ts`, `promotion.repository.ts`, `promotion-analytics.repository.ts`, `promotion.service.ts`, `promotion.routes.ts`, `promotion.validation.ts`, and `promotion-media.storage.ts`. Tests cover governance/HTTP, repository query construction, schemas, and real image decoding/filesystem behavior. `backend/src/scripts/cleanup-promotion-media.ts` provides maintenance.

Existing changes include promotion constants/schemas, access permissions and tests, audit types, the root router, backend package/lockfile, API reference, frozen contract clarifications, this guide and handoff. See [operations](./promotions-operations.md) for media lifecycle and analytics semantics.

No database schema or migration changes. New endpoints are `/promotions` administration, `/promotions/offers`, `/promotions/featured`, promotion images/analytics, and `/stores/:storeId/promotions` manager operations. Public DTOs exclude coupon rows, codes and private governance fields. Admin list/detail optionally include store participation. Analytics return exact decimal strings. Media removal and administrative participation fields are documented additions to the frozen API contract.

## Security, financial and concurrency implications

Platform capability controls definitions, budgets and media. Only active same-store managers can read/toggle participation; other roles and platform overrides are denied on manager endpoints. Successful mutation audits commit with state, and denied/invalid high-risk requests retain failure audits without copying codes or upload contents.

Store participation defaults to enabled; global deactivation takes precedence without discarding explicit store choices. Manager writes recheck membership in the transaction and use store, promotion, setting lock order. Media operations and cleanup share an advisory lock. Replacement commits the new reference before removing the old file; rollback preserves the previous asset. Files are decoded/re-encoded, bounded, randomized and confined to the storage directory.

Analytics count application states and attribute consumed savings/order value. Tax-exclusive item reductions use deterministic SQL apportionment. They do not recognize reserved revenue, post ledgers, deduct delivery waivers as item discounts, or treat bundle markdown as ledger discounts. Delivered-ledger reporting remains C09.

## Verification and limits

`pnpm.cmd preflight` passed: backend 747 tests in 102 files; frontend 10 tests in 2 files; both lint/typecheck/production builds passed. Existing lint warnings remain (backend 311, frontend 3), with zero errors. The normalized-code regression suite passed all 17 tests. `git diff --check` passed.

Tests exercise mocked transaction orchestration, compiled SQL, HTTP authorization/auditing and multipart uploads, and actual Sharp decoding plus temporary filesystem lifecycle. They do not establish PostgreSQL query execution, database race safety or production performance.

Database, migrations, database integration/concurrency tests and database-backed maintenance were skipped at the user's explicit request. No PostgreSQL server was started. COD/Razorpay end-to-end, finance integration and manual browser checks were not run for this backend slice. Database and release evidence remain required in C14 when authorized.

## Existing issues fixed and scope decisions

Payment attempt persistence previously fabricated rows on foreign-key failures and could retry outside a supplied failed transaction. The separate payment fix propagates failures and preserves the caller's executor; targeted tests also isolate unit tests from configured databases.

Coupon length validation previously accepted Unicode codes whose uppercase representation exceeded the persisted limit. The separate normalization fix checks the final value and adds regression coverage.

Hot-file expansion covers access/audit definitions, root route registration, constants/schemas, backend package and lockfile, which C05 needs. Payment changes are isolated in their prerequisite commit. `sharp` is the justified dependency exception because existing multipart tooling has no full image decoder. Transient formatting tooling is not a project dependency. No existing dependency versions were upgraded.

Next is C06: connect the engine and effective store settings to authoritative pricing and the new coupon validation flow. C07 checkout/application persistence, C09 ledger integration, C11 frontend administration and later cleanup/release steps remain pending. The existing internal coupon validation scaffolding stays until its assigned cutover; C05 adds no legacy CRUD compatibility layer.
