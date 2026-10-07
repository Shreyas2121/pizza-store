# C14 — Fixtures, documentation and release evidence

**Implementation is integrated; release validation remains pending.** Live database checks were skipped at the owner's request. The database/browser/provider manual matrix is unrun. No empty-database, seed/reset, lock-race, live ledger, provider or visual result is claimed.

- Branch: `feature/promotions-overhaul`.
- Starting SHA: `5b5506614873f9d78c3243d508c5585c473dd47e` (C13).
- Commit: `test(promotions): complete fixtures documentation and release evidence`; resolve its SHA with `git log -1 --format=%H -- docs/promotions-c14-handoff.md`.
- Date: 2026-10-07. Implementation/offline checks: Codex. Manual tester: unassigned.

## Deterministic demo data

[`promotions.fixtures.ts`](../backend/src/fixtures/promotions.fixtures.ts) defines eight validated fixtures. The reference clock is 2026-10-07T06:30Z and the fixed half-open active interval is 2026-01-01 through 2030-01-01. Offers intentionally expire after that interval. IDs are resolved from actual catalogue/store rows, never assumed serial values.

| Fixture | Behavior |
| --- | --- |
| Demo pizza 10 percent | Margherita base saving; desktop/mobile featured media; Bengaluru opt-out |
| Demo pizza 20 rupees off | Pizza-category fixed saving; desktop-only featured media demonstrates mobile fallback |
| Demo buy two get one pizza | Three eligible pizzas form one two-buy/one-get group; no artwork demonstrates readable card fallback |
| Demo delivery saving | Free delivery from 200 rupees item subtotal |
| Demo cart tiers | 5 percent from 1,000 rupees, 10 percent from 2,000 rupees, explicit caps |
| DEMO10 | Manual percentage coupon on an offer-free/non-bundle cart |
| DEMO30 | Manual fixed coupon on an offer-free/non-bundle cart |
| DEMOFIRST | Manual first-order tier coupon; per-user limit does not override first-order eligibility |

The contract supports percentage/fixed/tiered coupons; BXGY and free delivery are offer-only. Store delivery-threshold policy may already waive delivery, so a quote need not report a promotion saving when its standard charge was already zero. Overlapping fixtures use the production winner algorithm; advertised offers are not forced to win.

The `pizza-and-coke-combo` product contains one Margherita and one Coca-Cola, sells for 32,900 paise against 35,900 compare-at, and has no customizations or separate inventory pool. Store mappings derive stock/availability from components and show 3,000 paise display-only markdown. The Pizzas menu includes it. The legacy menu junction lacks a unique constraint, so the seed checks existence under the advisory lock rather than relying on `ON CONFLICT`.

[`seedPromotions`](../backend/src/scripts/promotions.ts) adds missing definitions/rules, components/store/menu mappings and one opt-out. Existing kind/name definitions preserve versions, media and store choices. Existing component/store rows use conflict-safe inserts. Kind/name is a development identity: renaming an offer then rerunning may create another offer. Code/name collisions fail instead of overwriting unrelated coupons. Required admin/catalogue/store data is checked before writes; the script does not create users.

`db:seed` invokes it after the base catalogue/store seed. `demo:reset` invokes it after both stores/memberships exist, then seeds the unchanged historical financial scenario. `seed:catalog` stays independently usable without an admin prerequisite; `seed:promotions` is the explicit follow-up.

The reset defines these development accounts; no login was tested against a running application:

| Account | Password | Purpose |
| --- | --- | --- |
| admin@pizzastore.com | admin123 | Platform definitions/media/analytics |
| mumbai.manager@pizzastore.com | manager123 | Mumbai-only manager |
| bengaluru.manager@pizzastore.com | manager123 | Bengaluru-only manager |
| finance@pizzastore.com | finance123 | Both-store finance manager; no promotion toggle |
| customer@pizzastore.com | customer123 | Historical finance orders |
| new.customer@pizzastore.com | customer123 | No orders; Mumbai/Bengaluru addresses |

Store slugs are `pizzastore-default` (400001) and `pizzastore-bengaluru-south` (560034). Missing participation settings stay default-on; only the percentage offer has a seeded Bengaluru opt-out. Seed-admin provisioning is separate from HTTP manager endpoints and does not grant an admin manager-toggle override. Existing catalogue photos still depend on local upload assets.

Trusted code-defined SVG is rasterized with Sharp into three WebP files: desktop/mobile percentage artwork and desktop-only fixed artwork. Fixed managed UUID filenames live under the backend media root. Public SVG uploads remain forbidden. The existing media lifecycle advisory lock serializes seed/upload/cleanup. Exclusive creation never overwrites assets; non-files, symlinks or different bytes at a fixture path fail safely. Failed transactions may leave unreferenced managed assets for normal age-gated cleanup. See [media/recovery operations](promotions-operations.md).

## Offline integration and documentation

[`promotion-reconciliation.fixtures.ts`](../backend/src/fixtures/promotion-reconciliation.fixtures.ts) executes production delivered-order recognition, balanced journal validation and report projection for automatic offers/free delivery, manual coupons and bundle/free delivery at two stores. Platform tax-exclusive recognized revenue is respectively 27,000, 37,000 and 30,000 paise; `4100` is 3,000, 3,000 and zero. Platform equals summed store reports, waived delivery produces no delivery revenue, and bundle markdown produces no contra-revenue. This benchmark is separate from historical July/August totals.

`pnpm.cmd finance:reconcile-fixture` executes injected-repository reports and pure promotion fixtures without database queries or seeding. It passed 12 reports, 12 CSV exports, four store-months and six journals across three promotion scenarios. It does not prove a migrated database or live ledger reconciles.

The [accessible architecture diagram](../frontend/src/features/docs/content/diagrams/promotions.ts), rendered in `/docs/architecture`, traces discovery → quote → final locked checkout → COD consumption/online reservation → payment/recovery → immutable snapshots → delivery/outbox → store ledger/platform reports. In-app state diagrams now use canonical `delivered` and `out_for_delivery`, and describe saved names and current recovery. Setup, API/schema/architecture, finance fixtures/policy and operational docs link this evidence. Historical rollout/case-study notes remain labeled historical.

| Actor | Definition/media/analytics | Store participation |
| --- | --- | --- |
| Platform admin | `platform.promotions.manage` | Manager endpoint denied |
| Active same-store manager | Denied | Own store with `store.promotions.toggle` |
| Other store manager | Denied | Different store denied |
| Finance manager/operator/inventory staff | Denied | Denied |
| Customer/anonymous | Denied | Denied |

Public offer discovery never enumerates coupon codes; validation/orders require customer authentication/ownership. Manager workflow: open `/admin/store-promotions`, disable the assigned store with a reason, refresh that store's discovery/quote, and re-enable to restore participation. Another store stays enabled. Global deactivation wins. Edits/toggles affect new quotes/orders; existing provider orders retain captured versions, amounts and allocations through recovery.

## Automated evidence

Baseline preflight passed 866 backend tests in 120 files and 96 frontend tests in 12 files, both lint/typechecks/builds. C14 adds 18 backend tests in three files: validated persistence round trips and exact discounts, participation, manual/exclusive/first-order behavior, bundle/reset coverage, decodable media, two-store recognition/posting/report reconciliation, and seed orchestration/idempotency/prerequisite rejection. Mocked seed tests verify writes but do not prove PostgreSQL FK/constraint execution.

Pre-commit preflight passed 884 backend tests in 123 files and 96 frontend tests in 12 files, both lint/typechecks/builds. Post-commit preflight, offline reconciliation and unstaged/staged whitespace checks are required before completion; the completion message records results and SHA. Existing lint warnings are 298 backend and 3 frontend. Sharp's rasterizer can report unavailable font-cache directories in the sandbox; WebP decode/dimensions pass, while typography remains visually unverified. Existing Vite chunk/barrel warnings remain.

Final reference audit: `rg -i "coupon" backend/src frontend/src docs readme.md`, plus targeted retired table/router/counter identifiers. Remaining code hits are manual input, kind validation, lifecycle/snapshots, fixtures or regressions proving retired persistence absent. Migration metadata and explicitly historical plans retain old identifiers. No retired table export/router/adapter, automatic code selection or mutable usage counter is restored.

## Unrun release gates

| Gate | Status/reason |
| --- | --- |
| Empty PostgreSQL migration chain | Unrun at owner's request |
| Deterministic seed/reset on migrated PostgreSQL | Unrun at owner's request |
| First-order/capacity/global-budget/toggle PostgreSQL races | Unrun at owner's request; unit orchestration cannot prove locks |
| COD/online finalization/recovery with live data | Unrun at owner's request |
| Actual ledger/analytics/refund reconciliation | Unrun at owner's request; offline command passed separately |
| Browser/responsive/keyboard/focus/provider walkthrough | Unrun; no seeded application used for manual matrix |

Every manual row below is **unrun** as of 2026-10-07: tester **unassigned**, target **not executed**, actual store/user IDs **unassigned**, payment mode **not executed**. Revision is the C14 SHA resolved above. Replace these fields with actual observations during execution; expected account/store identities are not runtime evidence.

| Manual row from guide §9 | Status |
| --- | --- |
| Platform create/edit/schedule/deactivate offer and coupon | Unrun |
| Upload/replace desktop/mobile media and placement | Unrun |
| New promotion default-on at two stores | Unrun |
| Store A manager disable/re-enable own store | Unrun |
| Store B unaffected | Unrun |
| Finance/operator/inventory/customer mutations denied | Unrun |
| Success/denial audits show actor/store/version | Unrun |
| Offered pizza fixed/percentage savings | Unrun |
| Second distinct line receives its offer | Unrun |
| Deterministic overlapping winner | Unrun |
| Coupon blocked/rejected with automatic offer | Unrun |
| Coupon blocked/rejected with bundle | Unrun |
| Remove conflict and validate manually | Unrun |
| Opt-out removes new discovery/quote applicability | Unrun |
| All five discount types reconcile at boundaries | Unrun |
| Customization/minimum-order ADR policy | Unrun |
| Combo prices/savings/contents/image | Unrun |
| One bundle line and correct component consumption | Unrun |
| Insufficient/unavailable component blocks checkout | Unrun |
| Responsive keyboard/paused/reduced-motion slider | Unrun |
| Missing/broken media fallback without path disclosure | Unrun |
| COD consumes once and posts on delivery | Unrun |
| Online reserves exact capacity/budget | Unrun |
| Capture once; duplicate webhook no-op | Unrun |
| Failure/expiry releases once; retry restores snapshot | Unrun |
| Opt-out after provider creation retains payable | Unrun |
| Item offer/coupon posts fulfilling-store 4100 | Unrun |
| Waived delivery zero revenue and no 4100 | Unrun |
| Bundle markdown no 4100 | Unrun |
| Platform consolidation discounts once | Unrun |
| Refund uses paid post-discount/tax allocation | Unrun |
| Global/store analytics reconcile to orders/ledger | Unrun |

No merge, deployment or publication was performed. The integration owner must review money/store attribution, authorization/hidden-code privacy, lock order and immutable recovery, then obtain missing evidence before declaring the overhaul release-ready. Owner restrictions continue on subsequent turns.
