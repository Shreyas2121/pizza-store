# Payroll-lite demo scope, privacy, and limitations

## Purpose and boundary

Payroll-lite demonstrates store-scoped operating-cost controls: restricted employee finance profiles, effective-dated recurring compensation, deterministic monthly pay runs, separate approval/payment duties, immutable gross-to-net snapshots, balanced ledger posting, and exact reversal.

It is a portfolio demo, not a payroll bureau or statutory system. It does not calculate, advise on, file, or remit TDS, EPF, ESI, professional tax, labour-welfare contributions, income tax, or any other statutory obligation. The example deduction and employer-cost components are user-configured demo values, not official rates. Payslip-style statements are calculation evidence, not statutory payslips.

## Access and masking

- `payroll_manager` receives only `payroll.read`, `payroll.manage`, `payroll.calculate`, `payroll.approve`, and `payroll.pay` for assigned stores. General managers and finance managers receive no payroll access.
- Platform administrators can operate all stores. Every resource lookup still derives store scope from the stored record; guessed missing and cross-store IDs both return `404`.
- Calculate, approve, and pay require distinct actors. Approval cannot be performed by the drafter or calculator; payment cannot be performed by the drafter, calculator, or approver. High-risk lifecycle commands require recent authentication and an idempotency UUID.
- Bank-account and PAN-like identifiers are encrypted at rest with the dedicated payroll key. APIs expose only last-four masks. They never appear in pay-run snapshots, exports, statements, audit records, or financial events.
- Payment references are visible only in restricted pay-run detail. CSV exports, statements, audit metadata, logs, and ledger/outbox payloads record at most that a reference exists.
- The frontend hides payroll navigation without `payroll.read`, but backend authorization remains authoritative.
- Finance reports apply the same boundary to aggregates. Exact payroll employer cost requires the applicable finance-report permission plus `payroll.read`; platform administrators retain exact consolidated reporting. For other report viewers, payroll cost and the derived operating result are `null` in current totals, comparisons, grouped periods, and screen/CSV output, and payroll drill-down is unavailable. Employer-cost aggregates can include earning, deduction, and employer-cost components and are not necessarily take-home pay.
- Compensation-version creation and pay-run calculate/approve/pay/post commands persist safe request-correlated success, denial, and terminal-failure audit evidence. Attempt rows contain stable reason codes and safe profile/pay-run identifiers only; compensation amounts, payment references, bank/PAN-like data, signatures, secrets, and provider payloads are excluded. Cross-store and missing resource responses remain indistinguishable.

## Calculation and accounting

A pay run covers exactly one calendar month. Calculation includes employee profiles whose employment overlaps the period end and uses the compensation version effective on that date. It snapshots employee identity, compensation version, component labels/types, and exact integer-paise amounts. There is no attendance, overtime, leave, proration, retro-pay, or off-cycle calculation.

Posting a paid run enqueues `pay_run.posted.v1` in the same transaction as the `posted` state. The posting worker creates a balanced journal using Payroll Expense (`6200`), Payroll Payable (`2300`), Payroll Deductions Payable (`2310`), and Bank (`1010`). Posted runs cannot be edited or voided; correction requires `pay_run.reversed.v1`, which reverses the original journal exactly and leaves both journals visible.

## Retention and deletion

This demo intentionally has no per-employee payroll deletion endpoint. Finance profiles, compensation versions, pay-run snapshots, lifecycle command evidence, audit records, outbox events, and journals are retained for the lifetime of the demo database so historical statements and ledger totals remain reproducible. The development-only full demo reset is the only supplied purge mechanism and is not selective.

A production deployment must define a jurisdiction- and employer-specific retention schedule, legal holds, subject-request handling, encryption-key rotation, secure archival, and verified erasure process before collecting real employee data. This repository makes no claim that its demo retention model satisfies those requirements.

## Recruiter walkthrough

1. Sign in as a payroll manager and select an assigned store. Confirm the Payroll navigation is visible while Finance, orders, and inventory remain unavailable.
2. Open Compensation history and show two non-overlapping effective versions. Explain that a prior pay run keeps its original snapshot after a later version is added.
3. Create a complete calendar-month draft and calculate it. Open employee statements to reconcile earning lines minus deductions to net pay and gross plus employer costs to total employer cost.
4. Attempt approval with the drafter/calculator account and show the stable segregation error. Use separate recently authenticated actors to approve and mark the run paid with a payment reference.
5. Export the run and show that employee/component amounts are present for authorized reconciliation while bank/PAN-like identifiers and the payment reference are absent.
6. Post the paid run, drain the finance outbox, and drill into the ledger journal. Reconcile account `6200` to the pay-run employer cost and verify total debits equal total credits.
7. Reverse the posted run with a reason and effective business date. Show the linked opposite journal and unchanged historical pay-run snapshot.

Use fictional employees and identifiers only. Never enter real payroll, bank, tax, or government-registration data into the portfolio demo.
