# Case-study implementation evidence

Reviewed: 2026-09-05. Source revision: `15362b5a3500d4ea596e66bd2e9e519a418ed650` on `main`.

This is the C01 source audit for the public case study. It records code behavior and the scope of test evidence, not a production certification. Source links are relative to this repository; no Git remote is configured in the reviewed checkout. Public repository/deployment URLs and personal ownership statements remain publication inputs.

The owner reports a financial rework on another branch. Financial findings and baseline failures below are a snapshot of the reviewed `main` revision. Do not repair them in this docs phase or treat them as claims about that other branch. Re-audit affected claims after integration and before publishing the payment/inventory pages.

Follow-up implementation (C02, 2026-09-05): ARCH-03 below describes the historical audit revision. The current app now gates `BusinessRuntime` with React Router's `/docs/*` match, isolating socket/chat/modal effects from docs. Chat sync consumes an abort signal; socket/modal cleanup is explicit. Lint and ten route-match checks passed; the same baseline build failure remains deferred and browser lifecycle checks are pending. See [guide C02 handoff](../guide.md#latest-handoff). This change does not upgrade the historical source audit into browser-tested evidence.

Follow-up implementation (C03, 2026-09-05): the public overview and docs shell now exist in `frontend/src/features/docs/`. Their public evidence subset uses ORDER-01, INV-02, and ACCESS-02 from this reviewed revision. C03 lint passed with existing warnings. The owner requested no further app/build/test/browser runs; runtime behavior is not claimed verified. Financial findings below remain the historical C01 snapshot.

Follow-up implementation (C04, 2026-09-05): `/docs/architecture` presents context/container views, the audited COD sequence, state ownership, and a retrospective assessment of the modular monolith. It projects ARCH-01/ARCH-02/ORDER-01 without changing their reviewed revision. Mermaid is declared and locked at 11.17.2, with lazy loading, strict rendering configuration, textual equivalents, source fallback, and cancellation cleanup. No diagram execution, build, or browser checks were run per owner direction; these implementation notes are not new runtime evidence.

Follow-up implementation (C05, 2026-09-05): `/docs/order-lifecycle` projects the order/payment audit into transaction sequences, separate state descriptions, cancellation effects, and recovery scenarios. Relevant order/payment/inventory/checkout source is unchanged from the reviewed revision. Source review clarified PAY-05: failed claims can be reclaimed immediately; only processing claims require the five-minute stale window. No backend changes, financial-branch integration, or app/build/test/browser runs were performed. These are documentation implementation notes, not new runtime evidence.

## Evidence labels

- **Implemented**: the cited source contains the behavior. This does not imply live, integration, or concurrency verification.
- **Limitation**: an observed gap or a narrower guarantee than the original proposal.
- **Unverified**: this audit cannot establish deployment, runtime, or historical information.
- **Proposed**: future work; never display it as current functionality.

All claim IDs below share the reviewed revision/date above. Keep these IDs stable when updating claims. The future frontend evidence registry should reference them and expose a concise public subset.

## Claim registry

| ID | Status | Current claim and source symbols | Test evidence / limit |
| --- | --- | --- | --- |
| ARCH-01 | Implemented | React SPA, Express HTTP server hosting Socket.IO, Drizzle/PostgreSQL, and external Razorpay. [Server bootstrap](../backend/src/index.ts), [DB client](../backend/src/db/index.ts), [gateway](../backend/src/features/payments/razorpay.gateway.ts): `RazorpaySdkGateway`. | Source review. No deployment topology or load measurements established. |
| ARCH-02 | Implemented | Feature-organized frontend, lazy app routes, TanStack Query server state, Zustand auth/support state. [Router](../frontend/src/app/router/routes.tsx), [query provider](../frontend/src/app/providers/query-provider.tsx), [auth store](../frontend/src/features/auth/model/auth.store.ts). | Frontend lint passed; build baseline failed as recorded below. |
| ARCH-03 | Limitation | Authenticated chat sync, socket creation, and global modal mount at the app root. [App](../frontend/src/app/app.tsx): `App`. A docs layout alone will not isolate business effects. | Source review; C02 must verify docs with and without an existing auth token. No browser check performed in C01. |
| ORDER-01 | Implemented | COD quote, payment, order/item price snapshots, tracked stock deduction, sale ledger, coupon consumption, and cart clearing share one transaction. [Order service](../backend/src/features/order/order.service.ts): `createOrder`; [checkout](../backend/src/features/checkout/checkout.service.ts): `buildQuote`, `createOrderSnapshot`. | [Order service tests](../backend/src/features/order/order.service.test.ts): mocked COD orchestration; [checkout test](../backend/src/features/checkout/checkout.service.test.ts): mocked quote/stock validation. No real competing transactions. |
| ORDER-02 | Implemented | Current transition map uses `awaiting_payment`, `pending`, `preparing`, `delievered`, `cancelled`; repeated same-status updates are no-ops. [Order logic](../backend/src/features/order/order.logic.ts): `VALID_ORDER_TRANSITIONS`; order service `updateOrderStatus`. | [Pure transition tests](../backend/src/features/order/order.logic.test.ts) and mocked service tests. Stored spelling is legacy; there is no `out_for_delivery` state. |
| ORDER-03 | Limitation | Prices, quantities, customization prices, totals, and discount are copied; product/customization identity and address remain references. [Checkout](../backend/src/features/checkout/checkout.service.ts): `createOrderSnapshot`; [order schema](../backend/src/db/schema/order.schema.ts). | Source review. Do not describe a complete immutable product-name/address snapshot. Order monetary columns use `doublePrecision`; payment `amountPaise` is an integer. |
| PAY-01 | Implemented | Online initiation commits local order/payment, tracked reservations, optional coupon reservation, and cart clearing before provider creation. Provider creation is claimed in another transaction and attached in a later transaction. [Payment service](../backend/src/features/payments/payment.service.ts): `findOrCreateLocalAttempt`, `claimProviderOrderCreation`, `ensureProviderOrder`. | [Payment inventory tests](../backend/src/features/payments/payment.service.inventory.test.ts), initiation test currently fails before its assertions due to an unmocked DB lookup. Provider workflow is source evidence only. |
| PAY-02 | Implemented | Repeated client request IDs reuse the same user's attempt; mismatched users conflict. Payment schema has unique client request/provider order/provider payment IDs. [Repository](../backend/src/features/payments/payment.repository.ts): `getAttemptByClientRequestId`; [payment schema](../backend/src/db/schema/payment.schema.ts). | Source/schema review. This is not a payload-fingerprint guarantee or proof of provider-side exactly-once order creation. |
| PAY-03 | Implemented | Checkout signature verification precedes provider re-fetch. Finalization requires matching associations, currency, amount, captured payment, paid order, exact paid amount, and zero due. [Reconciliation](../backend/src/features/payments/payment-reconciliation.service.ts): `verifyRazorpayPayment`, `reconcileProviderPayment`, `assertProviderStateMatches`. | Source review; no dedicated end-to-end provider/signature test established in this audit. |
| PAY-04 | Implemented | Finalization locks the joined order/payment rows, consumes inventory and coupon reservations, completes payment, and moves order to pending in one transaction. Same completed payment ID returns `finalizedNow: false`; a different ID conflicts. Reconciliation: `finalizeCapturedPayment`. | Payment inventory tests use a mocked transaction/consumption service for capture, already-completed replay, and released-reservation rejection. |
| PAY-05 | Implemented | Webhook validates HMAC over raw bytes, claims a unique event ID, treats processed replay as duplicate, rejects fresh in-progress claims, reclaims failed claims immediately, and reclaims processing claims after five minutes. [Webhook service](../backend/src/features/payments/razorpay.webhook.ts): `handle`, `claimEvent`; [event schema](../backend/src/db/schema/payment-event.schema.ts). | Source/schema review. No webhook lifecycle integration test established. Claim transaction, payment finalization, and processed marking are separate boundaries. |
| PAY-06 | Limitation | Retry service restores coupon reservation/payment processing but does not recreate released inventory reservations. Missing `/payments/methods` and retry HTTP routes also prevent describing the frontend flow as fully wired. Payment service `retryRazorpayOrder`, `reactivateProviderOrder`; [routes](../backend/src/features/payments/payment.routes.ts); [frontend calls](../frontend/src/features/checkout/api/payment.mutations.ts). | Source review at this revision. Defer changes to the other workstream and recheck after its integration. |
| INV-01 | Implemented | `null` on-hand means untracked; tracked displayed availability is `max(0, onHand - reserved)`. Demand aggregates by product across customized lines. [Inventory logic](../backend/src/features/inventory/inventory.logic.ts): `aggregateCartDemand`, `getAvailableQuantity`, `validateStockDemand`. | [Pure inventory logic tests](../backend/src/features/inventory/inventory.logic.test.ts). Clamping alone does not prove underlying stock consistency. |
| INV-02 | Implemented | Checkout locks stock rows in ascending store-product ID before reading aggregate reserved quantity. Active means `status = reserved`, including past-deadline rows until released/consumed. [Inventory service](../backend/src/features/inventory/inventory.service.ts): `lockStoreProducts`, `validateAndLockStock`, `getActiveReservedQuantities`. | [Mocked inventory service tests](../backend/src/features/inventory/inventory.service.test.ts) assert helper/query orchestration. No live lock contention evidence. |
| INV-03 | Implemented | Tracked reservations default to 30 minutes. Consumption rejects any released row, locks ascending stock/reservation IDs, deducts on-hand and writes sale movements. `reserveStockForOrder`, `consumeReservationsForOrder`. | Mocked inventory and payment tests. Consumption does not itself compare `expiresAt`; an expired but still-reserved row can be consumed. No reservation rows returns zero consumption, accommodating untracked stock. |
| INV-04 | Limitation | Ascending stock-row locking is not a uniform global order across all paths: restoration releases reservation rows before locking stock; release itself is a bulk update. Checkout also locks coupons, and staff inventory writes can lock memberships. | Source review; see lock table. Do not claim deadlock freedom. No deadlock was reproduced by C01. |
| INV-05 | Implemented | Stock writes append sale/restock/adjustment/cancellation movements with arithmetic checks; sale/cancellation keys are unique. [Inventory schema](../backend/src/db/schema/inventory.schema.ts), [migration 0004](../backend/migrations/0004_lucky_shape.sql). | Mocked service tests plus schema/migration review. Constraints were not applied or validated on a disposable DB here. The system-maintenance clear operation can truncate this ledger; it is not a tamper-proof or universally immutable log. |
| INV-06 | Implemented | Staff restock/adjustment reauthorize within their write transaction, lock stock, and write audit records. Adjustments reject targets below reserved stock. Inventory service `restockProduct`, `adjustStock`, `bulkRestock`; inventory logic `assertAdjustmentCoversReservations`. | Mocked service tests for transactional authorization, audit failure propagation, bulk preparation; pure adjustment tests. No live admin-vs-checkout race test. |
| REC-01 | Implemented | Expiry checks provider state outside DB transactions, preserves uncertain reservations, finalizes confirmed capture, or cancels an awaiting-payment order and releases holds. Reconciliation: `reconcileExpiredReservations`. | Payment inventory tests cover release, fetch/config errors, and unattached processing attempts with mocks. See expiry matrix below for conditions. |
| REC-02 | Implemented | Stale payment reconciliation scans processing/failed attempts, can recover provider order attachment by deterministic receipt, and re-fetches provider state. Reconciliation: `reconcileStalePayments`, `attachRecoveredProviderOrder`. | Source review. Receipt recovery is not proof of perfect provider deduplication; gateway rejects multiple receipt matches. |
| REC-03 | Unverified | Two one-shot reconciliation scripts exist. No scheduler/hosting manifest was found in the inspected repository; startup does not schedule them. [Payment script](../backend/src/scripts/reconcile-payments.ts), [reservation script](../backend/src/scripts/reconcile-inventory-reservations.ts). | Read-only inspection; neither script was executed. A proposed five-minute cadence is operational guidance, not deployed evidence. |
| ACCESS-01 | Implemented | JWT signature/issuer/audience/expiry and token version are checked; active principal is reloaded from DB and attached as `req.principal`. [Auth service](../backend/src/features/auth/auth.service.ts): `authenticateToken`; [middleware](../backend/src/middleware/authenticateUser.ts). | [Auth tests](../backend/src/features/auth/auth.service.test.ts): JWT behavior with injected user loader, no live HTTP/database check. |
| ACCESS-02 | Implemented | Platform `admin/user` and store `manager/operator/inventory_staff` are separate. Active store membership and permissions govern staff access; resource denial can become 404. [Policy](../backend/src/features/access/access.permissions.ts), [authorization](../backend/src/features/access/access.service.ts): `requireStorePermission`, `requireResourceStorePermission`. | [Pure policy tests](../backend/src/features/access/access.logic.test.ts), [mocked service tests](../backend/src/features/access/access.service.test.ts). Platform admins bypass membership checks. |
| ACCESS-03 | Implemented | Staff mutations enforce role limits and final-manager guard, write audit within the transaction, and notify after commit. Invitations hash tokens and check email, expiry, store, role conflict, and used/revoked state. [Staff service](../backend/src/features/staff/staff.service.ts). | [Staff tests](../backend/src/features/staff/staff.service.test.ts): injected repository, audit, delivery, clock/notifier; no live constraint/transaction test. |
| ACCESS-04 | Limitation | Default production invitation delivery is explicitly unavailable. Membership-change socket eviction uses the local process adapter. [Delivery](../backend/src/features/staff/staff.invitation-delivery.ts), [notifier](../backend/src/features/staff/staff.realtime.ts), [room eviction](../backend/src/features/realtime/realtime-rooms.ts): `evictUserSockets`. | Source and mocked socket tests. Do not imply configured production email delivery or cross-process revocation. |
| RT-01 | Implemented | Socket handshake authenticates the bearer token and derives rooms from current memberships; no client-selected `joinRoom` handler exists in current bootstrap. [Socket auth](../backend/src/features/realtime/realtime-auth.ts), [room derivation](../backend/src/features/realtime/realtime-rooms.ts). | [Realtime tests](../backend/src/features/realtime/realtime-rooms.test.ts): pure room mapping and mocked sockets/auth. Not actual transport or event delivery tests. |
| RT-02 | Limitation | COD routes emit after commit. Payment finalization results omit store/user IDs expected by some route audience code: verification can use the caller's user ID, webhook/admin reconciliation fall back to platform-admin. CLI reconciliation emits no socket events. [Order routes](../backend/src/features/order/order.routes.ts), payment routes, webhook routes, reconciliation return shapes. | Source tracing. Room-mapping unit examples do not verify these actual route payloads. No outbox or durable retry delivery was found. |

## Request and transaction map for C04/C05

For the actual COD `POST /api/v1/order` endpoint:

```text
URL-encoded/JSON parsing -> CORS -> HTTP logging -> main router
-> authenticateUser (JWT + current DB principal)
-> validateBody(createOrderSchema)
-> OrderService.createOrder transaction:
   cart row lock -> load cart/store -> verify hours/address/delivery zone
   -> check catalogue/manual availability -> ascending stock locks
   -> read reserved totals / validate aggregate demand
   -> optional coupon row lock / capacity validation
   -> COD pending payment -> pending order/item/customization price snapshot
   -> tracked stock deduction + sale ledger -> coupon consumed
   -> clear cart -> commit
-> route emits orderPlaced / applicable lowStock -> JSON response
```

There is no staff store-permission middleware on customer COD checkout; ownership and delivery eligibility are validated in the quote. Do not insert a generic store guard into this particular sequence. Staff order updates follow their own permission check. The webhook is a separate route mounted before normal parsers/CORS/HTTP logging, using its own raw-body middleware.

For online initiation:

1. Look up the client request ID. An existing same-user attempt is reused.
2. Commit local quote, pending payment, awaiting-payment order, tracked stock/coupon reservations, and cart clearing together.
3. Claim provider-order creation under a payment row lock in a separate transaction.
4. Call provider `createOrder` outside DB transactions.
5. Validate returned amount/currency/status; attach provider order under payment lock in another transaction.
6. On provider creation failure, mark payment failed and release stock/coupon reservations locally. If provider creation succeeded but attachment failed, log identifiers and rely on later receipt recovery. An external success is not undone by database rollback.

Capture fetches provider state before opening its finalization transaction. The transaction locks order/payment, checks payable state and duplicate payment identity, consumes inventory, completes payment, moves order to pending, and consumes coupon. Events are emitted by the calling route after return, not by the finalizer itself.

## Current order state map

```text
Online creation -> awaiting_payment -> pending -> preparing -> delievered
COD creation ------------------------> pending
awaiting_payment / pending / preparing -> cancelled
delievered and cancelled have no outgoing transitions
same-state requests are no-ops
```

Display “Delivered” in prose, retaining `delievered` only when describing persisted identifiers. The transition helper is not the sole business rule: payment finalization separately requires `awaiting_payment`; staff status updates use the transition helper and permission check.

## Cancellation and failure matrix for C05

Source: `OrderService.updateOrderStatus`, inventory `restoreStockForOrder`/`releaseReservations`, checkout `releaseCouponReservation`, reconciliation failure/expiry paths.

| Trigger / prior state | Inventory result | Coupon result | Payment / order result |
| --- | --- | --- | --- |
| Authorized status cancellation of awaiting-payment online order | Reserved rows released; normally no sale to restore | Only reserved redemption released | Order cancelled; payment status is not changed by status cancellation; no provider refund call |
| Authorized cancellation of pending/preparing COD order | Restore recorded sales once when stock remains tracked; append cancellation movement | Consumed redemption/count remain consumed | Order cancelled; COD pending payment remains pending |
| Authorized cancellation of pending/preparing paid online order | Restore recorded sales once when stock remains tracked; consumed reservations remain consumed | Consumed redemption/count remain consumed | Order cancelled; completed payment remains completed; no automatic refund |
| Repeated same cancelled status | Early return, no additional restoration | No additional action | No-op |
| Delivered-to-cancelled request | Transition rejected before restoration | No change | No change |
| Provider order creation failure | Active reservations released | Reserved redemption released | Payment failed; order remains awaiting_payment; cart already cleared |
| Confirmed failed provider payment on awaiting-payment order | Active reservations released | Reserved redemption released | Payment failed; order remains awaiting_payment |
| Safe expiry of awaiting-payment order | Active reservations released | Reserved redemption released | Order cancelled; pending/processing payment becomes failed; already-failed payment keeps its status |

Closing the browser payment modal alone does not call the order cancellation service. It leaves the local attempt for later handling. Do not equate modal dismissal with stock release or refund.

No refund operation is exposed by the reviewed gateway. A `refunded` status in types and guard branches is not evidence of an implemented refund workflow. Consumed coupon uses are not reversed by `releaseCouponReservation`, which filters only `reserved` rows.

## Expiry and late-capture matrix for C06/C08

| Condition | Current handling |
| --- | --- |
| Deadline passed, row still reserved | Still counted in active reserved stock; deadline alone does not release it |
| Capture confirmed before cleanup changes row state | Finalization can consume the still-reserved row even after its deadline |
| Payment completed/refunded during expiry scan | Candidate skipped |
| Processing payment without attached provider order | Reservation preserved as conflict for payment recovery |
| Attached provider order but config/fetch unavailable | Reservation preserved; error recorded |
| Captured payment and paid provider order | Reconcile and finalize subject to exact provider/local validation |
| Authorized/captured payment with unsafe/ambiguous order state, or paid order without returned payment | Preserve reservation as conflict |
| No unsafe provider state and local order still awaiting_payment | Lock/recheck local order/payment, cancel order, release stock/coupon reservations |
| Released reservation, order still awaiting_payment, later capture | `INVENTORY_RESERVATIONS_RELEASED`; finalization transaction fails |
| Order already cancelled by expiry/cancellation, later capture | `PAYMENT_ORDER_NOT_PAYABLE`; no automatic reallocation or refund |
| Failed attempt retried through service | Coupon/payment can reactivate but inventory reservation is not restored; do not animate successful recovery as current behavior |

Additional limits: expiry discovers candidates from existing tracked reservation rows, so an all-untracked-stock order is not covered by this scan. The expiry worker checks provider state before a local transaction; provider activity can change afterward. Its `released` counter can include a no-op when a rechecked order is no longer awaiting payment. Its CLI sets failure exit status on `errors`, not `conflicts`; operators must inspect conflict counts too.

Safe simulator scope: show one tracked item, serialized reservation allocation, one successful consumption, and explicit release/expiry paths. A second customer previously rejected for unavailable stock needs a new checkout attempt after release. Model late capture as the actual conflict above, not automatic refund or successful retry. Label all interaction a teaching simulation, not a live locking test.

## Lock-order audit

| Path | Observed order / lock behavior |
| --- | --- |
| COD/online quote | Cart row -> ascending store-product rows -> optional coupon row; new order/payment and reservations are inserted later |
| Capture finalization | Joined order/payment `FOR UPDATE` -> ascending store-product IDs -> ascending active reservation IDs -> stock/movement writes -> coupon redemption and coupon update |
| Reservation release | Bulk `UPDATE` of reserved rows; no explicit ascending order or stock lock |
| Cancellation restoration | Order locked by caller -> release reserved rows -> read sales/cancellations -> ascending stock locks -> restore/write cancellation movement |
| Safe expiry | Explicit order lock -> payment lock -> update order/payment -> release reservations -> release coupon |
| Staff restock/adjustment | Permission check with membership lock for non-admin -> stock lock(s); adjustment reads reservation totals before writing; audit shares transaction |
| Payment retry / provider creation claim | Payment lock -> possible coupon redemption/coupon locks; no inventory reacquisition |

This contradicts the original broad claim that every stock/reservation mutation takes the same global lock sequence. It does not itself prove an exploitable deadlock: owning-row serialization and row states also matter. Any global deadlock claim requires a complete cross-path analysis and real transaction tests. Keep the defensible narrower claim: several allocation/consumption/restoration helpers explicitly sort stock locks.

Manual availability checks occur before stock locks in the quote; do not describe all catalogue/availability checks as protected by those later locks without further analysis.

## Test baseline

Executed on the source revision above before documentation edits. Installed dependencies were reused; no install, migration, seed, provider call, or reconciliation command was deliberately run.

| Command | Result |
| --- | --- |
| `pnpm.cmd --dir frontend run lint` | Passed outside sandbox: 0 errors, 3 existing Fast Refresh warnings in query provider, profile sidebar, and order status |
| `pnpm.cmd run build` from `frontend/` | Failed outside sandbox: TS2353 at `src/features/inventory/model/inventory.schemas.ts:4`, `invalid_type_error` not accepted by resolved Zod types |
| `pnpm.cmd --dir backend run typecheck` | Passed outside sandbox |
| `pnpm.cmd --dir backend run test` | 19 files passed, 1 failed; 200 tests passed, 1 failed out of 201 |
| `pnpm.cmd run build` from `backend/` | Passed outside sandbox |

Initial sandbox attempts could not access installed TypeScript/Vitest files (EPERM), and lint could not resolve `debug`; approved retries outside the sandbox produced the results above. No source or dependency files were changed to obtain these results.

Frontend diagnostic: the frontend manifest declares Zod `^3.24.2`, its lockfile records `3.24.2`, but the local `frontend/node_modules/zod/package.json` reports `4.5.4`. This is an observed installation mismatch, not a reason to migrate schema code in C01. Vite bundling did not run past TypeScript, so no bundle baseline is claimed.

Backend diagnostic: `payment.service.inventory.test.ts` test “reserves stock for tracked products without decrementing on-hand quantity” mocks several services but not the initial `PaymentRepository.getAttemptByClientRequestId` lookup or surrounding DB transaction. It reached the configured database and failed on a SELECT with `column orders.total_price does not exist`, before its initiation assertions. This is accidental database coupling, not an isolated integration test. No migration was applied, the failing test was not retried, and no intentional data mutation was performed by this audit. Isolate this test before future full-suite runs against shared configuration.

Per owner direction, these failures are recorded and deferred to the parallel financial workstream, not blockers to completing this evidence audit. C02 and later agents should preserve the record and re-baseline after that work is integrated.

## Test classification and missing proof

- Pure logic/schema: inventory arithmetic/demand, order transitions, access policy, request schemas, seed argument parsing.
- Mocked services/repositories: checkout/order/inventory operations, staff management/audit, access enforcement, dashboard/store/product behavior. They establish orchestration and policy, not actual SQL isolation or rollback.
- Mixed JWT and mocked identity loading: auth tests validate token behavior without live authenticated HTTP requests.
- Pure room mappings/mocked sockets: realtime tests do not prove actual event routing, transport, or multi-process revocation.
- Payment inventory suite: mostly mocked orchestration, with the failing accidental DB dependency noted above.
- No dedicated disposable-database concurrency suite, browser test harness, executed two-store security matrix, or provider sandbox session established in C01.

Historical passing counts in earlier runbooks describe their original dates; they are not the current baseline. Test source links remain useful even when this baseline is not all green, provided the public wording preserves the distinction.

## Publication and next-agent handoff

- C02: isolate `App` socket/chat/modal effects for exact `/docs` route segment and descendants; verify existing-token navigation and return to business routes.
- C04: use ARCH claims and the real COD middleware sequence; Socket.IO belongs to the application process, not an external service box.
- C05: re-audit ORDER/PAY/RT after financial work integrates; use cancellation matrix, price-only snapshot limits, and actual route registration.
- C06/C08: use INV/REC claims and late-capture conflict policy. No global deadlock-proof or automatic retry/refund claim.
- C07: use the baseline with test categories and explicit absent scheduling/delivery evidence; do not copy historical “all tests passed” claims forward.
- Repository URL, deployed URL/topology, measured performance, personal contribution, and historical decision motives remain unverified inputs. They do not block local docs implementation.
- Future database/financial fixes, dependency repair, route wiring, scheduler infrastructure, durable events, and production invitation delivery are separate work. C01 changes documentation only.
