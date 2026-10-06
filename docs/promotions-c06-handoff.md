# C06 implementation handoff

Commit/branch: C06 / `feature/promotions-overhaul`.

Starting SHA: `68e9d9e62b03138940db9b0c31f18056634c0404` (C00-C05 complete). Final commit: `feat(pricing): resolve automatic deals and manual coupons`; the exact SHA is reported in the completion response and branch history.

## Completed behavior

PricingService resolves all automatic offers with the existing pure engine, rejects manual coupons when an offer or bundle applies, and otherwise validates only the supplied normalized coupon. It returns frozen quote version `2026-09-12-03` / policy v4: discount mode, coupon eligibility/conflicts, versioned promotions and unit allocations, separate item/delivery savings, standard/charged delivery fees, bundle markdown and total displayed savings. Inclusive tax is recalculated from each discounted line. Legacy delivery thresholds do not waive fees in v4; free delivery is a promotion whose savings occupy its budget.

Both supplied-item and owned-cart previews reload current store mappings/prices, product categories/types, mapped customization options and batched bundle definitions. Saved cart amounts never supply new quote prices. Anonymous users cannot use another user's saved address. A requested store different from the owned cart is rejected. Strict schemas reject caller prices/categories/discounts, offer IDs and unknown fields. Empty carts, unavailable products/options/components, duplicate options, normalized code length, unit expansion and monetary overflow have bounded/error behavior.

`POST /promotions/validate` authenticates the active-cart owner and accepts only `couponCode`, without store override. It is registered before dynamic IDs. It and coupon-bearing `/checkout/quote` share a process-local quota of 30 attempts per minute by user or anonymous IP. The limiter retains no codes, bounds principal windows at 10,000, and returns stable 429 errors plus Retry-After. Quotes use no-store caching. Multiple server processes require a shared limiter before deployment.

## Files, API and scope

Pricing is split into service, repository and shared recognition arithmetic, with a public feature barrel. `promotion-pricing.repository.ts` loads active-window offers plus the exact supplied coupon, batching rules/settings/global usage and personal usage. It uses reserved/consumed application truth and qualifying order states; large lifetime aggregates saturate conservatively at the finite PostgreSQL-int limit without unsafe numeric conversion. Pricing candidates are not truncated by discovery pagination.

Checkout repository/service/routes and schemas now construct v4 previews. Promotion routes/schemas add validation and normalized code parsing, with limiter modules/tests. Public database-backed `pricing.ts` entry points expose promotion/bundle loaders while the engine barrel stays database-free. The order service imports recognition arithmetic through the pricing barrel; its behavior is unchanged. API reference, operations guide and progress guide are updated.

No migrations, schema changes, dependencies or lockfile changes. New quote responses follow the frozen DTO and contain no legacy `coupon`, `discountPaise` or `deliveryFeePaise` compatibility fields. Unrequested coupon rows/codes cannot reach the response.

Hot-file expansion covers checkout preview loaders/routes/tests, promotion validation registration, the shared quote schema, feature entry points and the existing coupon response type import. These are necessary for the public C06 integration; no checkout payment lifecycle or persistence behavior was cut over early.

The existing v3 pricing service and its full characterization suite move to explicitly named `legacy-pricing.service.ts` / `.test.ts`. Transactional order/payment checkout and the temporary legacy validation endpoint continue to use that isolated module until C07/C08 can persist and reconcile new application collections. It reads only legacy coupon persistence; v4 reads only new promotions. There is no dual-read, dual-write, or response adapter. Shared recognition arithmetic is extracted unchanged. This is temporary internal cutover scaffolding permitted by guide section 2.1, not a deployable mixed contract; frontend/backend lifecycle slices release together.

## Security, finance and concurrency

User identity comes from authentication, not the request body. Preview does not mutate promotions, applications, inventory or ledgers. Item discounts reduce taxable line values; delivery savings reduce charged delivery and its tax, and bundle compare-at markdown remains outside payable/tax/ledger arithmetic.

The repository's final-resolution option requires a caller executor, rechecks/locks the active store, and locks promotion rows ascending before usage reads. C07 must supply the surrounding cart/user/store-product/application locks and lifecycle writes in ADR-006 order. First-order/capacity/budget race safety and reservation idempotency are not claimed proven by these unit tests or advisory previews.

## Evidence and follow-up

Baseline preflight passed: 747 backend tests / 10 frontend tests, lint, typecheck and builds. Focused exit suite passed 85 tests across 7 files, covering all five promotion types through quotes, customization basis, tax/savings reconciliation, stable errors, first-order/overnight conditions, store disablement, bundle exclusion, manual normalization, offer priority/ID ties, caps/paise remainders, authoritative catalogue loading, HTTP authentication/strict validation/rate limits, query boundaries and mocked executor/lock ordering.

Full exit preflight passed: 793 backend tests across 106 files and 10 frontend tests across 2 files; both lint/typecheck/production builds passed with zero errors. Existing warnings remain (backend 308, frontend 3). `git diff --check` passed. All previous characterization tests remain; no tests were skipped or weakened.

Database startup, migrations, database integration/concurrency tests, database-backed maintenance and manual browser/COD/Razorpay/finance checks were not run, as requested. Compiled SQL and stubbed executor tests provide unit evidence only; PostgreSQL execution and concurrency evidence remain C14 work when authorized.

C06 fixes the preview's missing bundle metadata, store-context mismatch and reliance on stale saved-cart/customization prices as part of the explicitly required authoritative pricing hardening. No separate unrelated corrective commit was needed.

Next: C07 persists versioned promotion application/allocation snapshots and COD consumption, removes transactional reliance on v3 pricing, and makes final checkout re-resolution consistent with these advisory quotes. C08 payment reservation/recovery, C09 finance, C10 remaining legacy cleanup, and C13 frontend consumers remain pending.
