# C09 implementation handoff

Commit/branch: C09 / `feature/promotions-overhaul`.

Starting SHA: `e15c7bd8d4e1c14f3dd5a23046801ed93af58bdc` (C08). Prerequisite corrections: `fcd18b5` preserves refund tax/quantity rounding remainders; `24c144b` aligns promotion revenue analytics with inclusive-tax rounding. Final implementation commit: `feat(finance): account for promotion-adjusted revenue`; the completion response and branch history report its SHA.

## Implementation

`buildDeliveredOrderPayload` is the shared delivery recognition builder for operational order delivery and deterministic finance seeding. It reads immutable order/item snapshots, checks item subtotal and discount allocation sums, paid line tax equations, charged-delivery tax, total tax and the payable equation, and rejects inconsistent snapshots before an outbox event is written. The existing `order.delivered.v1` posting fields remain authoritative; additive descriptive fields identify discount mode, inclusive item discount and charged delivery. There is no current catalogue/promotion-definition read in recognition.

Delivered journals credit tax-exclusive pre-discount food to store `4000`, debit the tax-exclusive item discount to `4100`, and credit post-discount paid tax to `2200`. The posting builder independently checks the recognition equation and rejects unbalanced payloads. Free delivery contributes zero delivery revenue and no item discount posting. Bundle selling prices alone enter recognition; compare-at markdown has no ledger/refund effect.

Finance reports already aggregate store journal movements correctly, so production report formulas did not need rewriting. Tests now carry one global automatic offer or coupon through two store recognition journals and the report projector, asserting each store and the consolidated total. Dashboard GOV already sums saved `grandTotalPaise`; query coverage confirms there is no extra promotion subtraction. It remains an operational, tax-inclusive order-value measure, while finance reports recognize delivered tax-exclusive revenue and finalized refunds.

Promotion analytics continues to use immutable applications and item allocations, with all per-line applications participating in deterministic remainder apportionment before selecting one promotion. Pre-discount taxable revenue now subtracts rounded inclusive tax instead of rounding the taxable component directly; the latter was wrong at half-paise ties. Query-construction coverage checks that formula, shared allocation scope, store filtering and per-store/platform grouping. The governance aggregate fixture now has realistic store monetary totals which sum to platform totals; unique users remain globally distinct.

Refund allocation reads saved paid tax and existing active allocation tax. Cumulative proportional allocation preserves exact tax on a full refund even when the payment is refunded in parts; bounds prevent negative tax after an earlier refund reservation is released. Quantity capacity retains the last paise on an odd-valued line. Paid discounted revenue, original discount attribution and tax remain separate; refund posting uses `4110`, not a second reversal of `4100`. Refunds do not imply an inventory return or COGS reversal.

The existing two-month finance seed now creates a global `PIZZA50` promotion, consumed application and item allocation, sets v4 pricing/discount mode, and emits delivery events through the production builder with saved tax rates. It no longer creates a legacy coupon. Existing monetary/report totals are unchanged. New database-free promotion finance fixtures cover both store scopes, automatic offers, coupons, free delivery, bundle markdown and paid refunds.

## Verification

Baseline: 878 tests / 119 files; backend typecheck/build pass; lint has zero errors and 307 existing warnings. Final full backend suite passes 889 tests / 121 files. Backend production typecheck/build pass; lint has zero errors and 306 existing warnings after removing an unused seed import. New refund, analytics-query, dashboard and finance tests are additionally typechecked using a temporary config including Express declarations, since normal production typecheck excludes tests. The temporary config is removed before commit.

Refund regression reproduced 2 paise of reversed tax against 1 paid paise before the fix. Split-tax, odd quantity remainder, released-reservation, two-store/consolidation, delivery-waiver, compare-at capacity, paid refund and inconsistent-recognition tests pass. Every delivered demo fixture also passes through the production builder and balanced-journal validation in a database-free test.

The final focused finance/event/report/refund/dashboard/promotion/order/fixture run passed 184 tests across 25 files. Obsolete refund rate inputs were removed: allocations now require paid tax paise rather than a rate to recompute tax.

Including the existing governance suite in the additional test typecheck exposed an inaccurate repository return type for an absent store setting and a duplicate rule-fixture property. The setting lookup now explicitly returns a row or `undefined`; the redundant property was removed. Both corrections preserve runtime behavior.

No database checks were run, per the owner's explicit instruction. This includes `finance:reconcile-fixture`, reset/seed execution, PostgreSQL migrations/integration/concurrency tests and live journal/report reconciliation. The seed changes are statically checked and their monetary payloads tested; SQL query construction and mocked aggregate tests do not prove database execution. No live provider or browser checks were run. No schema, migrations, dependencies, lockfile or frontend changes.

## Next work

C10 historical order DTOs and legacy coupon cleanup are next. C11/C12 frontend governance/discovery, C13 checkout/history UI and C14 database/manual release evidence remain pending. C09 completion does not claim overhaul release readiness or PostgreSQL validation.
