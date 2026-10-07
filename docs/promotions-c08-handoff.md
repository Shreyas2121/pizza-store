# C08 implementation handoff

Commit/branch: C08 / `feature/promotions-overhaul`.

Starting SHA: `c380f7c40691f1286ca83aec5236f29ad1a66347` (C07). Prerequisite commits: `54a172b` inventory retry/consumption, `668d279` failed-attempt first-order eligibility, `505601b` validation quota scan, and `e36888c` linked payment-ID projection. Final implementation commit: `feat(payments): preserve promotions through payment recovery`; the completion response and branch history report its exact SHA.

## Goal completed

Online initiation uses the same v4 authoritative quote and immutable order/item/bundle/application writer as COD. The writer/repository and their tests are renamed from `checkout-cod.*` to `checkout-snapshot.*` to reflect the shared responsibility. The existing COD entrypoint remains available through the checkout barrel. The online transaction persists the payment and attempt, reserves all application rows and saved component inventory quantities, and clears the locked cart before provider creation. Repeated client request IDs reuse the saved contract; no current promotion recalculation or legacy coupon read/write occurs in payment code.

Provider requests use the saved payable amount. Verification, finalization, recovery and expiry reject provider/local quote amount or currency mismatch. Captured payment consumes the complete collection once; duplicate callbacks/webhook claims and late failure events preserve completed/refunded state. Only authoritative capture restores released promotion capacity without enforcing current limits. Physical stock still must be available; stock or cancelled-order conflicts roll back finalization and require operational resolution. Reservation creates no financial event; capture preserves the existing payment-captured event. Delivered revenue/ledger changes remain C09 work.

Failed owned awaiting-payment orders restore original inventory demand and promotion capacity atomically for retry. Current schedule/deactivation/opt-out/definition edits do not change snapshots or provider amount. Capacity/budget/stock conflicts reject retries; cancelled/expired orders require new checkout. Retry searches by receipt before creating a provider order when the identity was lost. Receipt attachment checks amount/currency/receipt, preserves failed or terminal state, and cannot restore released capacity without capture evidence.

Expiry uses persisted payment-attempt deadlines and finds holds even without tracked inventory. Initiation gives inventory and attempts the same 30-minute deadline; successful retry renews both. Provider observations and receipt attachment cannot postpone expiry. Provider uncertainty/authorization/paid conflicts or in-flight creation without an attached identity preserve reservations and produce operational errors/conflicts. The locked release path rechecks completion, provider identity and payment activity after discovery, preserving concurrent retries/captures. All collections are released together on confirmed failure/expiry.

## Files and contracts

Payment initiation/finalization/verification, stale recovery, provider recovery, repository/projections, response helpers/types, request schema and scoped tests changed. Shared checkout writer/repository/tests were renamed; the writer now retains locked store context for online description. Inventory reservation duration has a narrow constants module. Guide progress, API reference, architecture, ADR-006/007 and promotion operations document the captured lifecycle and exceptions.

Checkout/status/retry responses expose `discountMode`, `orderStatus` and immutable `promotions[]`: promotion ID, kind/name/code/type/version and item/delivery/total savings. Repository aggregation reads application snapshots in deterministic promotion-ID order, without mutable definition joins or N+1 application reads. Customer codes remain visible only through their own authenticated attempts. Online requests use the same normalized 64-character optional manual-code schema as COD; client offer/price/discount-mode fields remain forbidden. Existing-order lifecycle locks order, user eligibility, store and payment before inventory and promotion collections. Unit/query doubles do not prove PostgreSQL locking.

No migration, schema, dependency, lockfile, seed or frontend changes. Legacy checkout/coupon implementation and historical order DTO cleanup remain assigned to C10; payment production code contains no singular coupon persistence references or legacy pricing calls. C11/C12 frontend work has not been implemented; the owner explicitly requested C08 after C07.

## Existing issues fixed

- Retry had no saved-inventory restoration; retries now validate original demand before restoring released rows. Capture now consumes saved reservations even after inventory tracking is disabled, preventing permanently active holds.
- Promotion first-order queries counted awaiting-payment orders whose payments had failed. They now ignore those attempts while fulfilment statuses still disqualify.
- Validation scanned all active quotas on every request. A 10,000-principal saturation test timed out under compiler load; cleanup now runs only when an expiry is due, retaining quotas and memory bounds. A staggered-expiry regression preserves still-active limits.
- An attempt-to-local projection returned the attempt ID as the payment ID. It now uses the order's actual payment foreign key; the fixture deliberately has distinct IDs.
- Runtime transaction-method guards could silently skip payment-attempt/event writes. Finalization now requires those writes, and incomplete unit doubles were corrected instead of weakening production behavior.

## Verification

Baseline backend gate passed: 842 tests / 115 files, lint with 308 existing warnings and zero errors, production typecheck and build. Focused final checkout/payment/inventory/application suites passed 210 tests / 19 files. Payment projection regression passed 14 tests; quota regression passed all 3 tests. New inventory/payment tests were additionally typechecked with the Express declaration included; normal production typecheck excludes tests.

Final full backend tests passed: 878 tests across 119 files. Lint passed with zero errors and 307 existing warnings; production typecheck and build passed. The final payment-only suite passed 98 tests across 8 files, including shared deadline persistence and expiry-query construction. `git diff --check` passed. During development, one cleanup edit caused syntax failures; it was corrected before the final gate. The initial full run also exposed the quota saturation timeout described above. Older expiry doubles lacked real provider identity fields and were updated for the locked identity recheck; assertions were retained.

No database connection, migration, seed, maintenance/reconciliation script, PostgreSQL integration/concurrency check, browser session, or live Razorpay/manual payment/finance check was intentionally run. Database checks are deferred at the owner's explicit request. Mock/query tests establish lifecycle orchestration and query construction only.

## Follow-up dependencies

C09 finance and C10 historical order DTO/legacy cleanup remain the next backend slices. C11/C12 frontend governance/discovery, C13 checkout/orders and C14 isolated-database/manual release evidence remain pending. This is C08 implementation completion, not overhaul release approval or a claim of database/provider concurrency verification.
