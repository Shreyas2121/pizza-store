# C07 implementation handoff

Commit/branch: C07 / `feature/promotions-overhaul`.

Starting SHA: `af93ab7b7514b13d73a2a91cf076ef20b56a2c1a` (C00-C06 complete). Prerequisite fix: `5dc0659`, `fix(stores): evaluate opening hours in store timezone`. Final implementation commit: `feat(checkout): persist promotion snapshots and COD consumption`; its exact SHA is reported in the completion response and branch history.

## Completed behavior

COD checkout locks the owned cart, user eligibility row and active store, checks opening hours in the locked store's IANA timezone, validates the owned address/delivery area, locks the complete parent/component catalogue and inventory set, reloads current server prices/customizations/bundles, and invokes v4 pricing with the same executor, user and captured clock. Sorted promotion and existing setting locks protect resolution and default-enabled absence. A changed bundle component set fails before acquiring further catalogue locks. ADR-006 documents the lock refinement and the compatible bundle writer order.

Orders snapshot immutable `discountMode`, v4 payable/tax/policy fields, item discounts and charged delivery fees. Items retain product/customization names and prices, bundle compare-at/markdown and component quantities. Each winning promotion gets an immutable application with kind/name/code/type/version, exact item/delivery/total savings, standard/charged fees and consumption time; allocations identify persisted order-item IDs and zero-based units or delivery. Insert-return order never determines allocation ownership. Bundle markdown never enters promotion spend or order discounts.

The successful COD transaction writes payment, order/items/applications/allocations, payment attempt and stock movements, then clears the cart. Any failure propagates to the caller transaction. No nested transaction or mutable promotion usage counter was added. COD no longer reads or writes legacy coupon tables. Strict COD requests accept only the existing address/payment fields and optional normalized coupon code, capped at 64 characters after uppercase expansion; caller offers/prices/discount modes remain rejected.

Application record/release/consume/restore operates on entire collections and verifies owner, mode, saved totals and allocations. Repeated record verifies identical snapshots instead of overwriting/filling partial collections. Reserved plus consumed rows occupy global/per-user redemption limits and exact item-plus-delivery budgets, using bigint aggregates. Restore validates capacity for every released member before transitioning any member and preserves captured amounts/versions after definition edits, expiry or store opt-out. Release affects reserved rows only; consumed COD usage remains occupied on cancellation while stock is restored. Cancellation obtains user/store locks before inventory restoration. The capacity bypass is reserved for C08 authoritative provider-capture reconciliation, not new checkout.

## Files and scope

New checkout COD service/repository and shared catalogue loader isolate the transactional v4 path. Existing previews share that loader and use a caller executor when supplied. The promotion application service/repository has a database-backed `applications.ts` public entrypoint, keeping the pure engine barrel database-free. New service/query tests cover lifecycle and executor boundaries. Order COD orchestration switches to the new checkout entrypoint; the COD schema, operations/API reference, ADR and guide progress are updated.

Hot-file expansion includes cart mutation services/tests, bundle writer locking, the checkout barrel, order cancellation and pricing/governance setting-query locks. Cart child edits previously occurred before parent-cart locking and quantity reads occurred outside mutation transactions. They now lock the cart before reading/writing, re-read deletion targets after locking and reuse the same executor for quantity-one deletion. Bundle writers lock stores ascending before products ascending. These changes are necessary for the C07 checkout lock contract, not unrelated cleanup.

No migrations, schema/dependency/lockfile changes, backfills, financial event/ledger changes or frontend changes. The C02 schema already contains the required snapshot tables/columns. Order response collection mapping remains C10 work.

The existing checkout/legacy-pricing path remains internal online-payment scaffolding until C08 cuts over all initiation, finalization and recovery callers together. V4 previews and COD use new promotion persistence; online scaffolding uses only legacy persistence. No adapter, dual read/write or supported compatibility API was introduced. These dependent slices must release together.

## Verification and limitations

Baseline preflight passed with 793 backend tests / 106 files and 10 frontend tests / 2 files. The timezone prerequisite preflight passed with 796 backend tests / 107 files and 10 frontend tests; its after-commit store-hours gate passed all 3 tests. Store-hour tests cover default IST, UTC, overnight boundaries and DST.

Final full preflight passed: 842 backend tests across 115 files and 10 frontend tests across 2 files, both lint/typecheck/production builds, zero errors. Existing warnings remain: backend 308, frontend 3. The final focused checkout/COD/cart/bundle/inventory/order/payment/application/query suite passed 268 tests across 26 files; it is also the after-commit gate. All eight new test files were explicitly typechecked in addition to the normal production typecheck, which excludes tests. `git diff --check` passed. Existing characterization assertions remain; stock-only tests now stub their transaction boundary, with separate cart-lock tests exercising the real locking method.

During development, one existing stock unit test unexpectedly opened a configured database transaction after moving its stock check inside the mutation transaction. It failed on an existing database/schema mismatch and rolled back. The test now stubs the transaction; subsequent scoped and full unit gates require no database connection. No database was started, and no migrations, intentional database integration/concurrency tests, maintenance scripts or manual browser/COD/Razorpay/finance checks were run. PostgreSQL first-order, capacity, budget, opt-out and deadlock evidence remains deferred under the user's instruction. Mock/query tests prove orchestration and query construction only.

The prerequisite timezone fix and cart transaction correction address concrete existing defects. The snapshot writer also checks exact totals, exclusive unit ownership, complete collections and executor propagation rather than trusting persisted cart amounts or an insert-return ordering assumption.

Next according to guide integration waves: C11 frontend promotion administration, then C12 offer discovery, then C08 Razorpay application lifecycle/recovery. C09 finance, C10 order/legacy cleanup, C13 customer checkout/orders and C14 database/manual release evidence remain pending.
