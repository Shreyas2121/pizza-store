# Finance lifecycle and event contracts

Reviewed on 10 October 2026 against the [domain status types](../backend/src/utils/types.ts), services, [financial event envelope](../backend/src/features/finance-events/financial-event.types.ts) and [posting dispatcher](../backend/src/features/ledger/commerce-posting.service.ts). These are current boundaries, rather than a phased target implementation.

## State and business boundaries

| Aggregate | Implemented workflow / correction |
| --- | --- |
| Order | Online begins awaiting payment; COD begins pending. `pending → preparing → out_for_delivery → delivered`. Pre-delivery states can cancel; delivered/cancelled are terminal. Same-state status requests are no-ops. |
| Payment | Local summary uses pending/processing/completed/failed/refunded; normalized attempts have pending/processing/authorized/captured/failed/expired/cancelled/voided identifiers. Provider observations are separate. Retry can reactivate the existing saved attempt/provider order; it does not invariably append a new attempt. |
| Refund | Request/approve/reject and submission/reconciliation manage requested/approved/rejected/cancelled/submitted/processing/processed/failed records. Supported failed retry retains the refund identity. A status identifier alone does not establish a public endpoint for every theoretical transition. |
| Settlement | Import and match produce imported/reconciling/needs_review/reconciled. An identical provider identity/payload import is idempotent; a changed payload conflicts. Issue resolution records evidence and does not rewrite source money. |
| Cash session | Open daily drawer, append supported movements, counted close, authorized reopen retaining closure evidence. COD delivery requires the applicable collection/session policy. |
| Expense | Draft → submitted → approved → paid → posted; rejection is editable back to draft. Eligible pre-posting states can void; paid void requires payment-reversal evidence. Posted correction uses a linked reversal and a separately created replacement. |
| Pay run | Draft → calculated → approved → paid → posted. Draft/calculated/approved can void; paid cannot void. Posted correction reverses on an authorized open effective business date. There is one run snapshot per store/month; replacement accounting uses the documented aggregate corrective journal. |
| Journal / period | Insert draft and lines before posting. Posted lines/entries are protected by database triggers; reverse with opposite lines. Open → soft-closed → closed; owner-controlled reopen. Soft-closed allows source posting and restricts manual posting. |

Services add ownership, capacity, cash evidence, actor separation, recent-authentication, version and fiscal-period guards. Do not infer permitted commands solely from enum values. See [finance operations](finance-operations-runbook.md), [refund UI](refund-request-walkthrough.md) and [payroll scope](payroll-demo-scope.md).

## Payment and reservation recovery

The order transition map is in [order.logic.ts](../backend/src/features/order/order.logic.ts). Capture finalization additionally requires an awaiting-payment order and verified exact provider/local identity. It restores/consumes saved inventory and promotions atomically, completes payment and moves the order to pending. Duplicate completion with the same provider payment identity produces no second local effect; a different identity conflicts.

Confirmed failure releases holds while leaving the order awaiting payment. Customer retry restores original quantities and checks current promotion capacity, without recalculating eligibility/prices. Verified captured funds may bypass current promotion capacity, but never physical stock availability. Safe expiry cancels the order; cancellation does not resurrect on later capture and does not itself refund completed money.

Expiry discovery includes payment-attempt deadlines as well as tracked inventory reservations. Provider uncertainty or changed activity/identity preserves a hold. The default 30-minute deadline requires an explicit reconciliation run. See [payment recovery](payment-inventory-retry.md) and [promotion operations](promotions-operations.md).

## Financial event envelope

```ts
interface WriteFinancialEventInput {
  eventType: FinancialEventType;
  schemaVersion: number;
  sourceType: string;
  sourceId: number | string;
  sourceVersion: number;
  storeId: number;
  currency: "INR";
  occurredAt: Date;
  businessDate: string;
  timezone: string;
  actorId?: number | null;
  correlationId?: string | null;
  causationId?: string | null;
  payload: Record<string, unknown>;
}
```

The writer validates/canonicalizes the event, stores a payload hash and source identity/version, and prevents changed payloads under the same source identity. Event type and schemaVersion are separate fields; `order.delivered.v1` in prose means `eventType: "order.delivered", schemaVersion: 1`, not a dotted eventType wire value. Consumers use saved payloads rather than current catalogue/tax/compensation.

## Posting dispatch

| Event type | Current commerce-worker effect |
| --- | --- |
| `payment_attempt.captured` | Online collection into provider clearing/customer advances; COD capture uses cash on hand/customer advances |
| `order.delivered` | Delivery-based revenue, demo tax, discount and standard COGS |
| `order.recognition_reversed` | Exact linked recognition reversal |
| `refund.processed` | Before-delivery advances reversal or after-delivery contra-revenue/tax; credit refunds payable |
| `refund.disbursed` | Clear refunds payable against provider clearing or cash |
| `settlement.reconciled` | Clear provider gross into bank/fees/tax and mapped adjustments |
| `cash.movement_recorded` | Supported cash collection/deposit/adjustment policies; some movements have no separate journal |
| `cash.session_closed` | Non-zero counted variance posting |
| `cash.session_reopened` | Reverse the prior closure effect when present |
| `expense.posted` / `expense.reversed` | Paid expense posting / exact linked reversal |
| `pay_run.posted` / `pay_run.reversed` | Aggregate payroll posting / exact linked reversal |
| `refund.failed`, `expense.paid`, `expense.voided` | Acknowledged lifecycle evidence with no journal |
| `payment_attempt.failed`, `inventory.return_accepted` | Declared event types but absent from the current commerce worker's supported-event list; do not claim an implemented stock-return posting workflow |

Policy builders validate event type/version and source totals before posting. The current [dispatcher](../backend/src/features/ledger/commerce-posting.service.ts) is authoritative for worker support; declared event types alone do not establish execution.

## Outbox and journal recovery

Source mutation and its required financial event share a transaction. The worker claims only supported event types with a five-minute lease and bounded batches, processes each, then acknowledges separately. Ten failed claims reach dead-letter policy; retry availability uses backoff. If a journal commits before acknowledgment, source uniqueness lets the retry reuse it. Financial-event IDs, source keys, payload hashes and journal source uniqueness serve different roles.

The posting kernel verifies accounts, currency, store, date/period, line sides and balance; draft/lines/post sequencing satisfies [migration 0023](../backend/migrations/0023_balanced_posting_kernel.sql). Journal balance is enforced in SQL as well as policy. A source reversal retains the original and posts opposite lines. Effective correction-date rules vary by domain: payroll explicitly accepts an open effective date; expense reversal uses its existing source-date policy. Follow each operation's runbook.

## Lock ordering and evidence limits

Checkout stabilizes cart/user/store/catalogue/stock/promotions; existing-order payment lifecycle locks order/user/store/payment before saved inventory and promotion collections. Relevant catalogue/stock/promotion collections use stable ascending IDs. Staff membership and cancellation/release paths add their own dependencies. [ADR-006](adr/0006-promotion-resolution-eligibility-and-governance.md) documents the intended compatible ordering and catalogue refinement.

This is not a demonstrated global deadlock-free order. Mocked query/orchestration tests and a PGlite seed test do not replace coordinated multi-connection PostgreSQL checkout/capture/cancellation races. Realtime emits occur after commit and are outside the accounting outbox's replay guarantee. Current executed evidence is in [verification](case-study-verification.md).
