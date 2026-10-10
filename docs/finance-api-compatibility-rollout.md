# Finance API and compatibility policy

Reviewed on 10 October 2026. This document describes implemented contracts; the completed rollout plan and legacy target DTOs have been retired. The exact mounted endpoint list is in [API reference](api-reference.md). Relevant [lifecycle contracts](finance-lifecycle-contracts.md) and [ADRs](adr/README.md) explain semantics.

## Authoritative amounts and dates

Bounded transaction values are integer-paise JSON numbers. Report/ledger aggregate values use canonical decimal strings; clients must not coerce them through unsafe floating-point arithmetic. Rates use basis points. Quotes, saved orders, refund allocations and source events retain inclusive totals and included-tax breakdowns.

New checkout quotes use quote version `2026-10-10-01` and pricing policy v5. The [promotion contract](promotions-contract.md) contains the current DTO, including separate item, delivery and bundle savings. The old scalar coupon preview API and retired coupon persistence are absent. Existing saved financial snapshots keep their own versions and prices.

Canonical order statuses are `awaiting_payment`, `pending`, `preparing`, `out_for_delivery`, `delivered`, `cancelled`. The legacy misspelling is not a supported request identifier. COD creation only accepts cash; online initiation is a separate payment endpoint. Stored payment summary status and normalized attempt status are distinct.

Finance reports accept inclusive `from` and `to` business-date values, optional `storeId`, and `groupBy` values `month`, `quarter` or `fiscal_year`. Use the exact [report schema](../backend/src/features/finance-reports/finance-report.schemas.ts). Omitted store scope requires platform authority for consolidated reports; a store member must supply an authorized store. Report dates use saved financial business dates; promotion analytics instead uses order pricing business dates. The operational dashboard retains its own date/filter contract and is not a ledger-backed P&L.

## Domain APIs

| Domain | Implemented API scope | Contract source |
| --- | --- | --- |
| Reports and exports | Overview, P&L, sales, margins and shared-policy CSV; grouped/comparison results and journal drill-down | [Report routes](../backend/src/features/finance-reports/finance-report.routes.ts), [schemas](../backend/src/features/finance-reports/finance-report.schemas.ts) |
| Ledger and periods | Accounts, journal list/detail, trial balance, periods, balanced manual posting/reversal, owner open/soft-close/close/reopen | [Ledger routes](../backend/src/features/ledger/ledger.routes.ts), [policy](../backend/src/features/ledger/ledger.policy.ts) |
| Refunds | Exact item/delivery allocations, request/approval/rejection, failed retry, stale reconciliation | [Refund routes](../backend/src/features/refunds/refund.routes.ts), [schemas](../backend/src/features/refunds/refund.schemas.ts) |
| Settlements | Import, deterministic matching, details and reconciliation issue resolution | [Settlement routes](../backend/src/features/settlements/settlement.routes.ts), [schemas](../backend/src/features/settlements/settlement.schemas.ts) |
| Cash | Daily sessions, movements, close with counted evidence and controlled reopen | [Cash routes](../backend/src/features/cash-management/cash.routes.ts), [schemas](../backend/src/features/cash-management/cash.schemas.ts) |
| Costs and suppliers | Effective standard-cost versions, vendors and expense categories | [Cost routes](../backend/src/features/costs/cost.routes.ts), [vendor routes](../backend/src/features/vendors/vendor.routes.ts) |
| Expenses | Draft/revision, allocations, private attachments, submit/approve/reject/pay/post/void/reverse and source operating views | [Expense routes](../backend/src/features/expenses/expense.routes.ts), [schemas](../backend/src/features/expenses/expense.schemas.ts) |
| Payroll | Restricted profiles/compensation, monthly pay runs, calculate/approve/pay/post/void/reverse, exports/statements | [Payroll routes](../backend/src/features/payroll/payroll.routes.ts), [pay-run schemas](../backend/src/features/payroll/pay-run.schemas.ts) |

Most finance routers authenticate at router level and enforce permissions in services. The table does not imply every endpoint shares one permission. An authorized route derives saved resource scope before mutation and uses stable denial/state/idempotency errors.

## Permissions and actor separation

[access.permissions.ts](../backend/src/features/access/access.permissions.ts) is the source of permission strings; [staff authorization](store-staff-authorization.md) has the role matrix.

- Platform admins can access consolidated reports and owner-only period controls. Period changes and supported high-risk actions require recent authentication/reasons as defined by their services.
- Managers have assigned-store reports, threshold-limited refund/expense approval, cash and costs, but no ledger posting, period close or payroll access.
- Finance managers have assigned-store finance, reconciliation, ledger and expense payment/posting, but no period close or payroll access.
- Operators can request refunds and manage supported cash operations alongside fulfillment. Inventory staff have inventory and read-only standard-cost access.
- Payroll managers have only the five payroll permissions in assigned stores. Finance reporting also requires payroll permission to expose sensitive derived totals; unauthorized payroll cost/result aggregates are null, not invented zeroes.

Permission is not sufficient when actor separation applies. Expense creators cannot approve their own expense; paying as creator/approver needs the specifically supported admin override evidence. Payroll drafting/calculation, approval and payment use distinct eligible actors. See [operations](finance-operations-runbook.md) and [payroll scope](payroll-demo-scope.md) before demonstrating transitions.

## Retry, errors and client behavior

Use a fresh UUID idempotency key per finance command and reuse it for an uncertain-response retry with unchanged meaning. Online initiation uses `clientRequestId`; payment retry restores the saved order contract, not a fresh cart quote. Domain schemas enforce supported bodies; do not reuse old rollout examples with different field names.

Handle stable codes, not message substrings. Important families include permission/segregation denial, invalid state transition, idempotency conflict, provider mismatch, stock/capacity conflict, pricing-rule overlap/missing rule, journal imbalance and closed-period posting rejection. The exact codes remain next to service policies and schema tests.

After a failure, preserve source identities and reconcile the original operation rather than creating another financial object. Client queries include principal/store scope and propagate cancellation; change store/account without showing another principal's placeholders.

## Scope

The supplied system has no invoice API, live provider processing, statutory tax/payroll workflow, accounts-payable subledger, bank feed or deployment scheduler. Backwards-compatible stored-data upgrades were not established; use the checked-in migration chain for fresh disposable databases. Legacy presentation fields do not replace canonical paise amounts.
