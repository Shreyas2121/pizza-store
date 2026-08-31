# ADR-003: Ledger accounts and posting rules

- Status: Accepted
- Date: 2026-08-31
- Decision owners: PizzaStore project owner and maintainers

## Context

PizzaStore needs an auditable subledger that separates collections, delivery-based recognition, refunds, settlement, cash, expenses, and payroll. The current application has no ledger tables. The examples in `plan.md` intentionally left the clearing-account policy unresolved, and the minimum account list omitted some accounts needed to balance customer advances, rounding, opening balances, and provider-fee tax without claiming input tax credit.

This portfolio project should demonstrate correct double-entry mechanics without presenting itself as statutory accounting software or a complete restaurant ERP.

## Decision

### Ledger boundary

1. Operational aggregates remain the source of workflow truth. Posted journals are the source of accounting truth and finance reporting.
2. One owner-operated business uses one system chart of accounts. Every journal is store-scoped and INR-only; consolidated reporting sums store journals rather than treating stores as merchants.
3. System accounts have stable codes, immutable type/normal-side semantics, and cannot be deleted. Names may be corrected without changing historical identity. Custom accounts may be deactivated but not deleted once referenced.
4. A journal has a business date and UTC occurred time from its source, at least two lines, and exactly one positive debit or credit on every normal line. Total debits must equal total credits before commit.
5. System-generated journals post atomically. Manual journals may begin as `draft`, but only the balanced posting kernel may move them to `posted`.
6. Posted journals and lines are immutable. A correction creates a new posted journal with the exact opposite lines and a unique link to the original. A replacement is a separate journal and source event.
7. A reversal uses an open business date. If the original period is closed, the reversal is posted in the current authorized open period and retains the original business date and journal reference as metadata.
8. The unique source key is `(sourceType, sourceId, eventType, sourceVersion)`. At-least-once event delivery therefore produces at most one journal.
9. Audit logs and journals remain separate: audit records actors and decisions; the ledger records financial effects.

### Minimum chart of accounts

| Code | Account | Type | Normal side | Purpose |
| --- | --- | --- | --- | --- |
| 1000 | Cash on Hand | Asset | Debit | Store cash controlled by cash sessions |
| 1010 | Bank | Asset | Debit | Owner-business bank balance by store journal dimension |
| 1100 | Razorpay Clearing | Asset | Debit | Captured online funds not yet settled to bank |
| 1200 | Inventory / COGS Clearing | Asset | Debit | Standard-cost inventory proxy; not ingredient-level perpetual inventory |
| 2000 | Customer Advances / Order Clearing | Liability | Credit | Collections received before delivery recognition |
| 2100 | Refunds Payable | Liability | Credit | Finalized refunds awaiting provider or cash disbursement |
| 2200 | Demo Tax Payable | Liability | Credit | Included demo tax collected; not a statutory return balance |
| 2300 | Payroll Payable | Liability | Credit | Approved employee net amounts awaiting or evidencing payment |
| 2310 | Payroll Deductions Payable | Liability | Credit | Configured demo deductions or employer liabilities |
| 3000 | Owner's Equity / Opening Balance | Equity | Credit | Controlled opening and manual balance entries |
| 4000 | Sales Revenue | Revenue | Credit | Pre-discount taxable food revenue at delivery |
| 4010 | Delivery Revenue | Revenue | Credit | Taxable delivery-service revenue at delivery |
| 4100 | Discounts | Contra revenue | Debit | Tax-exclusive reduction from gross food revenue |
| 4110 | Refunds | Contra revenue | Debit | Tax-exclusive revenue reversed by finalized refunds |
| 5000 | Cost of Goods Sold | Expense | Debit | Snapshotted standard cost recognized at delivery |
| 6000 | Payment Gateway Fees | Expense | Debit | Provider fee excluding its separately reported tax |
| 6010 | Gateway Fee Tax Expense | Expense | Debit | Provider fee tax expensed because the demo claims no input tax credit |
| 6100 | Cash Over / Short | Expense | Debit | Counted-versus-expected cash variance; a credit represents an overage |
| 6200 | Payroll Expense | Expense | Debit | Employee earnings and configured employer cost |
| 6900 | Operating Expenses | Expense | Debit | Parent for explicitly mapped expense-category accounts |
| 6990 | Rounding Gain / Loss | Expense | Debit | Explicit order-level paise adjustment; a credit represents a gain |

Child operating-expense and payroll-liability accounts are seeded only when a deterministic fixture needs them. Missing mappings stop posting; the engine never silently falls back to a generic account.

### Posting rules

All amounts below are integer paise from immutable source snapshots. `Customer Advances` makes collection and revenue separate: capture credits the liability, while delivery clears it.

| Source event | Debit | Credit |
| --- | --- | --- |
| Online payment captured | Razorpay Clearing: captured total | Customer Advances: captured total |
| COD collected at delivery | Cash on Hand: collected total | Customer Advances: collected total |
| Order delivered | Customer Advances: customer total; Discounts: tax-exclusive discount component; COGS: cost snapshot; Rounding Gain/Loss when adjustment is negative | Sales Revenue: pre-discount taxable food value; Delivery Revenue: taxable delivery value; Demo Tax Payable: post-discount included tax; Inventory / COGS Clearing: cost snapshot; Rounding Gain/Loss when adjustment is positive |
| Finalized refund before delivery | Customer Advances: refundable total | Refunds Payable: refundable total |
| Finalized refund after delivery | Refunds: allocated tax-exclusive revenue; Demo Tax Payable: allocated included tax | Refunds Payable: customer refund total |
| Refund disbursed online | Refunds Payable: disbursed total | Razorpay Clearing: disbursed total |
| Refund disbursed in cash | Refunds Payable: disbursed total | Cash on Hand: disbursed total |
| Explicit accepted inventory return | Inventory / COGS Clearing: returned cost snapshot | Cost of Goods Sold: returned cost snapshot |
| Razorpay settlement reconciled | Bank: net; Payment Gateway Fees: fee; Gateway Fee Tax Expense: fee tax; explicitly mapped adjustment debits | Razorpay Clearing: settled gross; explicitly mapped adjustment credits |
| Cash deposited | Bank: deposit | Cash on Hand: deposit |
| Cash shortage at close | Cash Over / Short: shortage | Cash on Hand: shortage |
| Cash overage at close | Cash on Hand: overage | Cash Over / Short: overage |
| Paid expense posted | Mapped operating-expense accounts: inclusive allocated amounts | Bank or Cash on Hand: paid total |
| Pay run posted | Payroll Expense: earnings plus employer cost; Payroll Payable: net payment clearing when recorded in the same journal | Payroll Payable: employee net; Payroll Deductions Payable: configured deductions/liabilities; Bank: employee net paid |

For a tax-inclusive discounted order, `Sales Revenue` records the pre-discount taxable base, `Discounts` records only the tax-exclusive discount component, and `Demo Tax Payable` records tax after discount. The customer-facing inclusive discount remains on the order snapshot. This keeps the journal balanced without adding included tax twice.

Expense tax is part of the mapped expense in v1. Provider fee tax is shown separately only because settlement fixtures report it separately. Neither treatment claims input tax credit.

Refund posting depends on fulfilment state. Before delivery it clears Customer Advances and never touches revenue or COGS. After delivery it records contra revenue and tax. COGS changes only for the separate accepted inventory-return event required by ADR-002.

### Periods and posting validation

- `open` periods accept authorized source and manual postings.
- `soft_closed` periods accept automated source postings but reject manual journals unless an owner explicitly overrides with recent authentication and an audit reason.
- `closed` periods reject every new or backdated posting. Controlled reopen is owner-only and audited.
- Account currency, store scope, source totals, fiscal period, line sides, balance, duplicate source identity, and required account mappings are validated inside the posting transaction.
- A posting failure leaves the outbox event retryable and creates no partial journal.

## Alternatives considered

### Treat capture as revenue

Rejected because paid-but-undelivered orders would overstate sales. Customer Advances preserves the collection while deferring recognition to delivery.

### Post directly from controllers

Rejected because retries, webhook delivery, scripts, and background reconciliation would bypass or duplicate accounting behavior.

### Mutable journal rows

Rejected because edits erase the correction trail. Reversal plus replacement is easier to audit and explain.

### One generic clearing or suspense account

Rejected because it hides whether money is with the provider, owed to a customer, held as cash, or awaiting revenue recognition.

### Record provider fee tax as input tax credit

Rejected because ADR-004 explicitly makes no statutory or input-tax-credit claim. A separate expense preserves reconciliation detail without overstating a recoverable asset.

### Accrual accounting for all expenses in v1

Rejected for the portfolio cut because the approved workflow is `draft -> submitted -> approved -> paid -> posted`. V1 posts operating expense when the paid source is posted; accounts payable and accrual workflows require a later ADR.

## Consequences

- Every finance KPI can drill from a journal to one immutable source event and operational record.
- The chart is intentionally small but complete enough to balance the deterministic demo.
- Collection, recognition, settlement, and refund timing are visible rather than collapsed into one payment status.
- The standard-cost inventory account is a portfolio proxy and must not be described as ingredient-level inventory valuation.
- Discounts need both the inclusive customer amount and tax-exclusive posting component in the immutable pricing/event snapshot.
- Payroll component mappings must be explicit before P6 posting; statutory liabilities remain outside the compliance claim.
- Closed-period corrections appear in the current open period with references back to the original, so historical closed totals do not silently change.

## Examples

An online order has a 52,500 paise customer total: 50,000 paise recognized revenue after discount and 2,500 paise included demo tax. Its standard cost is 18,000 paise.

```text
Capture
  Dr Razorpay Clearing                 52,500
    Cr Customer Advances                           52,500

Delivery
  Dr Customer Advances                 52,500
  Dr Cost of Goods Sold                18,000
    Cr Sales/Delivery Revenue                       50,000
    Cr Demo Tax Payable                              2,500
    Cr Inventory / COGS Clearing                   18,000
```

If Razorpay later settles 51,800 paise after a 600 paise fee and 100 paise fee tax:

```text
  Dr Bank                              51,800
  Dr Payment Gateway Fees                 600
  Dr Gateway Fee Tax Expense              100
    Cr Razorpay Clearing                           52,500
```

Each block balances independently, and capture is visibly not revenue.

For a discounted item originally priced at 10,500 paise inclusive of 5% demo tax, a 1,050 paise inclusive discount leaves a 9,000 paise taxable base and 450 paise tax. The delivery journal uses:

```text
  Dr Customer Advances                  9,450
  Dr Discounts                          1,000
    Cr Sales Revenue                               10,000
    Cr Demo Tax Payable                               450
```

The 50 paise tax reduction is already reflected in the lower tax liability, so the customer discount is not counted twice.

## Testable invariants

- Every posted journal has at least two lines and `sum(debitPaise) = sum(creditPaise)`.
- Exactly one of debit or credit is positive on every normal journal line.
- `(sourceType, sourceId, eventType, sourceVersion)` creates at most one journal.
- Posted journals and lines cannot be updated or deleted.
- A reversal copies the original lines with debit and credit exchanged; original plus reversal has zero net account effect.
- Capture changes clearing and Customer Advances but not revenue, tax liability, or COGS.
- `out_for_delivery` creates no journal.
- Delivery recognizes revenue, included tax liability, and snapshotted COGS exactly once.
- A refund without an accepted inventory return does not reverse COGS.
- Settlement debits plus credits reconcile exactly to provider gross, net, fee, fee tax, and mapped adjustments.
- Missing account/category/component mappings reject posting rather than using a fallback.
- Closed periods reject postings, including backdated retries.
- Trial balance is zero for every store, currency, and fixture period.
