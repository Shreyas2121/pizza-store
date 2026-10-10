# Engineering evidence

Reviewed on 10 October 2026 against the working tree based on commit `379ae802767eb8507407bb5c999855de361a59f6`, including existing uncommitted recruiter-demo and architecture work. This document replaces the earlier implementation-slice audit. [Verification](case-study-verification.md) records executed checks; the table below distinguishes implementation from proof of runtime/concurrency behavior.

## Architecture and checkout

| Claim | Source and relevant tests | Supported scope |
| --- | --- | --- |
| ARCH-01: modular monolith | [Bootstrap](../backend/src/index.ts), [route mounts](../backend/src/routes.ts) | HTTP/Socket.IO share a process; PostgreSQL owns persistent state; posting is separately invoked. No deployed topology established. |
| ARCH-02: feature routing and state | [Router](../frontend/src/app/router/routes.tsx), [App](../frontend/src/app/app.tsx) | Lazy business/docs pages, public docs effect isolation, Query/Zustand separation. No current browser session. |
| ORDER-01: transactional COD | [Order service](../backend/src/features/order/order.service.ts), [tests](../backend/src/features/order/order.service.test.ts), [snapshot writer](../backend/src/features/checkout/checkout-snapshot.service.ts) | Order/payment, saved quote, stock and promotion effects share the transaction. Tests use injected/mocked orchestration. |
| ORDER-02: fulfillment/cancellation | [Transition map](../backend/src/features/order/order.logic.ts), [service tests](../backend/src/features/order/order.service.test.ts) | Canonical dispatch/delivery states; cancellation restores recorded tracked sales once and leaves refund handling separate. No live race evidence. |
| ORDER-03: history snapshots | [Mapper](../backend/src/features/order/order.mapper.ts), [tests](../backend/src/features/order/order.mapper.test.ts) | Saved product/customization/promotion/bundle names and prices survive current definition edits. Images/address can remain references. |
| MONEY-01: exact pricing v5 | [Pricing service](../backend/src/features/pricing/pricing.service.ts), [tests](../backend/src/features/pricing/pricing.service.test.ts), [money helpers](../backend/src/utils/money.ts) | Integer paise, included tax, threshold before promotion resolution, deterministic savings. Not statutory tax evidence. |

## Payments and recovery

| Claim | Source and relevant tests | Supported scope |
| --- | --- | --- |
| PAY-01: split local/provider initiation | [Payment service](../backend/src/features/payments/payment.service.ts), [inventory tests](../backend/src/features/payments/payment.service.inventory.test.ts) | Local transaction precedes external provider creation and later attachment. SQL cannot undo provider success. Current suite passes; no provider session. |
| PAY-02: request/provider identity | [Payment schema](../backend/src/db/schema/payment.schema.ts), [attempt schema](../backend/src/db/schema/payment-attempt.schema.ts) | Local request and provider uniqueness plus service ownership checks. Does not prove provider-side exactly-once creation. |
| PAY-03: verify authoritative state | [Verification](../backend/src/features/payments/payment-verification.service.ts) | Signature/ownership, identity, amount/currency and captured/paid state before finalization. |
| PAY-04: idempotent capture | [Finalizer](../backend/src/features/payments/payment-finalization.service.ts), [tests](../backend/src/features/payments/payment.service.inventory.test.ts) | Locked order/payment, saved inventory/promotions, financial event and same-provider-payment replay guard. No callback/webhook race test. |
| PAY-05: raw webhook claims | [Webhook](../backend/src/features/payments/razorpay.webhook.ts), [route tests](../backend/src/features/payments/payment.webhook.routes.test.ts) | Signature over raw bytes, claim/reclaim and duplicate-event suppression. Claim/finalization/acknowledgment/emit are separate boundaries. |
| PAY-06: mounted retry and saved-price recovery | [Routes](../backend/src/features/payments/payment.routes.ts), [service](../backend/src/features/payments/payment.service.ts), [promotion tests](../backend/src/features/payments/payment-promotions.service.test.ts) | Method/retry routes exist. Original inventory and promotion holds restore atomically when stock/capacity allow; cancelled orders do not revive. |
| REC-01: provider-aware expiry | [Reconciliation facade](../backend/src/features/payments/payment-reconciliation.service.ts), [inventory tests](../backend/src/features/payments/payment.service.inventory.test.ts) | Deadlines need a command; provider uncertainty preserves holds; attempt deadlines cover all-untracked orders. No live expiry/capture race. |
| REC-02: receipt recovery | [Stale recovery](../backend/src/features/payments/payment-stale-recovery.service.ts), [provider attachment](../backend/src/features/payments/payment-provider-order-recovery.service.ts) | Recover a compatible unattached provider order while preserving saved amount/state. Receipt matches are not a provider exactly-once guarantee. |
| REC-03: one-shot operations | [Backend scripts](../backend/package.json) | Payment/reservation batches and posting commands exist. Startup does not schedule them; operational commands were not run by this audit. |

## Inventory, access and realtime

| Claim | Source and relevant tests | Supported scope |
| --- | --- | --- |
| INV-01: inventory arithmetic | [Logic](../backend/src/features/inventory/inventory.logic.ts), [tests](../backend/src/features/inventory/inventory.logic.test.ts) | Tracked/untracked availability, aggregate demand and insufficient-stock policy. |
| INV-02: ordered stock locks | [Inventory service](../backend/src/features/inventory/inventory.service.ts), [tests](../backend/src/features/inventory/inventory.service.test.ts) | Several helpers explicitly sort lock acquisition. Tests inspect query/orchestration; no two-connection contention. |
| INV-03: reservations and restoration | [Service](../backend/src/features/inventory/inventory.service.ts), [retry tests](../backend/src/features/inventory/inventory-retry.service.test.ts) | Create/consume/release/restore saved demand; untracked consumption closes the saved hold without a stock movement. |
| INV-04: cross-path ordering limit | [Service](../backend/src/features/inventory/inventory.service.ts), [ADR-006](adr/0006-promotion-resolution-eligibility-and-governance.md) | Stable collection ordering with distinct owning-row/membership dependencies; no global deadlock-free claim. |
| INV-05: movement invariants | [Schema](../backend/src/db/schema/inventory.schema.ts), [service tests](../backend/src/features/inventory/inventory.service.test.ts) | Arithmetic/nonnegative checks and idempotent sale/cancellation identities. Maintenance reset can truncate history. |
| INV-06: staff stock mutations | [Service](../backend/src/features/inventory/inventory.service.ts), [tests](../backend/src/features/inventory/inventory.service.test.ts) | Current permission, stock and audit share a transaction; adjustment below reserved quantity is rejected. |
| ACCESS-02: scoped role policy | [Permissions](../backend/src/features/access/access.permissions.ts), [tests](../backend/src/features/access/access.logic.test.ts) | Five store roles plus platform admin; manager-only promotion participation exception. No live two-store browser/security matrix. |
| ACCESS-03: staff lifecycle | [Staff service](../backend/src/features/staff/staff.service.ts), [tests](../backend/src/features/staff/staff.service.test.ts) | Final-manager guard, current role limits, hashed invitation identity and audit composition. |
| ACCESS-04: delivery/revocation limits | [Notifier](../backend/src/features/staff/staff.realtime.ts), [invitation delivery](../backend/src/features/staff/staff.invitation-delivery.ts) | Local-adapter socket eviction; production invitation adapter intentionally unavailable. |
| RT-01: server-derived rooms | [Rooms](../backend/src/features/realtime/realtime-rooms.ts), [tests](../backend/src/features/realtime/realtime-rooms.test.ts) | Authenticated audience derivation; no arbitrary client-selected rooms. Mocked transport evidence. |
| RT-02: post-commit notification limits | [Payment routes](../backend/src/features/payments/payment.routes.ts), [finalizer](../backend/src/features/payments/payment-finalization.service.ts) | Some finalization results omit store/user audience context; HTTP/webhook callers can fall back to platform audiences. CLI recovery emits no sockets. Accounting outbox is separate. |
| OPS-01: request and financial diagnostics | [Request context](../backend/src/utils/request-context.ts), [logger](../backend/src/utils/logger.ts), [metrics route](../backend/src/features/observability/finance-metrics.routes.ts) | UUID request IDs, safe audit identities, local logs and protected metrics. No supplied centralized trace/log/retention stack. |

## Finance and isolated database evidence

The [posting dispatcher](../backend/src/features/ledger/commerce-posting.service.ts), [kernel](../backend/src/features/ledger/ledger.service.ts) and [SQL migration 0023](../backend/migrations/0023_balanced_posting_kernel.sql) implement delivery recognition, balanced draft/lines/post sequencing, idempotent source posting and immutable posted history. Reversals retain originals. Declared financial event types are not all supported by the current worker; see [the dispatch table](finance-lifecycle-contracts.md#posting-dispatch).

The [recruiter-demo test](../backend/src/scripts/recruiter-demo.test.ts) creates a disposable PGlite PostgreSQL engine, derives tables from current Drizzle declarations and applies the real posting-kernel migration. It checks rollback on incompatible preexisting data, all exported tables populated, foreign keys/check constraints, order and inventory totals, balanced journals, trigger rejection of line insertion into posted history, first-order customer, admin preservation, attachment files and idempotent repeat seed. It does not apply every historical migration or run concurrent server connections.

The offline fixture command compares 12 reports and 12 CSV exports across four store-months, plus six promotion journals in three two-store scenarios. It verifies production policy/projector behavior with supplied fixtures, not the configured database ledger.

## Test baseline

Current executed results and environment are in [verification](case-study-verification.md). Pure, mocked, query-construction and isolated database tests have different evidential scope. Earlier dependency mismatch and accidental configured-database test failures are no longer the current baseline; current typechecks, tests and builds pass.

## Remaining proof

No coordinated full PostgreSQL checkout/capture/cancellation/promotion races, complete migration-chain execution, current browser/provider session, actual-host refresh verification, production scheduler or measured report-latency benchmark was performed by this audit. [The inventory explorer](../frontend/src/features/docs/simulations/inventory-simulation.ts) is a deterministic teaching model; safe-expiry cancellation rejects subsequent capture because that order is terminal. Capture after release of a still-payable order follows the actual restore/conflict policy, not the explorer's cancelled-order scenario.
