# Promotions & Offers Overhaul — Commit-by-Commit Implementation Guide

Status: execution guide

Implementation progress (2026-10-07): C00-C12 implemented on `feature/promotions-overhaul`. C12 adds store-specific public offer discovery, a responsive accessible homepage slider, and bundle catalogue/cart merchandising. Next slice: C13 checkout/history UX. See the [C12 handoff](./docs/promotions-c12-handoff.md) for implementation, verification and explicitly deferred database/browser checks.

Authoritative product plan: [`implementation_plan.md`](./implementation_plan.md)

Target repository: PizzaStore monorepo (`backend`, `frontend`)

Delivery model: one implementation branch with ordered, reviewable commits

### Persistent owner instructions (2026-10-07)

These instructions apply to subsequent slices in this workstream until the owner changes them:

- **Skip live database checks.** Do not run database-backed verification, apply migrations, push schemas, or execute seed/reset scripts as part of verification. Continue offline schema/migration review, unit tests, lint, typechecks and builds. This owner instruction overrides database execution gates below; record those checks as unrun at the owner's request and never claim database release validation passed.
- **Review related code while implementing.** Fix demonstrated bugs, incorrect library usage, best-practice violations and code-quality issues encountered in touched or related code. Follow Section 8 for evidence, regression coverage and separate fix commits; keep changes relevant rather than starting unrelated rewrites.
- **Update affected documentation.** Keep contracts, architecture, workflows and handoffs accurate whenever implementation or a discovered fix changes them.
- **Carry these instructions forward.** Read this section on each continuation, including when the owner simply says “Next.”

This guide converts the approved implementation plan into an ordered delivery sequence. Implementers must read the complete implementation plan and this guide before changing code. Where this guide and the plan differ, stop and resolve the contradiction before implementation; do not improvise around money, tax, authorization, inventory, or payment lifecycle behavior.

---

## 1. Final Product Contract

The following decisions are frozen for this workstream:

1. **Coupons are manual only.** A customer must enter a coupon code; the server never selects one automatically.
2. **Offers are automatic.** Product/category/cart/delivery offers are derived from authoritative store and cart data. The customer does not apply or remove an eligible offer independently of the relevant cart item.
3. **Offers and coupons never mix.** If any offer applies, or a pre-built deal bundle is in the cart, reject a supplied coupon with `COUPON_NOT_COMBINABLE_WITH_OFFERS`. Never remove or reprice an offer to make a coupon fit.
4. **Overlapping offers are deterministic.** One unit may receive at most one offer. The highest customer saving wins; ties use display priority descending and promotion ID ascending. Different units/lines may receive different offers.
5. **Combos are catalogue bundles.** They are not `combo` promotion rules. A bundle is one purchasable product with component rows, an authoritative store selling price, and a higher compare-at price for display.
6. **Promotion definitions are global.** Only platform admins create/edit/schedule/activate/deactivate promotions, change budgets/rules, or manage media.
7. **Stores participate by default.** Only the store `manager` may disable or re-enable a global promotion for their own store. Other store roles cannot toggle. A manager cannot edit the definition.
8. **First-order eligibility ignores failed/cancelled attempts.** Existing orders in `awaiting_payment`, `pending`, `preparing`, `out_for_delivery`, or `delivered` disqualify. Cancelled orders and failed payment attempts do not.
9. **Item discounts reduce store revenue.** Product offers and coupons use the existing store-scoped discount contra-revenue account `4100`. Platform reporting consolidates already-discounted store ledgers and must not deduct the same promotion twice.
10. **Bundle markdown is not a ledger discount.** Only the bundle selling price is booked; compare-at savings are merchandising metadata.
11. **Free delivery is zero delivery revenue.** Track `deliveryDiscountPaise` for customer/budget analytics, but do not post the waived fee to account `4100`.
12. **Media is first-class.** Platform admins upload desktop/mobile promotion images. Selected active offers may appear in the homepage slider with explicit placement, priority, alt text, and accessible controls.
13. **Existing online orders stay stable.** A promotion edit, deactivation, or store opt-out affects new quotes/orders only. Existing Razorpay reservations and immutable order snapshots complete/recover under their captured contract.
14. **No numeric unlimited sentinel.** In new promotion schema/API contracts, `null` means unlimited/no budget; do not carry the legacy `-1` convention into new tables.
15. **Application rows are usage truth.** Redemption count and spend are derived from reserved/consumed application rows. Do not add drift-prone cached counters unless measured evidence later justifies a separately designed projection and reconciliation mechanism.
16. **No legacy compatibility contract.** Do not migrate legacy coupon data, preserve old CRUD response shapes, add adapters, or dual-read/write old and new persistence. The final release exposes only the new promotion/coupon API and schema.

This implementation assumes company-operated stores under one PizzaStore entity. It does not model franchise reimbursement, marketplace commission, or platform-funded subsidy. Those require a separate funding-source and intercompany accounting design.

Items 14-15 are deliberate code-quality refinements of the draft schema in the plan: nullable limits replace `-1`, and application aggregates replace mutable usage/spend counters. They are not open product decisions and supersede those two draft field choices.

---

## 2. Non-Negotiable Engineering Rules

### 2.1 Every integrated commit must be healthy

- Each commit must compile and pass its scoped tests.
- Do not commit a deliberately broken intermediate state.
- Temporary legacy imports/tables may remain only as internal build scaffolding until their dependent checkout/payment code is cut over. They are not a supported compatibility layer.
- Do not add adapters, migrate legacy coupon rows, preserve legacy CRUD contracts, or dual-read/write old and new pricing/financial state.
- Remove all temporary legacy scaffolding in the explicitly assigned cleanup commit.
- Do not weaken, skip, delete, or broadly mock tests merely to obtain a green build.
- Do not suppress TypeScript/ESLint errors with `any`, `@ts-ignore`, unsafe casts, or disabled rules. A narrow, justified boundary cast must have runtime validation and a comment.
- No fabricated performance, migration, concurrency, or manual-test claims.

### 2.2 No magic numbers or unexplained strings

All business values must have one named source. Examples include:

- `BASIS_POINTS_SCALE = 10_000`
- unlimited-redemption/budget semantics
- quote, pricing-policy, tax-policy, and promotion-definition versions
- maximum code/name/description lengths
- default/max page sizes
- reservation duration and stale-recovery thresholds
- image byte, dimension, format, and variant limits
- homepage slider limits/timing (if timed rotation is retained)
- first-order disqualifying statuses
- weekday representation and time-window boundary policy
- upload directory/route prefixes
- stable error codes and audit action/resource names

Put constants in the narrowest authoritative module, such as `promotion.constants.ts`, `bundle.constants.ts`, or existing shared money/payment constants. Do not create a generic dumping-ground constants file. SQL migrations cannot import TypeScript constants; give every SQL literal a named constraint/comment and cover it with schema tests so the TypeScript and database policies cannot silently drift.

### 2.3 Exact money and tax rules

- Store money as integer paise and rates as integer basis points.
- Use existing checked money helpers; no floating-point currency arithmetic.
- Reject unsafe integers, negative inputs, and overflow before persistence.
- Allocate discounts deterministically and ensure allocations sum exactly to the aggregate.
- Recalculate inclusive tax from each post-discount item line.
- Keep promotion item discounts, delivery savings, and bundle markdown separate.
- Maintain all existing order reconciliation checks.
- Do not count reservations as recognized revenue.

### 2.4 Architecture and code shape

- Routes authenticate, authorize, validate, call a service, and map a DTO. They do not contain promotion formulas or transaction orchestration.
- Pure eligibility/calculation logic remains database-free and clock-independent.
- Inject `now`/clock and store timezone into time-sensitive logic.
- Services own use cases and transaction boundaries.
- Repositories own database query/locking details.
- Never return raw database rows from customer endpoints.
- Zod request schemas are strict and enforce cross-field/discriminated rules.
- Use stable domain error codes; the frontend must not parse human message text.
- Preserve existing feature boundaries and naming conventions unless an approved refactor is required.
- Avoid N+1 reads when loading promotion rules, effective store settings, applications, allocations, or bundle components. Bound list endpoints and add indexes before making performance claims.

### 2.5 Security, privacy, and tenancy

- Backend authorization is authoritative; frontend guards are only UX.
- Only `platform.promotions.manage` can mutate promotion definitions/media/budgets.
- Only store `manager` receives `store.promotions.toggle`.
- Every store-scoped operation verifies the requested store against the principal.
- Customer APIs never enumerate coupon-kind rows or hidden codes.
- Promotion validation must be abuse/rate-limit aware.
- Uploads require MIME and decoded-file validation, size/dimension limits, randomized safe filenames, and no user-controlled filesystem path.
- Money-affecting admin actions and store toggles require success/failure audit evidence.

### 2.6 Database and concurrency

- Checked-in Drizzle migrations are mandatory even under the fresh-database policy.
- Never use `db:push` as release evidence or hand-edit applied migration history.
- Once a migration is integrated, correct it with a new migration.
- Lock cart, catalogue/inventory, store, promotion, and reservation records in one documented order.
- Promotion/store toggle and checkout resolution must acquire compatible locks so an absent default-enabled setting cannot race an opt-out.
- Reserved and consumed applications occupy redemption and global budget capacity.
- Reserve, consume, release, and restore operations are idempotent.
- Unit mocks cannot prove locking; concurrency claims require PostgreSQL integration tests.

---

## 3. Git and Collaboration Model

### 3.1 Branch topology

Create one implementation branch from `main`:

```text
main
└── feature/promotions-overhaul
```

Use `feature/promotions-overhaul` for every C00-C14 change. Do not create commit-specific, agent-specific, or other feature branches for this workstream. Do not push directly to `main`.

Before each commit, confirm that `feature/promotions-overhaul` is checked out and record its current HEAD as the starting SHA. Complete and verify one commit before beginning the next dependency-ordered commit.

### 3.2 Integration rules

- Commit each completed slice directly to `feature/promotions-overhaul`.
- Preserve small, coherent commits. Do not squash a prerequisite bug fix into a feature commit.
- Run the stated gate after every commit and the broader integration gate after every wave.
- Keep C00-C14 sequential on the shared branch. Do not make concurrent working-tree edits or parallel commits, even where the dependency table previously allowed parallel branches.
- Resolve any money, schema, permission, checkout, payment, or migration conflict with both contracts open. Never choose a side mechanically.
- Do not modify `pnpm-lock.yaml` unless an approved dependency is genuinely necessary. Existing dependencies should cover this work.

### 3.3 Hot-file ownership

| Hot area | Sole owner while active |
|---|---|
| `backend/src/db/schema/*`, `_relations.ts`, schema barrel, migrations/meta | C02, then C10 cleanup by the same schema owner |
| promotion pure types/constants/logic | C03 |
| catalogue/cart/inventory bundle behavior | C04 |
| promotion CRUD/routes/media/store settings/access permissions | C05 |
| `pricing.service.ts` and its contract/tests | C06 |
| `checkout.service.ts`, COD order creation, checkout schemas/routes | C07 |
| payment initiation/finalization/recovery/reconciliation | C08 |
| finance event/posting/report/refund behavior | C09 |
| order DTOs/mappers and legacy coupon removal | C10 |
| frontend admin route/nav/promotion management | C11 |
| frontend offers/home/catalogue/bundle UI | C12 |
| frontend checkout/order UI and shared checkout/order types | C13 |

Shared barrels and root routers are edited only by the commit that introduces/removes the corresponding public module. Implementers must announce any unavoidable hot-file expansion in their handoff.

### 3.4 Commit start checklist

Before every commit, the implementer must:

1. Read `implementation_plan.md` and `guide.md` completely.
2. Confirm the assigned commit ID, current `feature/promotions-overhaul` HEAD, owned files, and dependency commits. Do not create or switch to another workstream branch.
3. Run `git status --short` and preserve unrelated/user changes.
4. Run the assigned baseline gate before editing.
5. Inspect current implementation and tests; never implement from the plan alone.
6. Add or update tests with the behavior change.
7. Run `git diff --check` and the commit exit gate.
8. Commit only owned, reviewed files.
9. Send the handoff record defined below.

### 3.5 Required handoff record

```text
Commit/branch: `<commit ID>` / `feature/promotions-overhaul`
Starting SHA:
Final commit SHA(s):
Goal completed:
Files changed:
Schema/API/DTO changes:
Security/financial/concurrency implications:
Tests run and exact results:
Manual checks run/not run:
Existing issues found and how fixed:
Known limitations or follow-up dependencies:
```

---

## 4. Dependency and Integration Waves

| Wave | Commits | Execution | Integration gate |
|---|---|---|---|
| 0 | C00 baseline fixes | Sequential on `feature/promotions-overhaul` | Backend targeted tests, lint, typecheck |
| 1 | C01 contracts | Sequential; requires Wave 0 | Documentation review; no unresolved product/accounting decision |
| 2 | C02 schema | Sequential; requires Wave 1 | Schema tests, backend typecheck/build, generated migration review |
| 3 | C03 engine, then C04 bundles | Sequential; both require C02 | Both targeted suites, backend lint/typecheck/test/build |
| 4 | C05 governance/media, then C06 pricing | Sequential; requires C03+C04 | Backend lint/typecheck/test/build |
| 5 | C07 checkout/COD, then C11 frontend admin, then C12 frontend offers | Sequential; requires frozen API contracts | Backend gate plus frontend lint/typecheck/tests/build |
| 6 | C08 payments | Sequential; requires C07 | Payment/checkout suites plus backend full gate |
| 7 | C09 finance, then C10 order/cleanup | Sequential; requires C08 | Backend full gate and legacy-reference audit |
| 8 | C13 frontend checkout/orders | Sequential; requires C06+C10+C12 | Frontend full gate |
| 9 | C14 evidence/release | Sequential; requires all prior commits | Empty-DB migration/seed, concurrency tests, `pnpm preflight`, manual matrix |

Do not rebase, cherry-pick, or merge workstream commits between local branches. Review and correct each commit in place on `feature/promotions-overhaul` before starting its dependent commit.

---

## 5. Known Existing Issues — Mandatory Baseline Fixes

The initial repository review already found issues in code this overhaul will touch. C00 fixes these before feature work so later commits do not preserve or obscure them.

### C00.1 — Retire the unused legacy coupon API surface

Commit message:

```text
refactor(coupon): retire legacy administration endpoints
```

Current issue: legacy coupon CRUD/raw lookup endpoints include unauthenticated record/code lookup and have no required compatibility value. Remove the legacy create/list/detail/code/update/delete HTTP surface instead of spending effort securing or adapting it. Retain only the currently used authenticated `/coupon/validate` route as temporary internal cutover scaffolding until the new `/promotions/validate` consumer is integrated; it is removed in C10.

Add route tests proving legacy CRUD/raw lookup endpoints are unavailable and authenticated validation remains functional during the branch transition. Do not create a redirect or compatibility response adapter.

### C00.2 — Make public quote context authoritative and private

Commit message:

```text
fix(checkout): authorize address quotes and use store prices
```

Current issues:

- Address-backed public quote lookup must scope an `addressId` to the authenticated user. Reject `addressId` when there is no authenticated user rather than reading another user's address; anonymous quotes may use a validated destination state.
- Item-based public quotes must validate the selected store's product mapping/availability and use `store_products.price_paise`, not a global/client-derived product price.
- Validate customization eligibility/availability for the chosen product, not merely existence of an option ID.

Add regression tests for cross-user address access, anonymous address IDs, unmapped/unavailable products, store price overrides, invalid customization mapping, and valid anonymous destination-state quotes.

C00 exit gate:

```powershell
pnpm.cmd --filter backend test
pnpm.cmd --filter backend lint
pnpm.cmd --filter backend typecheck
pnpm.cmd --filter backend build
git diff --check
```

If these fixes expose additional failures, follow the existing-issue protocol in Section 8; do not lower validation to retain insecure legacy behavior.

---

## 6. Commit-by-Commit Delivery

### C01 — Freeze contracts and ADRs

Branch: `feature/promotions-overhaul`

Commit: `docs(promotions): freeze pricing governance and accounting contracts`

Create concise ADRs or decision documents covering:

- exclusive `none | automatic_deals | coupon` discount modes;
- best-offer-per-unit conflict resolution;
- manual coupon rejection when any automatic deal exists;
- platform ownership and manager store opt-out;
- global capacity/budget behavior across stores;
- half-open date validity and store-local overnight windows;
- pre-built bundle modelling and component inventory;
- item discount, free delivery, bundle markdown, tax, and ledger treatment;
- immutable order/application snapshots and online-reservation stability;
- promotion media storage/replacement/cleanup policy.

Also define stable request/response DTO examples and error codes before backend/frontend implementation begins. At minimum freeze:

- `DiscountMode`
- promotion public/admin DTOs
- effective store setting DTO
- quote `couponEligibility`
- promotion application/allocation DTOs
- bundle/component DTOs
- upload response DTO
- `COUPON_NOT_COMBINABLE_WITH_OFFERS`
- `PROMOTION_DISABLED_FOR_STORE`
- eligibility/capacity/budget errors

Exit criteria:

- No open product, stacking, funding, or accounting decision.
- DTO examples reconcile arithmetically.
- Platform and store permission matrix is explicit.
- C03, C05, C06, C11, C12, and C13 can work from the same contract.

### C02 — Add database foundation and migration

Branch: `feature/promotions-overhaul`

Commit: `feat(db): add promotion application and bundle schema`

Add the complete additive schema foundation:

- `promotions`
- `promotion_rules` or the approved type-specific target/tier tables
- `store_promotion_settings`
- `promotion_redemptions`/applications
- `promotion_discount_allocations`
- `bundle_components`
- immutable `order_item_bundle_components`
- `orders.discount_mode` with a temporary/default `none` value so this additive commit remains buildable until checkout cutover
- order-item compare-at/bundle-markdown snapshot fields required by C04/C09/C10
- `store_products.compare_at_price_paise`
- all relations, exports, indexes, checks, and FK policies

Rules:

- Keep legacy coupon tables/columns exported only as internal compile/runtime scaffolding for checkout/payment code not yet cut over. Do not migrate legacy rows, expose legacy CRUD, add adapters, or dual-write.
- Promotions have no store targeting column. Absence of a `store_promotion_settings` row means enabled.
- Use nullable per-user/global redemption limits and budget columns to represent unlimited; do not use `-1` or another sentinel.
- Treat application rows as the authoritative usage/spend source; do not add `redemption_count` or `total_discount_spent_paise` caches in the new write model.
- Offer codes are forbidden; coupon codes are required and uniquely normalized with a case-insensitive database index.
- Use a monotonic `definition_version`.
- Enforce half-open validity and valid money/rate/quantity bounds.
- Permit overnight time ranges; do not enforce `start_time < end_time`.
- One active/reserved coupon per order; multiple offers only through distinct allocations.
- No nested bundles. Bundle SKU on-hand is not an independent inventory pool.
- Image and alt text consistency plus homepage-placement restrictions are validated.
- Add indexes matching discovery, code lookup, store setting, user usage, capacity, budget, analytics, and bundle expansion queries.

Generate and review a checked-in Drizzle migration and metadata. Review the SQL, not only the TypeScript schema. Check FK order, partial indexes, identifier names, defaults, and fresh-database reproducibility.

Tests:

- schema check/constraint tests;
- relation/type compile tests;
- invalid code/kind, amount, time, setting, allocation, bundle, and snapshot cases;
- migration smoke test on an isolated empty PostgreSQL database when available.

Exit gate:

```powershell
pnpm.cmd --filter backend test
pnpm.cmd --filter backend lint
pnpm.cmd --filter backend typecheck
pnpm.cmd --filter backend build
git diff --check
```

### C03 — Implement pure promotion engine

Branch: `feature/promotions-overhaul`

Commit: `feat(promotions): add deterministic eligibility and discount engine`

Create feature-local types, constants, strict schemas, and database-free logic for:

- percentage;
- fixed amount;
- BXGY;
- free delivery;
- tiered discounts;
- product/category/cart/delivery targeting;
- active dates, store-local day/time, overnight windows;
- first-order/per-user/global redemption limits;
- global budget eligibility;
- best offer per line/unit;
- stable tie-breaking;
- exact line/delivery allocations;
- exclusive automatic-deal versus coupon resolution.

The engine consumes already-authoritative inputs. It must not query products, prices, users, orders, stores, or redemptions. Repository/service layers construct the context.

Required named constants include the basis-point scale, weekday representation, unlimited sentinel policy, and stable conflict/error reason codes. Inject `now` and timezone context for deterministic tests.

Test matrices must cover boundaries, one-paise values, caps, repeated BXGY groups, cheapest eligible units, overlapping offers, multiple distinct-line offers, exact ties, customizations excluded/included according to policy, overnight windows, and invariant/property cases.

Exit gate: focused promotion tests, backend lint/typecheck/build, and `git diff --check`.

### C04 — Add pre-built bundle backend behavior

Branch: `feature/promotions-overhaul`

Commit: `feat(catalog): add pre-built bundles and component inventory`

Implement bundle catalogue behavior end-to-end on the backend:

- platform-admin create/update/read bundle definitions;
- store selling and compare-at price validation;
- public menu/product DTO with bundle contents and displayed savings;
- cart add/update/read as one bundle line;
- component expansion for availability and inventory demand;
- aggregate component demand with standalone product demand;
- deterministic store-product lock ordering;
- immutable component/name/quantity/compare-at snapshots on order creation;
- no nested bundles and no independent bundle on-hand balance;
- bundle disablement when any component/store mapping is unavailable.

The bundle's selling price is the only amount passed into taxable order pricing. Compare-at markdown is returned separately and never added to `orders.discount_paise`.

Tests must cover store price differences, duplicate components, multiplied bundle quantities, a component also purchased standalone, unavailable/insufficient components, deterministic aggregation, compare-at validation, snapshots, and no false discount accounting.

Exit gate: catalogue/cart/inventory/order snapshot focused tests plus backend lint/typecheck/build.

### C05 — Add platform governance, store settings, analytics, and media

Branch: `feature/promotions-overhaul`

Primary commit: `feat(promotions): add platform governance store opt-outs and media`

Implement:

- platform-admin CRUD, activation/deactivation, schedule/rules/budget, definition-version increments;
- list/detail pagination and filters;
- effective state resolution using `coalesce(setting.is_enabled, true)`;
- manager-only read/toggle endpoints for the manager's store;
- global deactivation precedence and restoration of the store's last explicit choice;
- store toggle and checkout-compatible lock order;
- public offer and featured/homepage DTOs that never leak coupons;
- platform/global plus per-store analytics with honest metric names;
- promotion media upload/replacement/fallback and orphan cleanup;
- platform/store permission and audit action definitions;
- route registration with static routes ordered before `/:id`.

Media handling:

- use the existing Multer foundation behind a feature storage service;
- centralize allowed MIME types/extensions, max bytes, dimensions, variants, and URL prefix;
- validate decoded media, not only request headers/extensions;
- generate randomized filenames;
- write new file, persist DB reference, commit, then remove replaced file;
- never delete the old file before the database update commits;
- record/document orphan cleanup when filesystem and DB operations split;
- require useful alt text and desktop image before homepage placement.

Authorization tests must prove:

- platform admin can mutate definitions for all stores;
- manager can toggle only their store and cannot mutate definitions/media/budget;
- finance manager/operator/inventory staff/customer cannot toggle or administer;
- Store A manager cannot affect Store B;
- failed and successful high-risk operations are audited;
- hidden coupon rows/codes are absent from public endpoints.

Exit gate: promotion/access/audit/upload API suites and backend full gate.

### C06 — Integrate promotions into authoritative pricing

Branch: `feature/promotions-overhaul`

Commit: `feat(pricing): resolve automatic deals and manual coupons`

Refactor `PricingService` around the frozen quote contract:

- derive categories, base/customization amounts, bundle/deal flags, and store prices from authoritative inputs;
- load global promotions and effective store settings;
- resolve all automatic offers first;
- reject a manual coupon when an offer/deal bundle exists;
- otherwise normalize/validate the one supplied coupon;
- separate `itemDiscountPaise`, `deliveryDiscountPaise`, `promotionSavingsPaise`, `bundleMarkdownPaise`, and `totalDisplayedSavingsPaise`;
- return `discountMode`, `couponEligibility`, conflict line IDs, and `promotions[]`;
- preserve standard versus charged delivery fee;
- allocate item discounts deterministically;
- recalculate line-level inclusive tax;
- bump quote and pricing-policy versions using named constants.

Do not trust `offerId`, client prices, client categories, or client discount calculations. Pricing preview is advisory; final checkout re-resolves inside its transaction.

Tests must cover every promotion type through the quote, automatic/manual exclusivity, multiple line offers, deal-bundle coupon blocking, store opt-out, free delivery, all reconciliation equations, tax after discount, customizations, tie-breaking, overflow, and stable errors.

Exit gate: pricing/checkout quote focused suites plus backend full gate.

### C07 — Persist checkout and COD promotion lifecycle

Branch: `feature/promotions-overhaul`

Commit: `feat(checkout): persist promotion snapshots and COD consumption`

Update checkout and COD order creation to:

- accept only optional `couponCode`;
- lock cart, user eligibility key, store, store products, promotions/settings, and capacity records in the documented order;
- re-resolve pricing in the same transaction;
- create immutable promotion application/allocation snapshots;
- create immutable bundle component/compare-at snapshots;
- reserve or consume exact promotion amounts as required by COD lifecycle;
- count reserved+consumed usage/budget atomically;
- set immutable order `discountMode`;
- clear cart only within the successful transaction;
- make record/release/consume/restore operations collection-based and idempotent;
- preserve existing inventory and payment atomicity.

Concurrent first-order, max-redemption, global-budget, and store-toggle tests require PostgreSQL integration coverage. Unit tests still cover orchestration/error behavior.

Exit gate: checkout/COD/inventory/payment-local tests plus backend full gate.

### C08 — Carry lifecycle through Razorpay and recovery

Branch: `feature/promotions-overhaul`

Commit: `feat(payments): preserve promotions through payment recovery`

Update every singular coupon-bearing payment path:

- Razorpay initiation and client-request idempotency;
- local payment/order attempt projections and DTOs;
- payment verification and webhook finalization;
- provider failure and stale-order release;
- retry/restore and provider-order recovery;
- reconciliation and operational records;
- duplicate/out-of-order webhook behavior.

Rules:

- provider amount always matches the immutable order quote;
- store opt-out or global edits after reservation do not alter an existing provider amount;
- successful capture consumes all reserved promotion applications exactly once;
- confirmed failure/expiry releases all reservations exactly once;
- retries restore the same snapshots/capacity according to the documented lifecycle, not a newly calculated promotion;
- no ledger revenue is recognized at reservation.

Tests must cover zero, one coupon, and multiple offer application rows across initiation/capture/failure/retry/stale recovery/duplicate webhook paths.

Exit gate: all payment, checkout, inventory reservation, and reconciliation suites plus backend full gate.

### C09 — Integrate store and platform financial reporting

Branch: `feature/promotions-overhaul`

Commit: `feat(finance): account for promotion-adjusted revenue`

Update delivered-order event payload/builders, commerce posting, reports, dashboards, refunds, and deterministic fixtures:

- normal pre-discount taxable food revenue credits account `4000`;
- actual item offer/coupon discount debits store-scoped account `4100`;
- post-discount item tax is credited to tax payable;
- free delivery creates zero delivery revenue and no `4100` entry for the waived fee;
- bundle compare-at markdown never appears in ledger discount/refund amounts;
- consolidated platform reports sum store-ledger results and do not subtract promotion spend again;
- promotion analytics reconcile to application snapshots and provide per-store breakdowns;
- refunds use paid post-discount allocations and tax snapshots.

Every journal command must balance. Add explicit two-store tests showing the same global promotion reducing each store's revenue and the consolidated total exactly once.

Exit gate:

```powershell
pnpm.cmd --filter backend test
pnpm.cmd --filter backend typecheck
pnpm.cmd --filter backend build
pnpm.cmd finance:reconcile-fixture
git diff --check
```

Run the fixture only against the documented isolated/local target.

### C10 — Update orders and remove legacy coupon implementation

Branch: `feature/promotions-overhaul`

Commits:

```text
feat(orders): expose immutable promotion and bundle snapshots
refactor(coupons): remove legacy coupon persistence and routes
```

First update order list/detail/admin/customer DTOs and mappers to expose:

- `discountMode`;
- immutable `promotions[]` with item/delivery/total savings;
- promotion allocations needed for explanation;
- immutable bundle component and compare-at/selling-price snapshots;
- no dependency on mutable current product/promotion names for historical display.

Then remove:

- the remaining legacy coupon validation feature/route and any obsolete compatibility helpers;
- old coupon schema exports/relations/types/Zod schemas;
- `orders.coupon_id` and singular coupon payment/order fields;
- stale imports, tests, frontend compatibility types, fixtures, and system-reset table names.

Generate a new cleanup migration that drops legacy coupon tables/columns in valid FK order. Do not edit the integrated additive migration. Update system maintenance truncation tables.

Run:

```powershell
rg -n -i "coupon" backend/src frontend/src docs readme.md
```

Every remaining hit must be intentional customer wording, the new manual-coupon domain, migration history, or documentation. No stale singular persistence identifier may remain.

Exit gate: order/payment/system-maintenance/backend full suites, migration review, lint/typecheck/build.

### C11 — Build platform admin and store manager frontend

Branch: `feature/promotions-overhaul`

Commit: `feat(frontend): add promotion administration and store controls`

Build:

- query keys, DTO types, queries, and mutations;
- platform promotion list/filter/status/analytics;
- strict create/edit form and discriminated rules editor;
- schedule/timezone, limits, budget, target, and tier/BXGY validation;
- desktop/mobile image upload, preview, replace, alt text, and homepage placement;
- platform-only navigation/route protection for definition management;
- manager read-only effective promotion list for selected store;
- manager enable/disable action with confirmation/reason and permission-aware controls;
- loading, empty, error, stale, and permission-denied states;
- accessible labels, validation summaries, focus management, and keyboard operation.

Do not duplicate pricing/eligibility rules in the browser. The frontend validates form shape and displays server results; backend remains authoritative.

Exit gate:

```powershell
pnpm.cmd --filter frontend test
pnpm.cmd --filter frontend lint
pnpm.cmd --filter frontend typecheck
pnpm.cmd --filter frontend build
git diff --check
```

### C12 — Build offers, homepage slider, and combo catalogue UI

Branch: `feature/promotions-overhaul`

Commit: `feat(frontend): add offer discovery and bundle merchandising`

Build:

- public offers page using public offer DTOs only;
- informational offer cards linking to eligible products, with no Apply action;
- featured homepage slider using uploaded desktop/mobile images;
- explicit previous/next controls, keyboard support, focus visibility, alt text, pause behavior, and reduced-motion support;
- deterministic priority order and fallback image/content;
- bundle product cards with compare-at strikethrough, selling price, savings, contents, and one Add Combo action;
- cart bundle line with expandable component summary;
- responsive/loading/empty/error behavior.

Avoid introducing a carousel dependency unless existing primitives cannot meet the accessibility contract. Centralize slider display limits/timing; never scatter literals across components.

Exit gate: relevant frontend tests plus frontend lint/typecheck/build.

### C13 — Update checkout and order-history frontend

Branch: `feature/promotions-overhaul`

Commit: `feat(frontend): explain automatic deals and manual coupon eligibility`

Update shared checkout/order types, query keys, payment/order mutations, checkout page, summary, and order detail pages:

- optional manual coupon input remains the only promotion input;
- show automatic offers or one coupon, never both;
- disable coupon entry when `couponEligibility.eligible` is false;
- explain `OFFER_APPLIED` or `DEAL_BUNDLE_PRESENT` and identify conflicting cart lines;
- render separate item discount, delivery savings, bundle markdown, and total displayed savings without affecting payable reconciliation;
- remove/revalidate coupon when cart changes;
- display immutable promotion/bundle snapshots in order history;
- handle stale quotes, rapid cart changes, loading, validation failure, payment retry, and server errors accessibly.

Do not infer eligibility from local cart state alone. Render the authoritative quote response.

Exit gate: checkout/order frontend suites plus frontend full gate.

### C14 — Seeds, documentation, integration evidence, and release gate

Branch: `feature/promotions-overhaul`

Commit: `test(promotions): complete fixtures documentation and release evidence`

Complete:

- deterministic promotions/coupons across all supported discount types;
- pre-built pizza+drink bundle and component mappings;
- global promotion store settings showing default-on plus one explicit opt-out;
- desktop/mobile featured promotion fixture media and fallback;
- financial two-store scenario and reconciliation fixture;
- demo reset/system maintenance coverage;
- API reference, database schema, architecture, order/payment lifecycle, finance policy, setup, and in-app documentation;
- architecture diagram: discovery → quote → reservation → payment → order snapshot → ledger/reporting;
- authorization matrix and store opt-out workflow;
- operational media cleanup and promotion recovery notes.

Final automated evidence:

```powershell
pnpm.cmd preflight
pnpm.cmd finance:reconcile-fixture
git diff --check
```

Additionally, against an isolated disposable PostgreSQL database:

1. Apply the full checked-in migration chain from empty.
2. Run deterministic reset/seed.
3. Run concurrency tests for first-order, redemption capacity, global budget, and manager-toggle races.
4. Run COD and Razorpay reservation/finalization/recovery cases.
5. Record commands, target type, date, commit SHA, and actual pass/fail results.

Complete the manual matrix in Section 9. Do not call the work complete if any required gate is unrun; label environment-dependent checks accurately.

---

## 7. Cross-Cutting Invariants Checklist

Every reviewer checks applicable invariants.

### Promotion and coupon

- [ ] Coupons are never returned by offer/featured listing endpoints.
- [ ] Offers never have codes; coupons always have normalized unique codes.
- [ ] No request accepts an `offerId` for checkout.
- [ ] Any automatic offer or deal bundle blocks coupons for the whole cart.
- [ ] A unit is never discounted by two offers.
- [ ] Tie-breaking is deterministic.
- [ ] Store opt-out is effective for new quotes/orders only.
- [ ] Platform deactivation wins over store settings.
- [ ] Definition edits increment version and never mutate order history.

### Money, tax, and financials

- [ ] All money is safe integer paise; all rates are integer bps.
- [ ] Item allocations sum exactly to `itemDiscountPaise`.
- [ ] No item total becomes negative.
- [ ] `grandTotal = itemsSubtotal - itemDiscount + chargedDelivery + rounding`.
- [ ] Taxable amount plus tax equals each post-discount line total.
- [ ] Delivery discount is not double-subtracted.
- [ ] Bundle compare-at markdown is display-only.
- [ ] Item offers/coupons reduce the fulfilling store through account `4100`.
- [ ] Platform consolidation does not deduct promotions again.
- [ ] Reserved/released applications produce no revenue entry.
- [ ] Refunds never exceed paid post-discount allocations.

### Inventory and bundles

- [ ] Bundle demand expands to component quantities.
- [ ] Component and standalone demand is aggregated before validation/locking.
- [ ] Lock order is deterministic.
- [ ] Bundle availability reflects every component.
- [ ] Nested bundles are rejected.
- [ ] Bundle SKU has no competing independent stock pool.
- [ ] Order history reads immutable component snapshots.

### Authorization and audit

- [ ] Only platform admin mutates definitions/media/budget.
- [ ] Only the same-store `manager` toggles store participation.
- [ ] Other roles are denied even if frontend controls are bypassed.
- [ ] Coupon codes cannot be enumerated.
- [ ] Success and failure attempts are audited without secrets/raw files.
- [ ] Customer/address/store data is scoped to the authenticated principal.

### Reliability

- [ ] Preview and final checkout use the same domain engine.
- [ ] Final checkout re-evaluates under transaction locks.
- [ ] Reserve/consume/release/restore is idempotent.
- [ ] Duplicate webhooks do not double-consume budget or applications.
- [ ] Existing provider orders retain captured price after admin/store changes.
- [ ] Empty-database migration and deterministic seed are reproducible.

---

## 8. Existing-Issue Protocol

The owner explicitly requires existing issues found during this work to be fixed without compromising code quality. Apply this protocol:

1. **Prove it first.** Add or identify a failing regression test, constraint violation, security path, or reproducible command. Do not refactor based on suspicion alone.
2. **Classify it.** Mark it correctness, money/tax, security/privacy, authorization, concurrency, data integrity, reliability, accessibility, performance, or maintainability.
3. **Fix blockers immediately.** If the issue is in touched code or blocks the assigned gate, fix it before the feature behavior.
4. **Use a separate commit.** Commit as `fix(<scope>): <specific outcome>` before the feature commit so it can be reviewed independently.
5. **Sequence cross-cutting fixes.** If it belongs to another hot-file owner, stop concurrent work in that area and record the evidence. Resolve it as a dedicated commit on `feature/promotions-overhaul` before resuming the dependent feature commit.
6. **Add regression coverage.** A fix without a test requires an explicit explanation of why automation is impossible and a recorded manual check.
7. **Update affected docs/contracts.** Especially for API, security, lifecycle, finance, and operational behavior.
8. **Avoid opportunistic rewrites.** Fix the demonstrated issue at the correct abstraction boundary; do not mix broad formatting, renames, dependency upgrades, or unrelated architecture changes.

No discovered issue may be silently ignored. If it cannot be fixed safely in the current commit, record it in the handoff with evidence, severity, affected owner, and required integration point.

---

## 9. Manual Release Matrix

Record tester, date, commit SHA, store/user IDs, payment mode, and result for every row.

### Platform and store governance

- [ ] Platform admin creates/edits/schedules/deactivates an offer and coupon.
- [ ] Platform admin uploads/replaces desktop/mobile media and sets homepage placement.
- [ ] New active promotion is enabled at two stores by default.
- [ ] Store A manager disables/re-enables only Store A.
- [ ] Store B remains unaffected.
- [ ] Finance manager/operator/inventory staff/customer cannot toggle or edit.
- [ ] Audit shows successful and denied attempts with correct store/promotion/version.

### Customer pricing

- [ ] Offered pizza automatically receives fixed/percentage offer.
- [ ] A second distinct offered line can receive its own best offer.
- [ ] Overlapping offers choose the deterministic winner.
- [ ] Coupon input is blocked/rejected while any automatic offer applies.
- [ ] Coupon input is blocked/rejected when a deal bundle is present.
- [ ] Removing the conflicting item permits manual coupon validation.
- [ ] Store opt-out removes that promotion from new discovery/quotes.
- [ ] Percentage/fixed/BXGY/tiered/free-delivery boundaries reconcile exactly.
- [ ] Customization and minimum-order policy matches the ADR.

### Bundles and media

- [ ] Combo card shows compare-at price, selling price, savings, contents, and image.
- [ ] Combo is one cart/order line and consumes correct component inventory.
- [ ] Unavailable/insufficient component disables checkout.
- [ ] Homepage slider is responsive, keyboard-operable, paused/reduced-motion safe, and ordered by priority.
- [ ] Missing/broken media uses fallback without exposing filesystem paths.

### Payments, recovery, and financials

- [ ] COD discounted order consumes promotion once and posts on delivery.
- [ ] Razorpay initiation reserves exact capacity/budget.
- [ ] Capture consumes once; duplicate webhook is a no-op.
- [ ] Failure/expiry releases once; retry restores documented snapshot.
- [ ] Store opt-out after provider-order creation does not change payable amount.
- [ ] Item offer/coupon posts account `4100` at the fulfilling store.
- [ ] Free delivery posts zero delivery revenue and no waived-fee `4100` amount.
- [ ] Bundle markdown does not post to `4100`.
- [ ] Two-store platform consolidation reflects discounts exactly once.
- [ ] Refund uses paid post-discount/tax allocation.
- [ ] Promotion global/per-store analytics reconcile to orders and ledger.

---

## 10. Final Definition of Done

The overhaul is complete only when:

- all C00-C14 commits are integrated in dependency order;
- no temporary legacy scaffolding, adapter, or dual-read/write path remains;
- all known/discovered issues have regression-tested fixes;
- no unexplained magic number/string is introduced;
- schema, migration SQL, DTOs, frontend types, docs, and tests agree;
- empty-database migration and deterministic seed pass;
- PostgreSQL concurrency tests pass;
- COD/Razorpay recovery and financial reconciliation pass;
- `pnpm preflight` passes;
- `git diff --check` passes;
- the manual release matrix is executed and honestly recorded;
- remaining `coupon` references are intentional and reviewed;
- the integration branch contains no unrelated user changes or generated artifacts;
- the final handoff identifies any environment-dependent check that was not run.

The integration owner performs one final review focused on money reconciliation, store/platform revenue attribution, cross-store authorization, hidden coupon privacy, lock ordering, immutable snapshots, and documentation truthfulness before merging `feature/promotions-overhaul` to `main`.
