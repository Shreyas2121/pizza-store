# C10 implementation handoff

Branch: `feature/promotions-overhaul`. Starting commit: `e87c2a2` (C09).
Prerequisite fix `7ee2839` restricts staff order customer joins to identity
columns, excluding password and authorization metadata.
Order snapshot commit: `245e748`. Cleanup commit:
`refactor(coupons): remove legacy coupon persistence and routes`; its SHA is
reported in the completion response and branch history.

## Order snapshot projection

All customer/staff list and detail paths load saved promotion applications,
allocations, item customizations and bundle components in one relational query.
Names, prices and allocation explanations come from immutable order snapshots.
Current product images are optional decoration. Explicit DTO projection excludes
cost snapshots, credentials, provider internals and payment attempts.

Reserved, consumed and released application states remain visible as historical
facts. Item discount, delivery savings and display-only bundle markdown remain
separate. The saved grand total is never repriced. Customer payment details now
use saved item subtotal and charged delivery instead of including delivery in
the item subtotal. Customer/staff order pages consume the collection DTO.

Lists are bounded (default 25, maximum 100) with page/limit query validation and
stable date/ID ordering. Customer and staff views include page controls.
Tests cover query construction without database access,
all read paths, saved names after definition edits, allocations, bundles,
released applications, safe projection and exact money boundaries.

The mapper requires complete order/item rows and loaded relation collections;
partial test doubles cannot weaken the production contract or turn an omitted
join into an empty history. Fixtures supply the complete snapshots. Safe tax and
delivery-pricing metadata remains available in the explicit projection.

## Legacy removal and consumer cutover

The retired coupon feature, validation route, compatibility helper, v3 pricing
implementation, coupon tables/relations, order link, legacy Zod/type exports and
unused `platform.coupons.manage` capability are removed. Cancellation always
uses the application collection lifecycle. There are no legacy row lookups,
response adapters, dual reads or dual writes.

Frontend manual validation calls `/promotions/validate` with `couponCode` and
consumes the v4 quote. Checkout stores only the manually applied code, uses
`itemDiscountPaise` and `chargedDeliveryFeePaise`, and has collection-based quote
and payment types. The broader eligibility/discovery/governance UX remains in
C11-C13. Removed legacy tests belong to removed services/routes; recognition
tests and active public-quote cases were preserved in their current suites.

System maintenance now derives its FK-complete table list from Drizzle schema
exports: all 63 non-user tables, including promotions, bundles, finance and
payroll. It preserves the existing admin-account deletion/audit behavior. The
previous hand-maintained list omitted FK owners and could not safely truncate
the integrated schema. Tests verify the affected domains and authorization
boundary without executing a reset. A discovered address lookup return type
now explicitly allows an absent owned address, matching runtime behavior.

## Cleanup migration review

Offline Drizzle generation produced `0030_remove_legacy_coupons.sql`, snapshot
and journal entry. Only this new migration SQL was corrected: Drizzle generated
a parent `DROP TABLE ... CASCADE` before an explicit order FK drop, which would
remove that FK twice. The final SQL drops the order FK/column, then redemption
child and coupon parent, without CASCADE. Static tests compare the entire 0029
and 0030 snapshots, confirming only those two tables and the order column/FK
change, and verify FK order, journal and schema-export agreement. The additive
0029 migration and snapshot are unchanged; its test finds its journal entry
instead of assuming it remains the last migration. No backfills or migration
application were performed.

## Verification

The full workspace preflight runs lint, typecheck, existing tests and production
builds; the snapshot gate passed 895 backend tests across 122 files and 10
frontend tests across 2 files, with zero lint errors (306 backend/3 frontend
existing warnings). New mapper/query/schema tests also pass an additional
TypeScript check including test files. The cleanup gate passes 866 backend tests
across 120 files and the same 10 frontend tests; obsolete legacy tests account
for the lower total. Lint has zero errors (298 backend/3 frontend warnings),
both production typechecks/builds pass, and the focused order/payment/checkout/
pricing/schema/maintenance run passes 265 tests across 34 files. Additional
test-file typechecking includes new mapper, query, migration, public-quote,
recognition and maintenance tests. Existing Vite barrel-import warnings remain.

No database connections/checks, migration application, reset/seed execution,
PostgreSQL integration/concurrency tests, provider or browser checks were run,
as requested. Offline generation and SQL construction/metadata tests do not
prove execution on PostgreSQL. Final workspace preflight and `git diff --check`
pass before the cleanup commit.

## Reference audit and next work

The required `rg -n -i "coupon" backend/src frontend/src docs readme.md` audit
was reviewed. Production references describe the new manual-coupon promotion
domain or customer wording. Old column identifiers appear only in cleanup
history and deliberate negative/request-rejection tests. Dated C00-C09 handoffs,
ADRs and the frozen financial/case-study proposal preserve historical context;
current API/schema/operations/readme documentation is updated. The public
case-study page marks superseded behavior, and ORDER-03 now cites C10 mapper
evidence independently of the historical baseline revision.

C11 platform administration/store controls is next, followed by C12 discovery
and C13 full checkout/history UX. C14 database and manual release evidence
remains pending. C10 completion does not establish overhaul release readiness.
