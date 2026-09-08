# Finance operations runbook

This runbook covers the management-accounting and payroll-lite features shipped through Phase 6. Amounts are integer paise, currency is INR, and business dates use each store's configured timezone. These reports are operational management reports, not statutory accounts or tax filings.

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

## Correct a voided or posted expense

Never edit the source row, allocations, outbox payload, or journal. Preserve the supplier/payment evidence and use one of these paths:

- An expense in `draft`, `submitted`, `approved`, `paid`, or `rejected` can be voided with `POST /api/v1/finance/expenses/:id/void`. This requires `finance.expenses.approve`. A paid expense also requires `paymentReversed: true` and a non-empty `reversalReference`; do not claim reversal until the external payment has actually been recovered. A `posted` expense cannot be voided.
- A `posted` expense must be reversed with `POST /api/v1/finance/expenses/:id/reverse`, permission `finance.expenses.pay`, and body `{ "reason": "..." }`. The resulting `expense.reversed.v1` event creates an exact opposite journal linked to the original.

For either path, send a new UUID `Idempotency-Key` for each command. Retrying the same action after an uncertain response must reuse the same key and identical payload meaning; the service returns the recorded result. Reusing a key for another expense, action, or payload returns `DUPLICATE_IDEMPOTENCY_KEY`. The expense lifecycle does not currently require step-up/recent authentication. If the original expense date is in a closed fiscal period, have a platform administrator reopen it before requesting reversal; period reopen requires authentication within 15 minutes and an explicit reason. Drain the reversal, then run the normal soft-close and close checks again.

Then create a replacement expense with a new idempotency key and the corrected date, vendor, description, totals, and allocations. Use the normal submit → approve → pay → post flow, with a new key per transition. The creator cannot approve; the creator or approver cannot pay unless a platform administrator supplies the supported audited override reason. Do not reuse the old payment reference unless it identifies the real replacement payment.

Retain and verify this evidence before declaring the correction complete:

1. The original expense is `voided` or `reversed`, its reason is visible, and the immutable original remains readable.
2. Audit history contains the void/reversal and replacement lifecycle actors and request IDs; command records contain the idempotency evidence.
3. For a posted correction, both `expense.reversed.v1` and the replacement `expense.posted.v1` reach `processed`; the original journal plus its linked reversal nets to zero.
4. The replacement journal matches its corrected allocations, the trial balance remains balanced, and the expense report and CSV agree.
5. If a period was reopened, rerun close checks, soft-close it, and close it again with correction-specific reasons.

## Correct a voided or posted payroll run

Do not change compensation or pay-run snapshots to rewrite history. Before posting, `draft`, `calculated`, or `approved` runs can be voided through `POST /api/v1/finance/payroll/pay-runs/:id/void` with `payroll.manage`, a new `Idempotency-Key`, and `{ "reason": "..." }`. A `paid` run cannot be voided: post it only after confirming the recorded payment evidence, then use the posted-run reversal below. Every payroll lifecycle command requires authentication within the preceding 15 minutes.

For a `posted` run:

1. A payroll-authorized reviewer with `payroll.pay` confirms the immutable employee/component snapshot, payment evidence, original posting journal, correction reason, and corrected aggregate schedule. Keep employee-level evidence only in the restricted payroll process.
2. Choose an `effectiveBusinessDate` in an open fiscal period. The original payroll period may remain closed; the correction date controls the reversal journal and retains a link to the original journal.
3. Call `POST /api/v1/finance/payroll/pay-runs/:id/reverse` with a new UUID `Idempotency-Key` and `{ "reason": "...", "effectiveBusinessDate": "YYYY-MM-DD" }`. Retry an uncertain response with the same key and identical payload. Reusing it with changed meaning returns `DUPLICATE_IDEMPOTENCY_KEY`.
4. Drain `pay_run.reversed.v1` and verify the exact linked reversal nets every original payroll account line to zero.
5. Post the corrected aggregate replacement through `POST /api/v1/finance/ledger/manual-journals` on an open business date. This requires `finance.ledger.post`, its own UUID idempotency key, a correction description referencing the reversed pay-run ID, and balanced lines using only aggregate values: debit Payroll Expense (`6200`) for corrected total employer cost; credit Payroll Payable (`2300`) for net pay and Payroll Deductions Payable (`2310`) for deductions plus employer cost; then debit `2300` and credit Bank (`1010`) for net pay already disbursed. A soft-close override is restricted to a recently authenticated platform administrator and must carry a reason; never post to a closed period.

The schema intentionally permits only one immutable pay-run snapshot per store/month, so the replacement is an aggregate corrective journal, not a second pay-run or replacement payslip. This corrects management accounts without fabricating revised statutory payroll evidence. If corrected employee statements are required, this demo is insufficient and the case must be handled outside it under the organization's payroll controls.

Confirm audit history contains `payroll.pay_run_reversed`, the request/actor/reason evidence, the original and reversal journal link, and `ledger.manual_journal_posted` for the replacement. Finally verify the reversal outbox event is `processed`, the replacement journal is balanced, account `6200` equals the approved corrected employer cost, liability/bank lines match the payment evidence, payroll-visible reports and their CSVs agree, and the trial balance difference is zero. Do not put employee names, bank details, PAN-like identifiers, payment references, or per-employee compensation into the manual journal description or metadata.

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

## Finance operational metrics

Scrape `GET /metrics` as Prometheus text. The endpoint performs read-only aggregate queries and returns `503` if collection fails, so a failed scrape is visible rather than publishing stale database gauges. Restrict this operational endpoint at the deployment ingress because metric values contain aggregate business amounts. Labels are deliberately limited to the fixed sets below; store, order, payment, refund, employee, email, provider-reference, and request identifiers are never labels.

Age buckets are `lt_1h`, `1h_24h`, `1d_7d`, and `gte_7d`. Outbox status, settlement match status, posting kind, event type, report type, scope, and outcome are closed application enums; unrecognized event types become `unknown`.

| Metric | Type / unit | Labels | Investigate when |
| --- | --- | --- | --- |
| `food_finance_outbox_events` | Gauge / events | `status` | `failed` or `dead_letter` is non-zero, or active work does not drain. This is the dead-letter count. |
| `food_finance_outbox_oldest_age_seconds` | Gauge / seconds | `status` | Pending/processing/failed age exceeds the normal worker interval; processed age is defined as zero. |
| `food_finance_outbox_retry_count` | Gauge / attempts | `status` | Attempts rise repeatedly or approach the ten-attempt dead-letter limit. |
| `food_finance_posting_failures_total` | Counter / failures | `event_type` | Any sustained increase; correlate with sanitized outbox errors. |
| `food_finance_duplicate_event_suppressions_total` | Counter / suppressions | `event_type` | A burst suggests webhook or worker replay; suppression itself is safe and idempotent. |
| `food_finance_unbalanced_journal_attempts_total` | Counter / rejected attempts | `posting_kind` | Any increase. Unbalanced journals must never be accepted. |
| `food_finance_refunds` | Gauge / refunds | `status`, `age_bucket` | Pending work ages into later buckets or failed refunds remain unresolved. |
| `food_finance_unsettled_captured_payments` | Gauge / payments | `age_bucket` | Captures remain without a matched payment settlement line beyond the provider settlement window. |
| `food_finance_unsettled_captured_amount_paise` | Gauge / integer paise | `age_bucket` | Old-bucket amounts persist or grow. Reconcile provider settlement evidence. |
| `food_finance_settlement_lines` | Gauge / lines | `match_status` | `unmatched` or `mismatch` remains after reconciliation. |
| `food_finance_settlement_match_ratio` | Gauge / ratio 0–1 | none | The ratio drops below the operator baseline; an empty set reports `1`. Ignored lines are excluded. |
| `food_finance_settlement_variance_paise` | Gauge / absolute integer paise | `match_status` | Non-zero unmatched/mismatch amounts persist. It is exposure by line status, not a signed net. |
| `food_finance_open_cash_sessions` | Gauge / sessions | none | Sessions remain open beyond the store's business day. |
| `food_finance_cash_variance_paise` | Gauge / signed integer paise | none | The active, non-reversed closure variance breaches local cash policy or trends consistently positive/negative. |
| `food_finance_report_duration_seconds` | Histogram / seconds | `report_type`, `scope`, `outcome`, `le` | Upper buckets or failures increase. Buckets are 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, and 10 seconds. |
| `food_finance_report_freshness_seconds` | Gauge / seconds | `report_type`, `scope` | Age exceeds the reconciliation objective. `-1` means the scope has never reconciled a settlement. |
| `food_finance_closed_period_posting_attempts_total` | Counter / rejected attempts | `posting_kind` | Any increase; inspect posting dates, delayed outbox work, and authorized correction workflow. |

Database gauges are rebuilt on every scrape. Process counters and report observations reset when the API process restarts; configure the metrics collector to retain counter history across restarts. Settlement match ratio is matched lines divided by matched, unmatched, and mismatch lines. Settlement variance sums absolute payment/refund/adjustment line amounts still marked unmatched or mismatch.

## Migration deployment and recovery

1. Back up the database and record the current migration head.
2. Deploy application code that remains compatible with the existing schema.
3. Run `pnpm --filter backend db:migrate` once from a controlled release job.
4. Run backend tests/smoke checks, the posting worker, trial balance, and report/export reconciliation.

Drizzle migrations are forward-only. If a migration fails, stop application writes, retain the exact error and migration table state, restore the pre-migration backup when partial DDL cannot be safely completed, fix the migration in a new reviewed change, and rehearse against a restored copy. Do not delete migration journal rows or hand-edit an already-applied migration. The P5.6 index is non-semantic: if it causes unacceptable write cost, remove it in a new migration after capturing query plans.

## Backup and restore acceptance

A restore is acceptable only when migrations reach repository head, seeded/admin authentication works, pending outbox work drains, all posted journals remain balanced, reports equal exports for a known period, attachment storage references are valid, and no production credentials were copied into a demo environment.

## Current limitations

- Management reporting uses the [single-currency INR and exact-money assumptions](adr/0001-money-representation-and-rounding.md) and delivery recognition; it is not statutory bookkeeping, GST filing, an invoice system, or tax advice.
- Tax rules and HSN/SAC labels follow the explicitly non-statutory [demo tax policy](adr/0004-tax-inclusive-demo-policy.md).
- Payment/refund behavior is limited to the local simulator or Razorpay Test Mode. Live processing is rejected; see the [provider modes and limitations](razorpay-runbook.md).
- Standard product cost is not recipe/BOM costing. There is no purchase-order, accounts-payable, bank-feed, or inventory valuation subledger.
- Payroll-lite is a separate restricted workspace with demo-only compensation, pay-run statements, and reversible ledger posting; its [statutory and privacy boundaries](payroll-demo-scope.md) exclude tax/contribution calculation, filing, and remittance. Invoice endpoints remain future optional Phase 7 work.
- CSV is a tall, machine-reconcilable export; values identify paise, basis points, or counts explicitly.
- Report freshness depends on draining the asynchronous financial outbox.
- The representative 12-month database benchmark remains a release gate. See the [report performance verification requirement](finance-report-performance.md); no production-scale latency claim is made until its plans and results are retained.
- The local demo reset is destructive, development-only, and refuses remote PostgreSQL hosts.
