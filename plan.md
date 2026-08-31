# PizzaStore Financial Overhaul Plan

> Status: proposed implementation plan  
> Prepared: 30 August 2026  
> Project: multi-store food delivery portfolio application  
> Intended standard: credible for an engineer with 4+ years of experience, while still achievable as a portfolio project

## 1. Executive decision

The project currently has a strong commerce and payment foundation, but it does **not** yet have a financial system. It can charge a customer, record a payment, reserve inventory, and display order totals; it cannot reliably answer:

- How much revenue was actually earned rather than merely ordered?
- How much cash or Razorpay money was collected, refunded, or settled?
- What did the sold items cost and what was the gross margin?
- What operating expenses and payroll costs belong to each store and period?
- Why does a dashboard number have its current value, and which source transactions produced it?

The recommended portfolio scope is therefore:

1. Establish one exact representation of money and immutable order price snapshots.
2. Separate order, payment, refund, settlement, and revenue-recognition lifecycles.
3. Add store-level costs, expenses, vendors, and COD cash reconciliation.
4. Add an append-only double-entry ledger fed by idempotent domain events.
5. Replace the current gross-order-value dashboard with traceable management reports.
6. Add a bounded **payroll-lite** module for salaries, pay runs, and employer cost, but do not claim statutory payroll compliance.

This gives the project a coherent story: **order-to-cash, procure/expense-to-pay, payroll-to-posting, reconciliation, and reporting**. It demonstrates modeling, transactions, idempotency, authorization, auditability, migrations, and analytics instead of becoming a collection of unrelated admin CRUD screens.

## 2. Repository audit: what exists today

### 2.1 Useful foundations to retain

| Area | Current capability | Why it helps the overhaul |
| --- | --- | --- |
| Checkout | Server-side quote calculation, coupon locking, stock validation, transactional order creation | Financial snapshots can be created in the same transaction |
| Payments | COD and Razorpay, signature validation, webhook event deduplication, reconciliation service | Good base for attempts, refunds, fees, and settlements |
| Inventory | Reservations, append-only movements, idempotency keys, row locking | Provides a proven pattern for a financial ledger and COGS events |
| Multi-store | Orders, inventory, staff, and dashboard are store scoped | Supports store P&L and consolidated reporting |
| Authorization | Store permissions plus platform capabilities | Can be extended with finance/payroll segregation of duties |
| Audit | Append-only audit log with actor, store, request, outcome, and metadata | Administrative actions can remain independently auditable |
| Backend tests | 20 backend test files, including checkout, payment, inventory, access, and audit behavior | Gives a base for financial invariants and transition tests |

### 2.2 Material gaps and correctness risks

| Finding | Evidence in the repository | Impact |
| --- | --- | --- |
| Money has three storage representations | Payments use integer `amountPaise`; product/customization/store-product prices use `real`; carts, coupons, orders, and delivery prices use `doublePrecision` rupees | Rounding and equality errors; no single monetary contract |
| Checkout discards its exact calculation at persistence | `buildQuote` calculates integer paise, converts back through `paiseToRupees`, and `createOrderSnapshot` writes floating `discountAmount`/`totalPrice` | The safest existing calculation path still loses its exact representation at the database boundary |
| Coupon validation has competing paths | Checkout validates the minimum in paise, while `coupon.service.ts#validateCoupon` accepts and compares floating rupees | Preview and final checkout can disagree at boundary values |
| The dashboard labels gross order value as revenue | `dashboard.service.ts` sums `orders.total_price` without filtering order status or payment status | Cancelled, unpaid, or failed orders can inflate revenue and AOV |
| Order price breakdown is incomplete | Orders persist only `discountAmount` and `totalPrice`; subtotal is reconstructed later | Historical totals cannot be independently verified after pricing logic changes |
| Delivery fee is cosmetic and globally modeled | Cart/checkout hard-code zero; `buildQuote` omits delivery; `delivery_price` has no `storeId` | UI and persisted truth can diverge, and the config does not fit the multi-store model |
| Tax is absent | No tax rate, taxable value, tax component, HSN/SAC snapshot, or invoice | No defensible invoice or tax report can be produced |
| One order points to one payment row | `orders.payment_id` is unique | Multiple attempts, partial captures, partial refunds, and tender combinations are awkward or impossible |
| Refund is only a payment status | `refunded` exists, but there is no refund entity, amount, reason, actor, provider reference, or partial-refund history | Refund workflow and reconciliation are not auditable |
| No settlement model | Provider capture is modeled, but bank settlements, fees, taxes on fees, and settlement batches are not | Cannot reconcile Razorpay collections to bank deposits |
| COD is marked paid on delivery | Delivery changes the linked COD payment to completed | There is no cash drawer/session, deposit, variance, or handover control |
| Inventory tracks finished products, not ingredients | Stock is at `store_products` level | True recipe-level food cost and wastage cannot yet be calculated |
| No expense or purchasing domain | No vendors, bills, expense categories, approvals, or payments | Net profit is unavailable |
| Staff membership is not employment | Membership stores access role and lifecycle only | Salary should not be bolted onto authorization records |
| No frontend test suite | No frontend test files found | Financial tables, filters, permissions, and total rendering need coverage |
| Frontend recomputes authoritative-looking totals | Checkout recalculates percentage/fixed discounts with JavaScript floats and displays delivery as zero | The customer preview can differ from the server quote; frontend must render a server quote instead |
| Payment reconciliation is already oversized | `payment-reconciliation.service.ts` is 837 lines and mixes verification, capture finalization, stale/expired recovery, provider-order recovery, and observation logging | Adding refund/settlement matching without decomposition would increase regression risk |
| Documentation has drift | README describes older versions/structure in places; order status contains `delievered` typo | A financial overhaul should include contract and terminology cleanup |

### 2.3 Immediate correctness PR before the overhaul

Ship this as a standalone, reviewable PR before Phase 0:

- Rename the current dashboard **Revenue** card/chart to **Gross order value**.
- Apply one shared eligible-order filter to GOV, order count, AOV, active customers, and comparison periods.
- Exclude `cancelled` and `awaiting_payment`; document that pending/preparing/delivered placed orders are included in this temporary operational metric.
- Add regression tests proving cancelled/unpaid orders cannot inflate GOV/AOV.
- Keep the endpoint shape compatible so the current frontend can adopt the label/filter correction immediately.

This is a temporary correctness improvement, not recognized-revenue reporting.

## 3. Scope recommendation

### 3.1 Recommended portfolio release

Build the following as one coherent release, delivered incrementally:

- Exact money and authoritative pricing snapshots
- Payment attempts, full/partial refunds, and Razorpay settlement reconciliation
- COD cash sessions and variances
- Standard product cost, COGS snapshots, vendors, and operating expenses
- Append-only double-entry general ledger
- Store and consolidated management P&L
- Revenue, collections, refunds, margin, expense, and settlement dashboards
- CSV exports, drill-down, audit trail, and period close/lock
- Payroll-lite: employee finance profiles, effective-dated compensation, pay runs, payslip-style statements, and ledger posting

### 3.2 Deliberately deferred

These are valid future extensions, but including them in the first release would weaken delivery quality:

- Full recipe/BOM ingredient inventory and purchase-order receiving
- Accounts payable aging and supplier payment automation
- Bank feeds and automatic bank matching
- GST return filing, e-invoice IRP integration, or guaranteed tax compliance; the demo will calculate and snapshot configurable tax without claiming compliance
- Automated TDS, EPF, ESI, professional tax, labour-law calculations, or government filing
- Multi-currency and foreign exchange accounting
- Forecasting, anomaly detection, or AI-generated advice before the source data is trustworthy
- A complete ERP-grade balance sheet, depreciation, loans, and fixed-asset register

### 3.3 Store operating costs and payroll decision

Salary is included because labour is a material store operating cost and is required for a useful P&L—not because the pizza application is becoming a general HR product. The UI should present payroll under **Operating costs**, while retaining a tightly restricted payroll workspace for employee-level detail.

**Recommended payroll-lite scope**

- Separate employee finance profile linked to a user/store membership when applicable
- Effective-dated salary structure: base, recurring allowances, recurring deductions, employer contributions
- Monthly pay period and pay-run state machine: `draft -> calculated -> approved -> paid -> posted`, plus `voided`
- Per-employee earning/deduction lines with immutable snapshots
- Gross pay, employee deductions, net pay, employer cost, payment reference, and paid date
- Restricted salary permissions, audit entries, CSV export, and a generated payslip-style PDF/HTML view
- Ledger posting only after approval/payment; reversal rather than editing a posted run

**Not in the portfolio compliance claim**

- Do not hard-code current tax slabs or statutory contribution rates into business logic.
- If demo deductions are desired, store them as effective-dated configurable rules with source URL, jurisdiction, validity dates, and a visible “demo only” label.
- Never state that generated documents are Form 16, statutory payslips, or filing-ready unless reviewed by a qualified Indian payroll/tax professional.

This boundary matters because official Indian sources describe employer TDS certificates and periodic reporting, while EPF/ESI impose employer obligations and rules that can change. The module should demonstrate financial engineering, not imply legal compliance.

## 4. Domain definitions and accounting policy

These definitions must be written as an architecture decision record before implementation. Dashboard labels, SQL, API contracts, and tests must use the same meanings.

### 4.1 Core terms

| Metric | Definition |
| --- | --- |
| Gross order value (GOV) | Item subtotal before discounts, excluding cancelled/expired orders |
| Discount | Merchant-funded reduction allocated proportionally across eligible order lines |
| Net sales before tax | Item subtotal minus allocated discounts, excluding tax and delivery service revenue |
| Delivery revenue | Delivery fee charged to the customer, if the business is the principal for delivery |
| Tax collected | Tax liability collected from the customer; never revenue |
| Order total | Net item value + delivery fee + tax + rounding adjustment |
| Collections | Money actually captured online or collected as COD |
| Recognized revenue | Net sales plus eligible delivery revenue at the configured recognition event |
| Refunds | Finalized customer refunds; reported separately and posted as contra-revenue/liability according to policy |
| COGS | Cost snapshot of units sold when the order reaches the recognition/fulfilment event |
| Gross profit | Recognized revenue - COGS |
| Operating profit | Gross profit - operating expenses - payroll employer cost - provider fees |
| AOV | Eligible order value / count of eligible orders; denominator policy must match numerator policy |
| Cash variance | Counted cash - expected cash for a closed cash session |
| Settlement variance | Provider-reported net settlement - locally expected net settlement |

### 4.2 Recommended recognition policy

For this food-delivery application:

- Recognize food and delivery revenue when an order becomes `delivered`.
- Treat Razorpay capture as a collection event, not a revenue event.
- Treat COD delivery plus staff confirmation as collection, then reconcile it through a cash session.
- Reverse recognized revenue and tax through explicit reversal entries for finalized refunds or post-delivery cancellations; never delete or overwrite posted journal entries.
- A refund does not prove that goods returned to inventory. Reverse COGS only from a separate, explicit fulfilment/inventory-return event supported by the operational facts.
- Use the store’s configured timezone for operational cutoffs, while storing timestamps as UTC.
- Use the Indian financial year (1 April to 31 March) as a supported reporting preset; retain arbitrary date ranges.

### 4.3 Demo tax policy

Use a **tax-inclusive demo model** because the project is a consumer food-ordering application: the menu price remains the amount customers expect to pay, while checkout and invoices explain how much of the discounted price is treated as tax.

- Store effective-dated, configurable tax rules rather than hard-coding a GST rate in checkout logic.
- Seed clearly labelled fictional/demo tax registrations and rates. The seed values demonstrate the engine and are not compliance advice.
- Apply item discount allocations before extracting inclusive tax.
- Calculate each item line independently in paise, then allocate any one-paise rounding remainder deterministically.
- Store tax rate, taxable value, tax amount, rule version, and place-of-supply inputs on the order snapshot.
- Support separate item and delivery tax rules because they may differ.
- Show `Tax included` in storefront/checkout UI and expose the breakdown on the order detail page.
- Generate a **demo invoice/receipt**, not an IRP e-invoice or filing-ready GST document. Display a visible `Portfolio demo — not a statutory tax invoice` label.
- Do not integrate GST returns, IRN/QR generation, input-tax-credit claims, or government portals.

For an inclusive line amount after discount:

```text
taxablePaise = round(discountedInclusivePaise * 10_000 / (10_000 + taxRateBps))
taxPaise     = discountedInclusivePaise - taxablePaise
```

This is enough to demonstrate effective-dated rules, exact allocation, snapshotting, and reporting to recruiters while keeping the compliance boundary honest.

### 4.4 Money policy

- Store all currency amounts in integer minor units named `...Paise`.
- Use PostgreSQL `integer` for individual portfolio transaction amounts. Its maximum is 2,147,483,647 paise (₹21,474,836.47), comfortably above a bounded pizza order, expense, refund, or payroll line.
- Define lower domain caps in code/Zod (for example, a much smaller maximum order amount) and test the boundaries; never rely only on the database maximum.
- PostgreSQL `SUM(integer)` returns `bigint`. Serialize report/ledger aggregates as decimal paise strings when they may exceed JavaScript’s safe range, while bounded individual transaction DTOs may use numbers.
- Revisit `bigint` or `numeric` for all stored amounts only if real requirements exceed the integer cap or add currencies with more minor-unit complexity. Both require an explicit node-postgres/Drizzle parsing and JSON policy; `numeric` does not by itself remove string handling.
- Centralize checked addition, subtraction, multiplication, allocation, percentage, comparison, parsing, and formatting in a shared money module.
- Define rounding once: round half away from zero for customer-facing paise, and distribute allocation remainders deterministically by line ID.
- Never accept a price, discount, fee, tax, cost, payroll total, or refund amount calculated by the browser as authoritative.
- Add database checks for non-negative amounts where appropriate and balanced signed ledger lines.

PostgreSQL documents `real` and `double precision` as inexact and recommends exact numeric types for monetary values. Integer paise is chosen here because the application is INR-only and already integrates with Razorpay in paise.

## 5. Target architecture

```text
Checkout / Orders / Payments / Refunds / Expenses / Payroll
                         |
                 transactional outbox
                         |
            idempotent financial event handlers
                         |
        subledger records + immutable journal entries
                         |
        trial balance / P&L / reconciliations / dashboards
```

### 5.1 Design rules

1. Operational tables remain the source of operational truth; the ledger is the source of accounting/reporting truth.
2. Every posted journal has a unique source identity such as `(sourceType, sourceId, eventType, version)`.
3. A journal entry has at least two lines and total debits must equal total credits before commit.
4. Posted entries are immutable. Corrections create reversing and replacement entries.
5. Domain mutation, outbox event, and any synchronous critical posting occur in one database transaction.
6. Asynchronous consumers are at-least-once and idempotent; replaying an event must be safe.
7. All financial records carry `storeId`, `currency`, business date, occurred time, and source reference where relevant.
8. Reporting endpoints read financial projections/ledger data, not controller-side recomputations over mutable catalog data.
9. Routes authorize store scope before querying resource details to avoid cross-store data exposure.
10. Audit log and accounting ledger are distinct: audit answers “who changed what”; ledger answers “what financial effect occurred.”

### 5.2 Suggested backend modules

```text
backend/src/features/
  pricing/             authoritative quote and allocation rules
  refunds/             refund request and provider lifecycle
  settlements/         Razorpay settlement import and matching
  cash-management/     COD sessions, counts, deposits, variances
  costs/               standard product costs and COGS snapshots
  vendors/             vendor master data
  expenses/            expense workflow and attachments
  ledger/              accounts, journals, posting rules, trial balance
  finance-reports/     P&L, collections, margin, variance, exports
  payroll/             payroll-lite profiles, compensation, pay runs
  fiscal-periods/      periods, close/reopen controls
```

Do not force each module to exactly two files. The current payment and staff modules already demonstrate that repositories, schemas, domain types, policies, and tests are valuable when complexity warrants them. Update `docs/architecture.md` accordingly.

Before adding refunds or settlements, decompose the existing 837-line payment reconciliation service behind characterization tests into focused collaborators:

- Checkout verification and provider-state validation
- Capture finalization
- Stale payment/reservation recovery
- Provider-order recovery
- Provider observation/event recording

Preserve the public service behavior during this refactor; do not combine it with the payment-attempt schema migration in one PR.

## 6. Data model blueprint

Names below are proposals, not migration-ready SQL. Finalize them in ADRs and Drizzle schemas.

### 6.1 Order financial snapshot

Extend `orders` with immutable checkout values:

- `itemsSubtotalPaise`
- `discountPaise`
- `deliveryFeePaise`
- `taxableAmountPaise`
- `taxPaise`
- `roundingAdjustmentPaise`
- `grandTotalPaise`
- `currency`
- `pricingVersion`
- `recognizedAt`
- `cancelledAt`, `deliveredAt` (fix the `delievered` spelling through a compatibility migration)

Extend order items/customizations with snapshots:

- `unitPricePaise`, `lineSubtotalPaise`, `discountAllocationPaise`
- `taxRateBps`, `taxableAmountPaise`, `taxPaise`, `lineTotalPaise`
- `unitCostPaise`, `lineCostPaise`
- Product/customization display name snapshots
- Optional `hsnSacCode` snapshot when tax invoicing is enabled

Invariant:

```text
grandTotalPaise = itemsSubtotalPaise
                - discountPaise
                + deliveryFeePaise
                + roundingAdjustmentPaise
```

`itemsSubtotalPaise`, `discountPaise`, and `deliveryFeePaise` are customer-facing tax-inclusive amounts. `taxPaise` is the included liability component and is not added again. The sum of item-level discount/tax/cost allocations must equal the order-level values exactly.

### 6.2 Payments and refunds

Change the relationship from order-to-one-payment into order-to-many-payment-attempts.

`payment_attempts`

- `id`, `orderId`, `storeId`, `provider`, `method`, `status`
- `amountPaise`, `currency`
- `providerOrderId`, `providerPaymentId`, `clientRequestId`
- failure fields, `authorizedAt`, `capturedAt`, `failedAt`, `expiresAt`
- unique provider references and idempotency keys

`refunds`

- `id`, `orderId`, `paymentAttemptId`, `storeId`
- `amountPaise`, `currency`, `status`, `reasonCode`, `reasonNote`
- `providerRefundId`, `clientRequestId`, `requestedBy`
- `requestedAt`, `processedAt`, `failedAt`

`refund_allocations`

- Refund amount allocated to order items, delivery fee, tax, and discount reversal
- Quantity when a partial item/quantity is refunded

Rules:

- Total successful refunds cannot exceed captured amount.
- Concurrent refund requests lock the payment/order refund aggregate.
- Refund requests require an idempotency key.
- Provider final status comes from verified webhooks/API reconciliation, not browser state.
- Inventory return is a separate explicit decision; a food refund does not automatically imply restock.

### 6.3 Razorpay settlements

`settlement_batches`

- Provider settlement ID, status, period, gross amount, fee, fee tax, adjustments, net amount, UTR/bank reference, settled time

`settlement_lines`

- Batch, provider transaction/entity ID, local payment/refund match, amount, fee, tax, type, occurred time, match status

`reconciliation_issues`

- Missing locally, missing at provider, amount mismatch, duplicate, unexpected status, stale pending
- Severity, owner, resolution note, resolved actor/time

Store raw provider payloads only when useful and redact secrets/payment instrument data. Preserve a payload hash and provider IDs for evidence.

### 6.4 COD cash control

`cash_sessions`

- Store, business date, opened/closed by, opening float, expected cash, counted cash, variance, status

`cash_movements`

- Session, type (`cod_collection`, `refund`, `cash_in`, `cash_out`, `deposit`, `adjustment`), amount, order/refund reference, reason, actor

Rules:

- A COD collection belongs to exactly one open store session.
- Manual movements require a reason; adjustments above a threshold require manager approval.
- Closed sessions are immutable except via controlled reopen/reversal.

### 6.5 Product costs and expenses

Phase one uses standard cost, which is honest and implementable with the existing finished-product inventory.

`product_cost_versions`

- `storeProductId`, `unitCostPaise`, `effectiveFrom`, `effectiveTo`, `source`, `createdBy`
- No overlapping effective ranges per store product

`vendors`

- Store/platform scope, name, tax/contact details, payment terms, active state

`expense_categories`

- Hierarchical category, mapped ledger account, fixed/variable classification

`expenses`

- Store, vendor, category, expense date, description, subtotal, tax, total, payment status/method, external reference
- State: `draft -> submitted -> approved -> paid -> posted`; plus `rejected`, `voided`
- Attachment metadata for receipt/invoice; store files outside the public uploads route

`expense_allocations`

- Split one expense across stores/categories/cost centers using exact paise allocation

Future recipe/BOM extension:

- Ingredients, units of measure, recipes, yield, wastage, purchases, goods receipts, lot costs, and consumption movements
- Use this only when “food cost” needs to mean ingredient consumption rather than standard product cost

### 6.6 General ledger

`ledger_accounts`

- Code, name, type (`asset`, `liability`, `equity`, `revenue`, `expense`, `contra_revenue`), normal side, parent, system/custom, active

`journal_entries`

- Store, journal number, business date, occurred time, description
- Source type/ID/event/version unique key
- Status (`draft`, `posted`, `reversed`), posted actor/time, reversal reference

`journal_lines`

- Journal, account, debitPaise, creditPaise, order/payment/refund/expense/pay-run reference, dimensions metadata
- Check that exactly one of debit or credit is positive for a normal line

`fiscal_periods`

- Store or platform scope, start/end, status (`open`, `soft_closed`, `closed`), closed actor/time

Minimum chart of accounts:

- Cash on Hand
- Razorpay Clearing
- Bank
- Refunds Payable
- GST/Tax Payable (only when tax is enabled)
- Sales Revenue
- Delivery Revenue
- Discounts / Contra Revenue
- Refunds / Contra Revenue
- Inventory or COGS Clearing
- Cost of Goods Sold
- Payment Gateway Fees
- Operating Expense accounts
- Payroll Expense
- Payroll Payable
- Cash Over/Short

Example delivered Razorpay order for ₹500 net sales, ₹25 tax, with ₹180 COGS:

```text
At capture:    Dr Razorpay Clearing 525   Cr Customer/Order Clearing 525
At delivery:   Dr Customer/Order Clearing 525
                 Cr Sales Revenue 500
                 Cr Tax Payable 25
               Dr Cost of Goods Sold 180 Cr Inventory/COGS Clearing 180
At settlement: Dr Bank [net]
               Dr Gateway Fee [fee]
               Dr Input Tax on Fee [tax]
                 Cr Razorpay Clearing [gross]
```

Finalize the clearing-account policy during ADR-003. The example illustrates separation of capture, revenue, COGS, and settlement; it is not a substitute for accounting review.

### 6.7 Payroll-lite

`employee_finance_profiles`

- Employee identity reference, store/cost center, employment dates, pay frequency, masked bank metadata, status
- Keep authorization membership and employment separate; a person may have either or both

`compensation_versions`

- Effective dates, earning components, deduction components, employer-cost components, currency

`pay_runs`, `pay_run_employees`, `pay_run_lines`

- Period, status, totals, approvals, payment references, immutable calculation snapshots

Privacy rules:

- Salary read, salary manage, payroll calculate, payroll approve, and payroll pay are separate permissions.
- Managers do not automatically receive salary access merely because they can manage store staff.
- Mask bank/PAN-like identifiers, encrypt sensitive values at rest, never place them in audit metadata, and do not expose bulk salary data through generic user endpoints.

## 7. API and UI plan

### 7.1 API conventions

- Keep the repository’s existing `/api/v1` prefix and mount new endpoints under `/api/v1/finance/...`; do not introduce a second versioning convention.
- Parse dates, enums, IDs, page sizes, money strings, and sort fields with Zod.
- Use cursor pagination for journals, payment events, and audit-scale datasets.
- Require `Idempotency-Key` for refunds, expense payment/posting, cash adjustments, pay-run posting, and manual journals.
- Return machine-readable error codes such as `PERIOD_CLOSED`, `JOURNAL_UNBALANCED`, `REFUND_EXCEEDS_CAPTURED_AMOUNT`, and `SETTLEMENT_MISMATCH`.
- Every aggregate report returns its policy metadata: currency, timezone, date basis, included statuses, generated time, and comparison range.
- CSV exports use the same service/query as the screen to prevent conflicting totals.

Existing endpoint migration:

- Keep `/api/v1/dashboard` during the transition as the operational dashboard contract.
- Apply the immediate GOV correction without changing its response shape.
- Add financial reports only under `/api/v1/finance`; do not redirect old dashboard calls.
- Migrate the admin frontend card-by-card behind a finance feature flag.
- Once finance overview is stable, remove financial fields from the old dashboard in a documented future breaking API version; retain operational order/user/low-stock metrics.
- Add contract tests for both old and new endpoints throughout the compatibility window.

### 7.2 Proposed endpoints

```text
GET    /finance/overview
GET    /finance/profit-and-loss
GET    /finance/sales
GET    /finance/margins
GET    /finance/ledger/accounts
GET    /finance/ledger/journals
GET    /finance/ledger/trial-balance
POST   /finance/ledger/manual-journals
POST   /finance/ledger/journals/:id/reverse

GET    /finance/refunds
POST   /finance/orders/:orderId/refunds
GET    /finance/settlements
POST   /finance/settlements/import-or-sync
GET    /finance/reconciliation/issues
POST   /finance/reconciliation/issues/:id/resolve

GET    /finance/cash-sessions
POST   /finance/cash-sessions/open
POST   /finance/cash-sessions/:id/movements
POST   /finance/cash-sessions/:id/close

GET    /finance/expenses
POST   /finance/expenses
POST   /finance/expenses/:id/submit
POST   /finance/expenses/:id/approve
POST   /finance/expenses/:id/pay
POST   /finance/expenses/:id/void

GET    /finance/payroll/pay-runs
POST   /finance/payroll/pay-runs
POST   /finance/payroll/pay-runs/:id/calculate
POST   /finance/payroll/pay-runs/:id/approve
POST   /finance/payroll/pay-runs/:id/mark-paid
POST   /finance/payroll/pay-runs/:id/post
```

### 7.3 Admin information architecture

Add a **Finance** navigation group visible only with relevant permissions:

- Overview
- Sales & margin
- Payments & refunds
- Settlements & reconciliation
- Cash sessions
- Expenses
- General ledger
- Payroll
- Period close

### 7.4 Finance overview

Default cards:

- Recognized revenue
- Collections
- Refunds
- Gross profit and gross margin
- Operating expenses
- Operating result
- Unsettled Razorpay balance
- Open reconciliation issues
- COD cash variance

Charts and tables:

- Revenue, COGS, and gross profit trend
- Payment-method mix
- Store comparison
- Product contribution margin
- Expense breakdown
- Recent exceptions requiring action

Every number must support drill-down from aggregate -> journal/source transaction -> order/payment/expense. Tooltips must define the metric, and empty/partial data must be explicit rather than silently shown as zero.

### 7.5 Accessibility and UX acceptance

- Tables are keyboard navigable and have labelled filters/actions.
- Status is never communicated by color alone.
- Financial numbers use tabular numerals, explicit signs, INR grouping, and consistent negative formatting.
- Destructive/irreversible actions show the amount, store, source, and consequence in confirmation UI.
- Long-running export, settlement sync, and pay-run calculations expose progress and safe retry behavior.

## 8. Authorization and segregation of duties

Extend store permissions with:

```text
finance.overview.read
finance.sales.read
finance.expenses.read
finance.expenses.create
finance.expenses.approve
finance.expenses.pay
finance.refunds.create
finance.refunds.approve
finance.cash.manage
finance.settlements.read
finance.reconciliation.manage
finance.ledger.read
finance.ledger.post
finance.period.close
payroll.read
payroll.manage
payroll.calculate
payroll.approve
payroll.pay
```

Recommended role treatment:

- Platform admin: consolidated access, configuration, exceptional period reopen; no automatic payroll data access in a real deployment.
- Store manager: operational finance and expense approval, but not both expense creation and payment by default.
- Operator: COD session actions and order/payment lookup only.
- Inventory staff: product-cost visibility only if separately granted.
- Add `finance_manager` and `payroll_manager` roles, or migrate from fixed role maps to permission grants if custom combinations are needed.

High-risk actions require recent authentication and always write a success/failure/denial audit event. Cross-store resource access should return the existing not-found behavior to avoid leaking resource existence. OWASP’s API guidance specifically highlights object-level authorization risk, which is directly relevant to store-scoped financial endpoints.

## 9. Delivery roadmap

The order below reduces migration risk and ensures each milestone is demonstrable.

### Immediate PR — truthful dashboard

Deliver the Section 2.3 GOV rename/filter and its regression tests first. It is small, independently useful, and prevents known misleading output while the larger overhaul is in progress.

### Phase 0 — Decisions, terminology, and fixtures

Deliverables:

- ADR-001 Money representation and rounding
- ADR-002 Revenue/COGS recognition and refunds
- ADR-003 Ledger accounts and posting rules
- ADR-004 Tax-inclusive demo calculation, rule versioning, and compliance disclaimer
- ADR-005 Store timezone, business day, and Indian financial-year handling
- State-transition diagrams for order, payment attempt, refund, expense, settlement, cash session, pay run, and journal
- API compatibility/deprecation map for the existing dashboard, coupon-validation, order, and payment endpoints
- Characterization tests and decomposition plan for `payment-reconciliation.service.ts`
- Deterministic seed scenario covering two stores and two reporting months

Exit criteria:

- Every KPI has a written formula and inclusion/exclusion policy.
- Seed scenario has hand-calculated expected order, collection, refund, COGS, expense, payroll, and P&L totals.

### Phase 1 — Exact money and order financial truth

Deliverables:

- New shared money primitives and boundary serializers
- Add paise columns alongside legacy rupee columns
- Backfill using deterministic rounding; generate a migration discrepancy report
- Persist full order/item/customization pricing snapshots
- Change `createOrderSnapshot` to persist `subtotalPaise`, `discountPaise`, and `grandTotalPaise` directly; rupee conversion is presentation-only
- Replace both coupon-validation paths with one shared paise-based policy used by preview and checkout
- Model delivery fees end to end
- Replace the global `delivery_price` singleton with effective-dated store delivery-pricing configuration
- Add effective-dated demo tax rules and persist inclusive-tax breakdown snapshots
- Central server quote endpoint used by checkout UI
- Remove checkout/cart client-side discount and total calculation; render the versioned server quote
- Migrate order status `delievered` to `delivered` and introduce `out_for_delivery` as described in Section 10
- Dual-read comparison instrumentation, then cut reads to paise columns

Exit criteria:

- No financial calculation uses `real`, `doublePrecision`, or unvalidated JavaScript floats.
- Browser and server quote mismatch cannot place an incorrectly priced order.
- Coupon preview and final checkout use the same policy and return the same result.
- Order totals satisfy database/application invariants for normal, customized, discounted, and zero-total cases.
- Inclusive tax, discount allocation, and rounding fixtures reconcile exactly to the stored order total.
- Legacy backfill variance is zero or documented per row.

### Phase 2 — Payment attempts, refunds, and settlements

Deliverables:

- One-to-many payment attempts with compatibility adapter for existing flows
- Decompose payment reconciliation behind the Phase 0 characterization tests before adding settlement matching
- Refund aggregate with full and partial refund UI
- Provider-agnostic refund/webhook/reconciliation handling, with the existing Razorpay adapter retained
- Deterministic local payment-provider simulator for successful, failed, delayed, duplicate, and out-of-order events
- Settlement batch/line fixture import and matching engine; optional Razorpay test-mode sync behind configuration
- Reconciliation issue queue with resolution audit
- Expand webhook inbox to preserve all relevant payment/refund/settlement event states

Exit criteria:

- Duplicate initiation/webhook/refund requests have one financial effect.
- Total processed refunds never exceed captured funds under concurrent requests.
- A captured payment can be traced to a settlement line and bank net amount, including fee/tax components.
- Failed and pending refunds remain visible and retry/reconcile safely.

### Phase 3 — COD cash, standard COGS, vendors, and expenses

Deliverables:

- Cash sessions and movements tied to COD delivery confirmation
- Effective-dated standard product cost and order-item cost snapshot
- Expense/vendor/category workflow with private attachments
- Approval and payment permissions with thresholds
- Store operating expense and margin screens
- Emit versioned financial outbox events for COD, COGS, and expense transitions from the start; retain them for replay by the Phase 4 posting engine

Exit criteria:

- Every delivered COD order appears in one cash session.
- Expected cash can be regenerated from source movements and variance is explicit.
- Historical gross margin does not change when a current product cost changes.
- A posted expense cannot be edited; void/reversal produces complete history.
- Phase 3 source records and events satisfy the Phase 4 posting contracts, avoiding a later workflow retrofit.

### Phase 4 — Ledger and posting engine

Deliverables:

- Chart of accounts, journals, lines, fiscal periods
- Typed posting rules for order delivery, cancellation/refund, COD collection, Razorpay capture/settlement, expense, and payroll
- Transactional outbox and idempotent posting worker/command
- Trial balance and source drill-down
- Manual adjustment journal with strict permissions and reversal

Exit criteria:

- Database/service rejects unbalanced entries.
- Replaying all outbox events creates no duplicate journals.
- Trial balance is zero for every store/currency/period fixture.
- Closed periods reject new backdated postings; authorized reopen is audited.
- Rebuilding projections from journals reproduces expected reports.

### Phase 5 — Finance reporting and portfolio polish

Deliverables:

- Finance overview, P&L, sales/margin, payments/refunds, settlement, and variance reports
- Store vs consolidated filters and comparable prior-period logic
- Drill-down and CSV export
- Report query indexes/materialized projections where measurement proves necessary
- Data freshness, last reconciliation, partial-data, and definition tooltips
- Update architecture, schema, API reference, setup, seed, and runbooks

Exit criteria:

- Hand-calculated seed fixture equals every report and export.
- Cancelled/failed/unpaid orders do not appear as recognized revenue.
- Aggregate -> journal -> source drill-down works without cross-store leaks.
- Representative 12-month report query meets an agreed performance budget.

### Phase 6 — Payroll-lite

Deliverables:

- Employee finance profiles and effective-dated compensation
- Draft/calculate/approve/pay/post pay-run workflow
- Gross-to-net statement and employer-cost reporting
- Ledger postings and reversals
- Salary-specific permissions, masking, audit, and retention rules

Exit criteria:

- Compensation changes affect only applicable future periods.
- Recalculation is deterministic while draft and impossible after posting without reversal.
- No user lacking explicit payroll permission can infer employee compensation via list, detail, export, logs, or aggregate endpoints.
- UI and documentation clearly identify statutory calculations as out of scope unless separately implemented and reviewed.

### Phase 7 — Optional India-style demo invoicing

The core tax calculation and snapshots are already established in Phase 1. This optional phase adds presentation and document workflow without pretending to be a government integration.

Deliverables:

- Fictional owner-business/store tax profile and visibly demo registration details
- HSN/SAC and effective-dated tax rules
- Sequential invoice numbers unique within the chosen legal entity/financial year
- Immutable invoice snapshot and credit note linked to refunds
- Customer invoice download and tax summary report
- Persistent `Portfolio demo — not a statutory tax invoice` marking

CBIC Rule 46 guidance includes invoice particulars such as supplier/recipient details where applicable, serial number, date, HSN/SAC, description, value, tax rate/amount, and place of supply. Treat this as researched product guidance, not a claim that the portfolio system is filing-ready.

## 10. Migration and rollout strategy

Use an expand/backfill/verify/switch/contract sequence; do not replace all money fields in one migration.

1. **Expand**: add nullable paise/snapshot columns and new tables without changing old reads.
2. **Dual write**: write legacy and new columns temporarily from one calculation path.
3. **Backfill**: convert historical values in bounded batches; record source value, result, and discrepancy.
4. **Verify**: compare order totals, payment amounts, item sums, discounts, and dashboard aggregates.
5. **Switch**: enable new reads behind a feature flag by environment/store.
6. **Observe**: monitor mismatches, posting lag, unbalanced attempts, webhook failures, and reconciliation issues.
7. **Contract**: make new columns non-null, remove dual writes, then remove legacy floating columns in a later release.

Specific compatibility decisions:

- Do not rewrite historical orders from current catalog prices.
- Backfill missing subtotal as `legacy total + legacy discount` only when that is provably the old formula; mark tax/delivery/cost as unknown rather than inventing precision.
- Preserve the existing payment and webhook IDs during payment-table evolution.
- Support the misspelled `delievered` value during rollout, migrate it to `delivered`, then remove compatibility code.
- Create a database backup/restore rehearsal and a down/forward recovery runbook before destructive column removal.

### 10.1 Order-status migration

Treat status cleanup as an explicit migration because delivery is the revenue/COGS recognition trigger.

Target flow:

```text
awaiting_payment -> pending -> preparing -> out_for_delivery -> delivered
          |             |           |               |
          +-------------+-----------+---------------+-> cancelled (subject to fulfilment policy)
```

Rollout:

1. Expand TypeScript/Zod/database checks to accept legacy `delievered`, canonical `delivered`, and `out_for_delivery`.
2. Make API responses normalize legacy rows to `delivered` while writes use only canonical values.
3. Backfill historical `delievered` rows in one explicit migration and verify counts before/after.
4. Temporarily allow `preparing -> delivered` for in-flight compatibility, but make the UI use `preparing -> out_for_delivery -> delivered`.
5. Record COD collection and revenue/COGS only on `delivered`, never on `out_for_delivery`.
6. Remove legacy spelling and direct-transition compatibility after old clients/data are gone.
7. Test every allowed/denied transition and confirm financial events fire once at the canonical delivery boundary.

## 11. Testing strategy

### 11.1 Unit/property tests

- Money parsing, overflow, allocation remainder, negative restrictions, and rounding boundaries
- Quote totals and coupon allocation across multiple quantities/customizations
- Shared coupon policy parity between preview and final checkout
- Tax-inclusive calculations, line allocation, and demo rule-version selection
- Order-status compatibility and canonical transition behavior
- Posting-rule balance for every event and reversal
- Effective-date cost and compensation selection
- Period and timezone boundary behavior, including 31 March/1 April

Use property-based tests for invariants such as:

```text
sum(allocations) = source amount
sum(debits) = sum(credits)
processed refunds <= captured amount
grand total = tax-inclusive subtotal - tax-inclusive discount + tax-inclusive delivery + rounding
new journal + reversal journal has zero net account effect
```

### 11.2 Integration and concurrency tests

- Order + outbox atomicity
- Duplicate webhook delivery and out-of-order provider events
- Two simultaneous partial refunds
- Expense approval vs void race
- Two workers posting the same event
- Closing a fiscal period while a backdated post is attempted
- Cash session close vs late COD collection
- Store-scoped authorization on every list, detail, export, and mutation endpoint

Prefer PostgreSQL-backed integration tests for locks, constraints, and transaction behavior; mocks cannot prove these properties.

### 11.3 Frontend tests

Add Vitest + React Testing Library and a small Playwright end-to-end suite:

- Money formatting and negative values
- Filter/query synchronization and prior-period labels
- Permission-driven navigation and action visibility
- Refund/expense/pay-run confirmation summaries
- Rendering the authoritative server quote without client-side total recomputation
- Empty, loading, stale, partial, and error states
- Keyboard flow and accessible names
- E2E: Razorpay test payment -> delivery -> settlement fixture -> P&L drill-down
- E2E: COD order -> cash session -> close with variance
- E2E: expense -> approval -> payment -> journal

### 11.4 Reconciliation tests

For the deterministic seed dataset, keep a checked-in expected-results file containing:

- Per-order total breakdown
- Collections by method
- Refund totals
- Settlement gross/fees/tax/net
- Revenue, COGS, and gross profit
- Expenses and payroll employer cost
- Account balances and trial balance

CI fails when computed results diverge.

## 12. Observability, security, and operations

Metrics:

- Financial outbox age and retry count
- Posting failures and duplicate-event suppression
- Unbalanced journal attempts (should always be zero accepted)
- Pending/failed refunds by age
- Unsettled captured amount by age
- Settlement match rate and variance
- Open cash sessions and cash variance
- Report generation latency and freshness
- Closed-period mutation attempts

Structured logs should contain request/event/source IDs, store ID, outcome, duration, and safe amount metadata. Do not log webhook secrets, signatures, bank details, tax identifiers, full provider payloads, or payroll-sensitive fields.

Operational runbooks:

- Retry/dead-letter financial event
- Investigate ledger/source mismatch
- Reconcile Razorpay settlement variance
- Resolve stuck/failed refund
- Close/reopen fiscal period
- Correct a posted expense or payroll run through reversal
- Recover from failed money migration

Razorpay recommends webhooks for asynchronous automation, API verification for critical immediate flows, signature validation, idempotent duplicate handling, and monitoring of captures, refunds, disputes, and settlements. Its refund guidance also notes that final refund state can be asynchronous, which supports modeling refunds as their own lifecycle rather than a boolean or single payment status.

## 13. Portfolio presentation

The finished project should make engineering decisions easy to inspect:

- A short architecture page showing operational domains, outbox, ledger, and reports
- ADRs for money, recognition, ledger, and tax boundaries
- Seeded two-store demo with intentionally interesting cases: discount, partial refund, failed attempt, settlement fee, COD variance, expense allocation, salary change, and period close
- A one-command demo reset/seed flow
- Screenshots or a short walkthrough that starts with a transaction and drills into its P&L/ledger effect
- A “limitations and production hardening” section that openly identifies compliance, scaling, and accounting-review boundaries
- CI badges/results for backend, frontend, integration, migration, and reconciliation tests

The strongest portfolio narrative is not “I built accounting software.” It is: **“I designed an auditable store-finance subledger around an existing commerce system, defined financial semantics, migrated unsafe money fields, handled asynchronous payment/refund/settlement lifecycles, enforced double-entry invariants, and proved reports against deterministic fixtures.”**

### 13.1 Hiring conversations enabled by each milestone

| Milestone | Engineering discussion it demonstrates |
| --- | --- |
| Immediate GOV fix | Distinguishing product labels from data semantics; shipping a safe correction before a rewrite |
| Phase 0 | Converting ambiguous finance requirements into ADRs, invariants, transition diagrams, and deterministic fixtures |
| Phase 1 | Floating-point money, authoritative server pricing, backward-compatible migrations, rounding/allocation, and contract rollout |
| Phase 2 | Idempotency, asynchronous/out-of-order webhooks, partial refunds, provider adapters, and reconciliation |
| Phase 3 | Multi-store scoping, effective-dated costs, approval workflows, cash controls, and auditable state machines |
| Phase 4 | Double-entry modeling, transactional outbox, replay safety, immutable correction, and consistency under concurrency |
| Phase 5 | Traceable analytics, metric definitions, aggregation correctness, query performance, and drill-down UX |
| Phase 6 | Sensitive-data authorization, effective-dated compensation, segregation of duties, and operating-cost integration |

For every completed phase, prepare one diagram, one failure scenario, one trade-off rejected, one invariant test, and one measurable outcome. This is more credible in interviews than claiming unfinished breadth.

## 14. Effort and cut line

Approximate solo implementation effort after design decisions:

| Workstream | Focused engineering effort |
| --- | ---: |
| Immediate GOV correction | 1-2 days |
| Phase 0 decisions/fixtures | 2-4 days |
| Exact money + order snapshots + demo tax | 12-16 days |
| Payments/refunds/settlements | 10-15 days |
| COD/costs/expenses | 10-15 days |
| Ledger/posting/periods | 18-25 days |
| Reports/frontend/docs | 10-15 days |
| Payroll-lite | 8-12 days |
| Hardening/E2E/operations | 7-10 days |

For an evenings/weekends portfolio schedule, plan roughly 16-22 weeks for the full core through Phase 5, depending on test depth and UI polish. A strong earlier showcase cut is Phases 0-3: exact money, authoritative snapshots, refunds/reconciliation, cash controls, standard costs, and expenses. The recommended public “v1” still includes a rigorously completed Phase 4 ledger and Phase 5 reporting; a partial ledger should not be presented as finished. Payroll-lite is the first operating-cost extension, followed by demo invoicing and recipe inventory only if the core is polished and tested.

If time is limited, preserve depth in this order:

1. Exact money and immutable order breakdown
2. Correct revenue semantics and refunds
3. Standard costs/expenses and management P&L
4. Ledger with replay/idempotency and drill-down
5. Settlement and COD reconciliation
6. Payroll-lite
7. Demo tax receipt/invoicing and recipe inventory

## 15. Confirmed product decisions

These decisions are based on the project owner's answers and now define the implementation scope.

1. **Business model: owner-operated restaurant, not a marketplace.**  
   The platform admin represents the owner of one fictional legal business operating all PizzaStore locations. Stores are branches, not independent merchants. Therefore there are no merchant commissions, split settlements, store payouts, or merchant payable accounts. The owner sees every store and consolidated results; store staff remain store-scoped.

2. **Tax: tax-inclusive, configurable portfolio simulation.**  
   Implement the demo tax policy in Section 4.3. Keep menu prices customer-friendly and tax-inclusive, snapshot the calculated taxable value and tax per line, and seed effective-dated demo rules. Do not connect to GST portals, generate IRNs, file returns, or claim statutory accuracy. Documents must say `Portfolio demo — not a statutory tax invoice`.

3. **Salary: approved as payroll-lite.**  
   Include confidential per-employee compensation, effective-dated salary changes, pay runs, earning/deduction lines, employer cost, payment status, ledger posting, and payslip-style output. Exclude government filings and claims of TDS/EPF/ESI compliance.

4. **Food cost: standard cost for v1.**  
   Use effective-dated standard unit cost per store product and snapshot it on fulfilled order lines. Ingredient recipes, purchase receiving, yield, and wastage remain a later extension.

5. **Refund authorization: request and approval workflow.**  
   Operators may request a refund. Managers or finance-authorized users approve it, with a configurable amount threshold. Provider calls and financial effects remain idempotent and audited.

6. **COD handling: one cash session per store/business date.**  
   Each delivered COD order enters the store's open cash session. Closing records expected cash, counted cash, and variance; material variance requires owner/manager acknowledgement.

7. **Reporting: both per-store and consolidated.**  
   Because all stores belong to the same owner-business, provide branch-level P&L and an all-store consolidated view. Consolidation is simple summation/elimination of any future inter-store transfers, not marketplace settlement accounting.

8. **Payment environment: deterministic demo first, never live.**  
   The application will not process real funds. Provide a local provider simulator and checked-in settlement/refund fixtures so a recruiter can reproduce successful, failed, delayed, duplicate, refund, and reconciliation scenarios without credentials or network access. Retain the Razorpay adapter and optional test-mode configuration as evidence of a realistic integration, but live mode is explicitly unsupported.

9. **Expenses: receipts and approval included.**  
   Implement private receipt attachment metadata/storage abstraction, draft/submission/approval/payment/posting states, one-step manager approval for the demo, and immutable reversal after posting.

10. **Delivery priority: production-style depth.**  
    Complete the reliable core through Phase 5 before payroll-lite. Forecasting, AI insights, recipe inventory, and statutory integrations remain outside the initial portfolio release until exact-money, ledger, authorization, and reconciliation tests pass.

### Resulting demo persona and story

- **Owner/platform admin:** views consolidated and per-store finance, approves exceptional refunds/expenses, reviews payroll, resolves reconciliation issues, and closes periods.
- **Store manager:** manages daily store finance, standard expenses, refund approvals, and cash-session close within permission limits.
- **Operator:** handles orders, requests refunds, and records COD movements without seeing payroll or the general ledger.
- **Inventory staff:** manages stock and standard-cost inputs only when separately permitted.

The primary recruiter walkthrough is: seed two stores -> place COD and simulated Razorpay orders -> deliver/cancel/refund selected orders -> import a deterministic settlement -> close a COD session -> approve an expense -> run payroll -> inspect store and consolidated P&L -> drill a number into its balanced journal and original source transaction.

## 16. Research basis

Primary and authoritative references used for this plan:

- [PostgreSQL numeric types](https://www.postgresql.org/docs/current/datatype-numeric.html) — exact versus inexact storage and why floating point should not represent authoritative money.
- [Razorpay Standard Checkout integration](https://razorpay.com/docs/developer-tools/integrations/standard-checkout/) — authorization/capture distinction, server verification, webhooks, idempotency, disputes, and settlement monitoring.
- [Razorpay webhook guidance](https://razorpay.com/docs/webhooks/) — asynchronous source-of-truth events and API verification for critical flows.
- [Razorpay refund guidance](https://razorpay.com/docs/payments/refunds/) and [refund FAQ](https://razorpay.com/docs/payments/refunds/faqs/) — partial/full refunds and asynchronous final states.
- [CBIC tax invoice rules](https://cbic-gst.gov.in/gst-invoice-rules.html) — required invoice particulars and credit/debit note considerations.
- [Income Tax Department salary forms guidance](https://www.incometax.gov.in/iec/foportal/help/individual/return-applicable-3) — employer salary TDS documentation context.
- [EPFO FAQ](https://www.epfindia.gov.in/site_en/FAQ.php) and [ESI Act](https://www.esic.gov.in/Publications/ESIAct1948Amendedupto010610.htm) — evidence that payroll contributions carry employer obligations and should not be casually hard-coded.
- [OWASP API Security Top 10](https://owasp.org/API-Security/) — object-level authorization and API security considerations for multi-store financial data.

Before implementing India-specific tax or payroll logic, verify the then-current rules from official sources and obtain qualified review. The links above support architectural scope; they are not legal, tax, or accounting advice.
