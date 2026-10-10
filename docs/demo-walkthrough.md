# Recruiter demo and interview walkthrough

Aim for one coherent business flow, then explain the engineering decisions behind it. For a four-plus-year developer presentation, the strongest evidence is ownership of invariants, failure handling and tradeoffs, supported by code and reproducible checks.

## Prepare once

Follow [setup](setup.md) and choose either [recruiter showcase data](recruiter-demo.md) or the [fixed finance scenario](finance-demo-walkthrough.md). Their accounts and dates differ. Do not reset a prepared database immediately before a call. Confirm the chosen customer/staff logins, serviceable address, open store hours, stock, report dates and asset files. Use separate browser profiles for different accounts.

Use the default simulator and fresh checkout orders for payment/retry/refund actions. Prepared historical provider IDs have no corresponding in-memory provider state. If the API or database is unavailable, the public `/docs` tour still works.

## Five-minute tour

| Time | Show | Explain |
| --- | --- | --- |
| 0:00–0:40 | Storefront, store selection, customization and a combo | Global catalogue versus store price/stock; combo inventory expands to components |
| 0:40–1:40 | Cart quote, offer/coupon eligibility and one checkout | Server-owned integer paise, included tax, separate savings and immutable snapshots |
| 1:40–2:30 | Staff order queue and inventory movements | Payment versus fulfillment; online reservations versus sold stock; scoped staff authority |
| 2:30–3:40 | One delivered order, journal and finance report/CSV | Business transaction plus outbox; delivery recognition; balanced posting and exact reversal |
| 3:40–5:00 | `/docs/architecture`, inventory explorer and reliability | Transaction boundary, rejected last-item attempt, evidence limits and operational recovery |

Posting is a separate command: use `pnpm --filter backend finance:post-events` deliberately on the demo database when new financial events need draining. Without it, new delivery effects may not yet appear in ledger-backed reports. A finance manager cannot see payroll-sensitive derived totals; use the appropriate admin/persona for that part of the demo.

## Deeper discussion

1. Trace COD from request validation through saved quote, stock movement and commit. Compare online initiation's local commit/provider call/attachment boundaries.
2. Explain retry after a lost response: stable local identity, provider receipt recovery, exact saved amount and atomic restoration of stock/promotion capacity.
3. Explain why a capture does not mean revenue, a refund does not mean inventory return, and a compare-at markdown does not mean refundable money.
4. Show an effective-dated cost or compensation change and explain why historical snapshots remain stable.
5. Explain principal/store cache keys and server-derived resource scope. UI visibility improves usability; the server checks current permission.
6. Discuss the modular monolith's shared transaction advantage and its process/storage/socket limits. Identify the trigger for shared storage, durable notifications or distributed coordination.

## Manual rehearsal checks

- Customer: sign-in/out, valid/unsupported address, quote refresh, available/unavailable item, eligible/ineligible coupon, COD and simulated online checkout.
- Operations: legal/illegal order transition, stock adjustment below reservations, cross-store request denial, suspended/revoked membership and safe account/store switching.
- Finance: one delivered source to journal/report/CSV; exact item/delivery refund; expense approval separation; counted cash variance; closed-period rejection and correction workflow.
- Presentation: narrow layout, keyboard/focus, missing-image fallback, direct docs refresh and API-unavailable docs navigation.

Record observed results separately from expected behavior. [Automated verification](case-study-verification.md) does not establish these manual outcomes or a live provider walkthrough.

## Portfolio copy

Describe the implemented scope and the design decisions you can defend. State your actual contribution, team context and project dates using your own confirmed history. Add live/source links and screenshots only from the real published project. Avoid inventing traffic, latency, business impact, uptime or production compliance claims.

For a short public-only presentation, use [the two-minute case-study tour](case-study-walkthrough.md). For a full finance explanation, use [the workspace guide](finance-workspace.md) and [operations runbook](finance-operations-runbook.md).
