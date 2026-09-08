# Finance operations runbook

This runbook covers the management-accounting features shipped through Phase 5. Amounts are integer paise, currency is INR, and business dates use each store's configured timezone. These reports are operational management reports, not statutory accounts or tax filings.

## Routine checks

Run these checks per store and then consolidated:

1. Confirm the financial outbox has no overdue `pending`, `failed`, `processing`, or `dead_letter` events.
2. Run the posting worker until `claimed` is zero: `pnpm --filter backend finance:post-events`.
3. Review Finance > Issues and resolve only after retaining evidence in the resolution note.
4. Confirm trial-balance `differencePaise` is `0` and `balanced` is `true`.
5. Compare the report period to its CSV export. Both call the same report service and must agree exactly.

Never repair a posted journal with SQL. Correct source state through its supported workflow or post an authorized reversal and replacement.

## Payment and settlement reconciliation

- The local simulator is the default and requires no provider credentials. Razorpay Test Mode is optional; live mode is rejected at startup.
- Run `pnpm --filter backend payments:reconcile` for stale attempts. A non-zero exit means at least one candidate needs investigation.
- Import a settlement from Finance > Settlements, then run deterministic matching. Re-importing identical content is idempotent; changed content under the same provider settlement ID is a conflict.
- Investigate amount, currency, duplicate, missing-local, missing-provider, unexpected-status, and stale-pending issues against the payment attempt/refund and provider evidence.
- Resolving an issue acknowledges evidence; it does not mutate payment, refund, settlement, or ledger amounts.

Escalate when provider evidence and local source truth disagree, an issue recurs after resolution, or a settlement journal does not reconcile to its matched lines.

## Refund recovery

1. Find the order and verify the maximum refundable amount and prior allocations.
2. Request the refund with a unique `Idempotency-Key`; allocations must exactly equal `amountPaise`.
3. A different actor approves or rejects when segregation-of-duties policy requires it.
4. For COD, confirm cash was actually returned before approval. For simulated online payments, provider submission is deterministic.
5. Use retry only for `failed` refunds. Use `POST /api/v1/finance/refunds/reconcile` for stale submitted/processing refunds.
6. Run the posting worker and verify the refund journal/drill-down.

Do not create a second refund to work around an uncertain provider result. Reconcile the original idempotent request.

## Financial outbox recovery

Writers store domain state and the outbox event in one transaction. Workers claim with `FOR UPDATE SKIP LOCKED`, retry with exponential backoff, and recover expired leases. Ten failed claims move an event to `dead_letter`; error text is sanitized.

- If a worker stops, restart it and rerun `finance:post-events`; processing is idempotent by source identity and version.
- If events remain `failed`, inspect `last_error`, source state, attempt count, and `available_at` before retrying.
- For `dead_letter`, fix the underlying data/code issue first. Do not reset attempts or edit payloads manually; replay through an audited maintenance change.
- After recovery, confirm source state, outbox status `processed`, one journal for the source version, and a balanced trial balance.

## Period close and reopen

Only a recently authenticated platform owner can open, soft-close, close, or reopen periods.

Before soft close: drain the outbox, reconcile payments/refunds/settlements, resolve or document open issues, post approved expenses, and verify the trial balance. Soft close blocks ordinary source postings; an owner may use an explicit audited override. Close only after review. Closed periods reject every posting. Reopen only with a documented correction reason, post the reversal/replacement, rerun reports, and close again.

## High-risk audit evidence

Every HTTP request receives a bounded `X-Request-ID` (a valid caller UUID is retained; otherwise the server generates one). Successful high-risk mutations write their existing lifecycle audit inside the business transaction, so an audit-write failure rolls the mutation back. Denied and failed attempts are written independently after the business transaction has failed, preserving evidence that would otherwise be rolled back. If this required attempt audit cannot be persisted, the request fails closed with `AUDIT_PERSISTENCE_FAILED`.

| Workflow | Denied/failed action prefix | Safe resource reference |
| --- | --- | --- |
| Refund request, approval, rejection, retry, stale reconciliation | `refund.request`, `refund.approve`, `refund.reject`, `refund.retry`, `refund.reconcile` | Requested order/refund ID, or a fixed stale-refund marker |
| Expense approval and payment | `expense.approve`, `expense.pay` | Requested expense ID |
| Settlement reconciliation and issue resolution | `settlement.reconcile`, `settlement.issue_resolve` | Requested batch or issue ID |
| Fiscal-period administration | `ledger.period_open`, `ledger.period_soft_close`, `ledger.period_close`, `ledger.period_reopen` | Requested period ID, or `new` |
| Manual journal posting and reversal | `ledger.manual_journal_post`, `ledger.manual_journal_reverse` | Requested journal ID, or `new` |
| Compensation version creation | `payroll.compensation_change` | Requested employee-finance-profile ID |
| Pay-run calculation, approval, payment, and posting | `payroll.pay_run_calculate`, `payroll.pay_run_approve`, `payroll.pay_run_pay`, `payroll.pay_run_post` | Requested pay-run ID |

The stored action appends `.denied` or `.failed`; `outcome` carries the same classification. Metadata contains only a stable `reasonCode`. Actor ID, store ID when present in the trusted request scope, request ID, resource type/reference, and database timestamp occupy dedicated columns. `RESOURCE_NOT_FOUND` remains a denied outcome with the same public `404` for missing and cross-store resources, so the audit does not alter hidden-resource behavior. Provider refund terminal failures use `outcome=failure`; internal outbox retries continue to use their bounded retry/dead-letter state and do not generate an audit row per retry.

Audit metadata redaction recursively removes passwords/tokens, bank details, PAN/tax identifiers, compensation and payroll amounts, payment references, secrets, signatures, and raw provider payloads. Do not add those values to action names, reason codes, resource identifiers, or request IDs.

## Migration deployment and recovery

1. Back up the database and record the current migration head.
2. Deploy application code that remains compatible with the existing schema.
3. Run `pnpm --filter backend db:migrate` once from a controlled release job.
4. Run backend tests/smoke checks, the posting worker, trial balance, and report/export reconciliation.

Drizzle migrations are forward-only. If a migration fails, stop application writes, retain the exact error and migration table state, restore the pre-migration backup when partial DDL cannot be safely completed, fix the migration in a new reviewed change, and rehearse against a restored copy. Do not delete migration journal rows or hand-edit an already-applied migration. The P5.6 index is non-semantic: if it causes unacceptable write cost, remove it in a new migration after capturing query plans.

## Backup and restore acceptance

A restore is acceptable only when migrations reach repository head, seeded/admin authentication works, pending outbox work drains, all posted journals remain balanced, reports equal exports for a known period, attachment storage references are valid, and no production credentials were copied into a demo environment.

## Current limitations

- Management reporting is single-currency INR and uses delivery recognition; it is not statutory bookkeeping, GST filing, an invoice system, or tax advice.
- Tax rules and HSN/SAC labels are visibly demo-only. No live Razorpay payments are supported.
- Standard product cost is not recipe/BOM costing. There is no purchase-order, accounts-payable, bank-feed, or inventory valuation subledger.
- Payroll-lite is a separate restricted workspace with demo-only compensation, pay-run statements, and reversible ledger posting. See [payroll-demo-scope.md](payroll-demo-scope.md). Invoice endpoints remain future optional Phase 7 work.
- CSV is a tall, machine-reconcilable export; values identify paise, basis points, or counts explicitly.
- Report freshness depends on draining the asynchronous financial outbox.
- The local demo reset is destructive, development-only, and refuses remote PostgreSQL hosts.
