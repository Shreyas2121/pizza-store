# Architecture decision records

Architecture decision records (ADRs) capture financial rules that code, migrations, APIs, reports, and tests must share. An accepted ADR remains in place; if a decision changes, add a superseding ADR rather than silently rewriting history.

| ADR | Decision | Status |
| --- | --- | --- |
| [ADR-001](0001-money-representation-and-rounding.md) | Money representation, limits, rounding, and allocation | Accepted |
| [ADR-002](0002-revenue-cogs-recognition-and-refunds.md) | Revenue/COGS recognition and refunds | Accepted |
| [ADR-003](0003-ledger-accounts-and-posting-rules.md) | Ledger accounts and posting rules | Accepted |
| [ADR-004](0004-tax-inclusive-demo-policy.md) | Tax-inclusive demo calculation and compliance boundary | Accepted |
| [ADR-005](0005-store-timezone-business-date-financial-year.md) | Store timezone, business date, and Indian financial year | Accepted |

Related lifecycle, event-envelope, reversal, and lock-order contracts are documented in [Finance lifecycle and event contracts](../finance-lifecycle-contracts.md). API endpoints, compatibility rollout, error codes, and permission matrices are documented in [Finance API compatibility and rollout map](../finance-api-compatibility-rollout.md). Deterministic reference fixtures and expected results are documented in [Deterministic two-store financial fixtures](../two-store-financial-fixtures.md).
