# Documentation

Reviewed against the current working tree on 10 October 2026. Start with the overview, then follow the product flow into source and test evidence.

## For recruiters and interview preparation

| Read | Purpose |
| --- | --- |
| [High-level design](high-level-design.md) | Application boundaries and financial posting diagrams |
| [Demo walkthrough](demo-walkthrough.md) | Five-minute product and engineering tour |
| [Public case-study tour](case-study-walkthrough.md) | Two-minute tour of the backend-independent `/docs` pages |
| [Recruiter showcase data](recruiter-demo.md) | Seed prerequisites, personas, prepared history and operational caveats |
| [Engineering evidence](case-study-evidence.md) | Source-backed behavior, tests and known limits |
| [Verification record](case-study-verification.md) | Current automated results and remaining runtime checks |

## For development

| Read | Purpose |
| --- | --- |
| [Setup](setup.md) | Environment, workspace commands, migrations and demo choices |
| [Architecture](architecture.md) | Module boundaries, checkout, persistence, client state and realtime |
| [API reference](api-reference.md) | Mounted routes, middleware/schema entry points and core request examples |
| [Database schema](database-schema.md) | Every current table and column; database constraints and migration policy |
| [Decision records](adr/README.md) | Accepted money, recognition, ledger, tax, time, promotion, bundle and media rules |
| [Public docs authoring](public-docs.md) | Case-study routing, evidence links, diagrams and hosting |
| [Frontend](../frontend/README.md) / [Loading UI](../frontend/LOADING.md) | Frontend structure and loading conventions |
| [Client cache isolation](client-cache-isolation.md) | Account/store cache keys, cancellation and invalidation |

## For operations and finance

| Read | Purpose |
| --- | --- |
| [Finance workspace](finance-workspace.md) | Plain-language guide to finance tabs and amounts |
| [Finance lifecycle](finance-lifecycle-contracts.md) | Current state boundaries, event envelope and posting dispatch |
| [Finance API](finance-api-compatibility-rollout.md) | Canonical money/date/permission contracts and client compatibility |
| [Finance demo](finance-demo-walkthrough.md) / [Expected fixtures](two-store-financial-fixtures.md) | Fixed two-store scenario and hand-checkable totals |
| [Finance operations](finance-operations-runbook.md) | Outbox, reconciliation, corrections, periods, metrics and recovery |
| [Report performance](finance-report-performance.md) | Index rationale and unmeasured benchmark targets |
| [Staff authorization](store-staff-authorization.md) | Role matrix, invitations, lifecycle and security checks |
| [Store pricing setup](store-checkout-pricing.md) | Defaults, missing-rule initialization and pricing policy v5 |
| [Promotion contract](promotions-contract.md) / [Operations](promotions-operations.md) | Discovery, eligibility, governance, media, snapshots and finance |
| [Reservation recovery](payment-inventory-retry.md) | Saved inventory demand, retries and late capture |
| [Refund request](refund-request-walkthrough.md) | Separate item and delivery allocations |
| [Razorpay runbook](razorpay-runbook.md) / [Test credentials](razorpay-test-credentials.md) | Optional Test Mode configuration and recovery |
| [Payroll scope](payroll-demo-scope.md) | Restricted payroll calculations, privacy and correction limits |

Completed implementation handoffs and duplicate agent coaching plans have been removed. Durable behavior lives in these references; implementation chronology remains in Git history.
