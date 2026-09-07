# Financial Overhaul Remaining Fixes

This document tracks the remaining work identified by auditing `plan.md` against the current implementation on `feature/financial-overhaul`.

Out of scope for this checklist:

- CI workflows and badges
- PostgreSQL-backed integration and concurrency tests
- Frontend automated tests
- Database execution or migration verification in the current environment

## Priority 1 — Complete the exact-money cutover — Implemented

Implementation status: completed in the current working tree. Monetary catalogue, store-product, customization, coupon, and cart persistence now uses integer paise/basis points; checkout and cart totals render from the authoritative server quote; and migration `0028_tidy_power_pack.sql` removes the legacy float columns for fresh databases.

Phase 1 is not complete while financial values are stored or read as `real`, `doublePrecision`, or unvalidated rupee floats.

### Required changes

- Replace monetary float columns in the catalogue, store-product, customization, coupon, and cart schemas with integer-paise columns.
- Update repositories, DTOs, fixtures, seeds, and API serializers to use the new paise fields.
- Remove legacy monetary float columns and reads after all callers use paise.
- Remove the frontend cart and checkout fallback based on `cart.totalPrice` and `cart.totalPrice * 100`.
- Render totals from the authoritative versioned server quote. If no valid quote is available, show a loading or recoverable error state instead of calculating a browser total.
- Keep rupee conversion limited to presentation formatting.

### Acceptance criteria

- No financial schema column uses `real` or `doublePrecision`.
- No financial calculation multiplies a rupee float by 100 or converts paise through a floating-point persistence path.
- Cart, quote preview, and final checkout display the same server-calculated amounts.
- Existing exact-paise pricing and checkout tests continue to pass.

## Priority 2 — Seed the complete deterministic finance scenario — Implemented

Implementation status: completed in commit `b6eac91`. The local-only demo reset now recreates the checked-in two-store, two-month scenario with traceable sources, processed events, balanced journals, stable source mappings, and customer/report expected totals.

The current demo reset creates configuration and master data but intentionally starts the ledger at zero. It does not reproduce the complete expected financial fixture required by the plan.

### Required changes

- Extend `pnpm demo:reset` to create the planned two-store, two-reporting-month scenario.
- Include at least:
  - a discounted order;
  - a partial refund;
  - a failed payment attempt;
  - a Razorpay settlement with fee and fee tax;
  - a COD session with variance;
  - an allocated expense;
  - a compensation change and payroll run;
  - a fiscal-period close;
  - source events and balanced journals for the scenario.
- Reuse the checked-in financial scenario fixture as the expected-results source rather than maintaining independent totals.
- Make reset output identify the seeded stores, reporting periods, important source IDs, and expected headline totals.
- Update the demo walkthrough so it can either inspect the seeded scenario immediately or reset and replay it deterministically.

### Acceptance criteria

- One command recreates the database content needed for the complete recruiter walkthrough.
- Repeated resets produce the same financial source data and expected totals.
- Store totals add up to consolidated totals for both reporting months.
- The seeded journals are balanced and traceable to their source records.
- Report and CSV totals can be compared with one checked-in expected-results fixture.

## Priority 3 — Finish Phase 5 report completeness — Implemented

Implementation status: completed in the current working tree. Aggregate report policy metadata now includes the latest successful settlement reconciliation for the selected scope (or `null`), the finance workspace exposes accessible metric definitions, and `pnpm finance:reconcile-fixture` reconciles overview, P&L, sales, margins, period series, and all CSV variants against the checked-in expected-results fixture.

The core ledger-backed reports, comparison periods, drill-down, CSV export, generated timestamp, stale state, and partial-data state exist. The remaining report metadata and presentation requirements should be completed.

### Required changes

- Add a `lastReconciledAt` value, with a clearly defined source and null behavior, to applicable report policy metadata.
- Display the last reconciliation time in the finance report status area.
- Add concise definition tooltips for important metrics, including recognized revenue, collections, refunds, COGS, gross profit, operating expenses, payroll cost, unsettled Razorpay, and cash variance.
- Ensure the tooltip definitions match the written metric formulas and inclusion/exclusion rules.
- Add a deterministic reconciliation command or unit-level harness that calculates every report and CSV result from the checked-in financial fixture and compares it with the expected-results file.
- Retain the existing single report service/query path for both screen and CSV output.

### Acceptance criteria

- Every aggregate response includes currency, timezone, date basis, recognition basis, included journal statuses, generated time, scope, comparison period where relevant, and last-reconciliation metadata where applicable.
- Users can inspect the definition of every headline KPI in the UI.
- The checked-in fixture reconciles to overview, P&L, sales, margin, and CSV values without manually duplicating expected totals.

## Priority 4 — Record and verify the report performance result

The report index and benchmark SQL exist, but the performance document explicitly records that the representative workload was not executed.

### Required changes

- Run the checked-in benchmark on a representative two-store database containing at least twelve months of journal history when a database environment is available.
- Capture the before/after JSON query plans and observed timings as release evidence.
- Confirm the ledger-movement query stays within the documented 250 ms target and the HTTP report stays within the 500 ms target.
- Confirm that the added report index does not create an unacceptable journal-write regression.
- Update `docs/finance-report-performance.md` with the measured environment, dataset shape, results, and decision.

### Acceptance criteria

- The Phase 5 performance gate is supported by recorded measurements rather than an unverified target.
- Any failure against the target has a documented remediation or an explicitly revised budget and rationale.

## Priority 5 — Close the payroll aggregate privacy gap

**Status: Implemented in the working tree.** Finance reports now require explicit `payroll.read` in addition to the report permission before returning exact payroll employer cost. Restricted current, comparison, grouped, drill-down, and CSV representations suppress both payroll cost and the payroll-derived operating result, with explicit response/export metadata and UI messaging. Platform administrators retain exact store and consolidated reporting.

Payroll profile, compensation, pay-run, statement, and export permissions are separated, but finance overview/P&L responses expose `payrollCostPaise` to users with general finance-report access. In a store with a very small payroll population, this may allow compensation inference.

### Required changes

- Define an explicit aggregate privacy policy for payroll employer cost.
- Apply a minimum cohort size, merge payroll into a broader operating-cost line for restricted viewers, or require a payroll-specific aggregate permission.
- Apply the same rule consistently to overview, P&L, period series, drill-down, and CSV exports.
- Ensure restricted responses do not reveal suppressed values through comparisons, subtraction, filters, or error behavior.
- Document that employer-cost aggregates may include earning, deduction, and employer-cost components and are not necessarily equal to take-home pay.

### Acceptance criteria

- A user without explicit payroll permission cannot infer an individual employee's compensation from aggregate reports or exports.
- Platform administrators and explicitly authorized payroll viewers retain the required employer-cost reporting.
- Suppression or masking behavior is consistent across current, prior-period, grouped, consolidated, and exported data.

## Priority 6 — Complete high-risk failure and denial auditing

Successful sensitive mutations generally write append-only audit records, while authorization denials are currently written only to structured logs. The plan requires high-risk success, failure, and denial audit events.

### Required changes

- Define safe audit actions for denied and failed high-risk operations.
- Persist denial events for refund, expense approval/payment, settlement resolution, fiscal-period administration, manual journals, compensation changes, and payroll calculation/approval/payment/posting.
- Persist terminal operational failures where they are relevant, without duplicating retry noise.
- Include actor ID, store ID when known, action, outcome, safe resource identifiers, request/correlation ID, timestamp, and a stable reason code.
- Never include bank details, PAN-like identifiers, compensation amounts, webhook secrets, signatures, or raw provider payloads.
- Preserve hidden-resource behavior: the client response must not reveal whether a cross-store resource exists even when a safe internal denial audit is recorded.

### Acceptance criteria

- Each high-risk success, meaningful failure, and access denial creates one safe append-only audit event.
- Audit failure does not silently permit a high-risk mutation that is required to be audited.
- Logs and audit metadata pass the existing sensitive-data redaction rules.

## Priority 7 — Add finance operational metrics

Structured logs and recovery runbooks exist, but runtime metrics for the finance workflows were not found.

### Required changes

- Add metrics for:
  - financial outbox age, retry count, and dead-letter count;
  - posting failures and duplicate-event suppression;
  - rejected unbalanced journal attempts;
  - pending and failed refunds by age;
  - unsettled captured amounts by age;
  - settlement match rate and variance;
  - open cash sessions and cash variance;
  - report duration and freshness;
  - closed-period posting attempts.
- Use bounded labels only. Do not use order IDs, payment IDs, employee IDs, emails, or other high-cardinality/sensitive values as metric labels.
- Document metric names, units, label sets, and the conditions operators should investigate.

### Acceptance criteria

- Every metric listed in `plan.md` has a concrete instrumentation point.
- Metrics expose counts, ages, durations, or paise values with documented units.
- Finance and payroll-sensitive data cannot be reconstructed from metric labels.

## Priority 8 — Finish operations and rollout documentation

### Required changes

- Add a dedicated procedure for correcting a posted expense through void/reversal and replacement.
- Add a dedicated procedure for correcting a posted payroll run through reversal and replacement.
- Include permissions, recent-authentication requirements, idempotency behavior, period-close considerations, audit evidence, and reconciliation steps in both procedures.
- Document the finance frontend rollout state. Either add the planned finance feature flag or record an explicit decision that the migration is complete and the transitional flag is no longer required.
- Ensure the limitations section links to payroll statutory scope, demo-tax scope, single-currency assumptions, provider limitations, and the remaining performance verification requirement.

### Acceptance criteria

- An operator can correct posted expense and payroll mistakes without editing immutable source or journal records.
- The old operational dashboard and new finance workspace have a documented compatibility and retirement policy.

## Optional — Phase 7 demo invoicing

Phase 7 remains optional and does not block completion of the core financial overhaul. If it is selected for implementation, it still requires:

- fictional owner-business/store tax profiles;
- HSN/SAC classifications and effective-dated tax rules;
- sequential invoice numbering by legal entity and financial year;
- immutable invoice snapshots;
- refund-linked credit notes;
- customer invoice download;
- tax-summary reporting;
- the permanent `Portfolio demo — not a statutory tax invoice` marking.

Do not describe the system as GST filing-ready, IRN-integrated, or statutorily compliant unless those capabilities are separately designed, reviewed, and implemented.

## Suggested implementation order

1. Exact-money schema and application cutover
2. Complete deterministic demo seed and expected-results reconciliation
3. Report metadata, definitions, and reconciliation harness
4. Payroll aggregate privacy policy
5. Failure/denial audit events
6. Operational metrics and runbook completion
7. Report performance verification when a representative database is available
8. Optional Phase 7 invoicing
