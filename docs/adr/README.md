# Architecture decision records

Architecture decision records (ADRs) capture product, financial, lifecycle, and operational rules that code, migrations, APIs, reports, and tests must share. An accepted ADR remains in place; if a decision changes, add a superseding ADR rather than silently rewriting history.

| ADR | Decision | Status |
| --- | --- | --- |
| [ADR-001](0001-money-representation-and-rounding.md) | Money representation, limits, rounding, and allocation | Accepted |
| [ADR-002](0002-revenue-cogs-recognition-and-refunds.md) | Revenue/COGS recognition and refunds | Accepted |
| [ADR-003](0003-ledger-accounts-and-posting-rules.md) | Ledger accounts and posting rules | Accepted |
| [ADR-004](0004-tax-inclusive-demo-policy.md) | Tax-inclusive demo calculation and compliance boundary | Accepted |
| [ADR-005](0005-store-timezone-business-date-financial-year.md) | Store timezone, business date, and Indian financial year | Accepted |
| [ADR-006](0006-promotion-resolution-eligibility-and-governance.md) | Promotion resolution, eligibility, capacity, and governance | Accepted |
| [ADR-007](0007-bundle-pricing-promotion-accounting-and-snapshots.md) | Bundle pricing, promotion accounting, and immutable snapshots | Accepted |
| [ADR-008](0008-promotion-media-storage-and-cleanup.md) | Promotion media storage, replacement, and cleanup | Accepted |

Related lifecycle, event-envelope, reversal, and lock-order contracts are documented in [Finance lifecycle and event contracts](../finance-lifecycle-contracts.md). Promotion DTOs, endpoints, error codes, and permissions are frozen in [Promotions and offers API contract](../promotions-contract.md). Finance API rollout and permissions are documented in [Finance API compatibility and rollout map](../finance-api-compatibility-rollout.md). Deterministic reference fixtures and expected results are documented in [Deterministic two-store financial fixtures](../two-store-financial-fixtures.md).
