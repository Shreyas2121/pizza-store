# Finance API compatibility and rollout map

- Status: Target contract accepted for phased implementation
- Date: 2026-08-31
- Target branch: `feature/financial-overhaul`
- Related documents: [Overhaul plan](../plan.md), [Implementation guide](../guide.md), [ADR-001](adr/0001-money-representation-and-rounding.md), [ADR-002](adr/0002-revenue-cogs-recognition-and-refunds.md), [ADR-003](adr/0003-ledger-accounts-and-posting-rules.md), [ADR-004](adr/0004-tax-inclusive-demo-policy.md), [ADR-005](adr/0005-store-timezone-business-date-financial-year.md), [Finance lifecycle contracts](finance-lifecycle-contracts.md)

---

## 1. Scope and purpose

This document maps how PizzaStore transitions from its legacy commerce contracts to an authoritative, double-entry financial architecture without breaking in-flight workflows or mixing operational and accounting semantics.

Under the fresh database policy, stored records use the final schema without data dual-writes. However, **API contracts and UI interactions require disciplined compatibility**:
- The existing `/api/v1/dashboard` remains operational during the transition.
- Authoritative pricing is centralized behind a single server quote contract used by both coupon preview and final checkout.
- Public order and payment endpoints maintain compatibility while internally adopting exact paise snapshots and payment attempt records.
- All new accounting, reconciliation, cash, expense, ledger, and payroll capabilities are mounted under `/api/v1/finance/*`.
- Access control introduces explicit finance and payroll store roles with actor-level segregation of duties.

---

## 2. Dashboard transition and compatibility

### 2.1 Current operational dashboard (`/api/v1/dashboard`)

The legacy `/api/v1/dashboard` endpoint serves the operations overview page and continues to operate throughout the overhaul:

- **Metric cards (`GET /api/v1/dashboard`)**:
  - `Gross Order Value` (renamed in Q01; sums eligible placed orders, excluding `cancelled` and `awaiting_payment`).
  - `Active Users` (distinct users placing eligible orders).
  - `Total Orders` (count of eligible placed orders).
  - `Average Order Value` (`Gross Order Value / Total Orders`).
  - `Low Stock Items` (real-time inventory threshold alerts).
- **Time-series charts (`GET /api/v1/dashboard/charts`)**:
  - `revenueOverTime` (time-series gross order value trend).
  - `ordersOverTime` (time-series order volume).

### 2.2 Transition strategy

1. **Phase 0–4**: Operational dashboard remains the default admin landing page. Cards and charts display gross order value (GOV) with clear non-accounting semantics.
2. **Phase 5**: New **Finance Workspace** (`/admin/finance/*`) launches, powered exclusively by `/api/v1/finance/*`.
3. **Post-overhaul evolution**: `/api/v1/dashboard` is retained as an operational kitchen/store overview. Financial fields (GOV/AOV) will be formally deprecated in favor of `/api/v1/finance/overview`, while operational order queues, active user counts, and low-stock indicators remain permanent.

---

## 3. Authoritative server quote and checkout consolidation

### 3.1 Problem with legacy checkout calculation

Previously, coupon preview (`coupon.service.ts#validateCoupon`) and checkout calculation (`buildQuote`) performed independent calculations:
- `validateCoupon` compared floating-point rupees.
- `buildQuote` calculated paise, converted to rupees via `paiseToRupees`, and `createOrderSnapshot` wrote floating rupees to `orders.total_price`.
- The frontend recomputed discount percentages and delivery fees in browser JavaScript.

P1.2 centralizes item totals, coupon eligibility, discount rounding/capping, and line allocation in `pricing.service.ts`. The legacy coupon-validation response keeps its existing coupon fields and adds exact quote fields. The public quote endpoint and removal of browser-side calculation remain intentionally scheduled for P1.8.

### 3.2 Target quote contract (`POST /api/v1/checkout/quote`)

All pricing, discount allocation, tax extraction, and delivery fee calculation is centralized in `pricing.service.ts` operating strictly in integer paise.

#### Request: `POST /api/v1/checkout/quote`
```json
{
  "storeId": 1,
  "couponCode": "PIZZA50",
  "items": [
    {
      "productId": 10,
      "quantity": 2,
      "customizationOptionIds": [101, 102]
    }
  ]
}
```

#### Response `200`:
```json
{
  "data": {
    "quoteVersion": "2026-08-31-01",
    "currency": "INR",
    "pricingPolicyVersion": 1,
    "itemsSubtotalPaise": 90000,
    "discountPaise": 10000,
    "deliveryFeePaise": 5000,
    "taxableAmountPaise": 76190,
    "taxPaise": 3810,
    "roundingAdjustmentPaise": 0,
    "grandTotalPaise": 85000,
    "items": [
      {
        "productId": 10,
        "productName": "Margherita Pizza",
        "quantity": 2,
        "unitPricePaise": 45000,
        "lineSubtotalPaise": 90000,
        "discountAllocationPaise": 10000,
        "taxRateBps": 500,
        "taxableAmountPaise": 76190,
        "taxPaise": 3810,
        "lineTotalPaise": 80000,
        "customizations": [
          {
            "customizationOptionId": 101,
            "name": "Extra Cheese",
            "pricePaise": 5000
          }
        ]
      }
    ],
    "coupon": {
      "id": 1,
      "code": "PIZZA50",
      "discountPaise": 10000,
      "applied": true
    },
    "taxRule": {
      "ruleId": 1,
      "taxRateBps": 500,
      "isInclusive": true,
      "disclaimer": "Portfolio demo — not a statutory tax invoice"
    }
  }
}
```

### 3.3 Parity rule

- **Coupon preview (`POST /api/v1/coupons/validate`)**: Calls `pricing.service.ts#buildQuote` internally and returns the verified discount in paise and formatted presentation INR.
- **Final checkout (`POST /api/v1/checkout`)**: Verifies the submitted quote or recalculates via `pricing.service.ts` in the database transaction, writes immutable paise snapshots, and consumes inventory reservations atomically.
- The frontend renders values directly from the server quote response; browser JavaScript never computes totals, taxes, or discounts.

---

## 4. Existing order and payment compatibility

### 4.1 Order status canonicalization

| Legacy spelling | Canonical status | Description | Recognition trigger |
| --- | --- | --- | --- |
| `awaiting_payment` | `awaiting_payment` | Online payment initiated, awaiting capture | No |
| `pending` | `pending` | Placed order (online captured or COD) | No |
| `preparing` | `preparing` | Kitchen in progress | No |
| N/A | `out_for_delivery` | Rider dispatched (operational milestone) | No |
| `delievered` (misspelled) | `delivered` | Successfully delivered to customer | **Yes (Revenue & COGS recognized once)** |
| `cancelled` | `cancelled` | Order cancelled | Reversal if previously recognized |

- API responses return canonical `delivered` and `out_for_delivery`.
- Delivery recognition fires strictly once upon transitioning to `delivered`.

### 4.2 Order response DTOs

Existing endpoints `GET /api/v1/orders` and `GET /api/v1/orders/:id` map internal integer paise snapshots to backward-compatible presentation formats:
- `itemsSubtotalPaise`, `discountPaise`, `deliveryFeePaise`, `taxPaise`, `grandTotalPaise` are exposed alongside formatted `totalPrice` (`₹850.00`).
- No client breaks; newer clients consume exact paise integer fields.

### 4.3 Payments and payment attempts

- Orders transition from a 1:1 `orders.payment_id` column to a 1:N `payment_attempts` aggregate.
- `POST /api/v1/payments/create-order` creates a new `payment_attempts` row with `provider = 'razorpay'`, `status = 'pending'`, and unique idempotency key.
- `POST /api/v1/payments/verify` verifies Razorpay signatures and transitions the specific attempt to `captured`.
- Payment retries generate additional attempt rows under the same `orderId` without altering order identity.

---

## 5. New `/api/v1/finance/*` endpoint contracts

All financial endpoints require authentication (`authenticateUser`), store-scoped authorization, and adhere to standard REST error shapes.

### 5.1 Overview and management reports

```text
GET /api/v1/finance/overview
GET /api/v1/finance/profit-and-loss
GET /api/v1/finance/sales
GET /api/v1/finance/margins
GET /api/v1/finance/exports/:reportType
```

#### `GET /api/v1/finance/overview`
- **Query params**: `from` (ISO date), `to` (ISO date), `storeId` (optional for platform admin, required for store staff).
- **Response `200`**:
```json
{
  "data": {
    "policy": {
      "currency": "INR",
      "timezone": "Asia/Kolkata",
      "dateBasis": "journal_business_date",
      "recognitionBasis": "delivery",
      "includedJournalStatuses": ["posted", "reversed"],
      "generatedAt": "2026-08-31T12:00:00.000Z",
      "lastReconciledAt": "2026-08-30T10:30:00.000Z",
      "payrollCostVisibility": "detailed",
      "scope": { "kind": "store", "storeIds": [1] }
    },
    "kpis": {
      "recognizedRevenuePaise": 15000000,
      "collectionsPaise": 16200000,
      "refundsPaise": 450000,
      "cogsPaise": 5400000,
      "grossProfitPaise": 9600000,
      "grossMarginBps": 6400,
      "operatingExpensesPaise": 2800000,
      "payrollCostPaise": 3500000,
      "operatingProfitPaise": 3300000,
      "unsettledRazorpayPaise": 1200000,
      "openReconciliationIssues": 0,
      "cashVariancePaise": 0
    },
    "drillDownUrls": {
      "revenue": "/api/v1/finance/ledger/journals?accountCode=4010",
      "cogs": "/api/v1/finance/ledger/journals?accountCode=5010",
      "expenses": "/api/v1/finance/expenses",
      "refunds": "/api/v1/finance/refunds"
    }
  }
}
```

`lastReconciledAt` is the latest `reconciledAt` timestamp from a successfully reconciled Razorpay settlement in the selected store scope. It is independent of the requested report date range and is `null` when no settlement in that scope has reached `reconciled` status. The same policy metadata is returned by overview, P&L, sales, and margins and is embedded in their CSV exports.

Payroll employer-cost aggregates have a second authorization boundary. A store report exposes exact `payrollCostPaise` only when the actor has both the applicable finance-report permission and `payroll.read`; platform administrators retain exact store and consolidated values. Otherwise `payrollCostVisibility` is `suppressed`, `payrollCostPaise` and the derived `operatingResultPaise` are `null` in current, comparison, and grouped data, the payroll drill-down is absent, and CSV cells are blank. Suppressing the derived result prevents reconstructing payroll by subtracting known revenue, COGS, and non-payroll operating expenses. Employer cost may include earning, deduction, and employer-cost components and is not necessarily take-home pay.

#### `GET /api/v1/finance/profit-and-loss`
- **Query params**: `from`, `to`, `storeId`, `groupBy` (`month` | `quarter` | `fiscal_year`).
- **Response `200`**: Returns multi-period income statement (Revenue, Cost of Goods Sold, Gross Profit, Operating Expenses by category, Payroll Cost, Net Operating Profit).

---

### 5.2 General ledger and fiscal periods

```text
GET  /api/v1/finance/ledger/accounts
GET  /api/v1/finance/ledger/journals
GET  /api/v1/finance/ledger/journals/:id
GET  /api/v1/finance/ledger/trial-balance
POST /api/v1/finance/ledger/manual-journals
POST /api/v1/finance/ledger/journals/:id/reverse
GET  /api/v1/finance/ledger/periods
POST /api/v1/finance/ledger/periods
POST /api/v1/finance/ledger/periods/:id/soft-close
POST /api/v1/finance/ledger/periods/:id/close
POST /api/v1/finance/ledger/periods/:id/reopen
```

#### `GET /api/v1/finance/ledger/trial-balance`
- **Query params**: `storeId`, `periodId` or `asOfDate`.
- **Response `200`**:
```json
{
  "data": {
    "storeId": 1,
    "asOfDate": "2026-08-31",
    "totalDebitPaise": 24500000,
    "totalCreditPaise": 24500000,
    "isBalanced": true,
    "accounts": [
      {
        "accountCode": "1010",
        "accountName": "Cash on Hand",
        "type": "asset",
        "debitPaise": 1500000,
        "creditPaise": 0,
        "netBalancePaise": 1500000
      },
      {
        "accountCode": "4010",
        "accountName": "Sales Revenue",
        "type": "revenue",
        "debitPaise": 0,
        "creditPaise": 15000000,
        "netBalancePaise": -15000000
      }
    ]
  }
}
```

#### `POST /api/v1/finance/ledger/manual-journals`
- **Headers**: `Idempotency-Key: <uuid>`
- **Body**:
```json
{
  "storeId": 1,
  "businessDate": "2026-08-31",
  "description": "Correction of store opening petty cash discrepancy",
  "lines": [
    { "accountCode": "1010", "debitPaise": 5000, "creditPaise": 0, "description": "Cash adjustment" },
    { "accountCode": "6090", "debitPaise": 0, "creditPaise": 5000, "description": "Cash Over/Short offset" }
  ]
}
```

---

### 5.3 Refunds and settlements

```text
GET  /api/v1/finance/refunds
GET  /api/v1/finance/refunds/stuck
POST /api/v1/finance/refunds/reconcile
POST /api/v1/finance/orders/:orderId/refunds
POST /api/v1/finance/refunds/:id/approve
POST /api/v1/finance/refunds/:id/reject
POST /api/v1/finance/refunds/:id/retry
GET  /api/v1/finance/settlements
GET  /api/v1/finance/settlements/:id
POST /api/v1/finance/settlements/import
GET  /api/v1/finance/reconciliation/issues
POST /api/v1/finance/reconciliation/issues/:id/resolve
```

#### `POST /api/v1/finance/orders/:orderId/refunds`
- **Headers**: `Idempotency-Key: <uuid>`
- **Body**:
```json
{
  "reasonCode": "customer_cancellation",
  "reasonNote": "Customer changed mind before dispatch",
  "amountPaise": 45000,
  "allocations": [
    { "orderItemId": 12, "quantity": 1, "allocatedPaise": 40000 },
    { "type": "delivery_fee", "allocatedPaise": 5000 }
  ]
}
```

#### `POST /api/v1/finance/settlements/import`

Checked-in fixture import (credential-free and idempotent by provider settlement ID plus payload hash):

```json
{
  "source": "fixture",
  "providerSettlementId": "set_m1_s1_001"
}
```

Optional Razorpay Test Mode batch sync:

```json
{
  "source": "test_provider",
  "storeId": 1,
  "providerSettlementId": "set_test_provider_id"
}
```

Fixture imports include transaction lines. Test-provider batch sync imports the provider aggregate;
transaction-level provider matching remains part of P2.9.

---

### 5.4 Cash management

```text
GET  /api/v1/finance/cash/sessions
GET  /api/v1/finance/cash/sessions/:id
POST /api/v1/finance/cash/sessions
POST /api/v1/finance/cash/sessions/:id/movements
POST /api/v1/finance/cash/sessions/:id/close
POST /api/v1/finance/cash/sessions/:id/reopen
POST /api/v1/finance/cash/movements/:id/reverse
```

#### `POST /api/v1/finance/cash/sessions/:id/close`
- **Headers**: `Idempotency-Key: <uuid>`
- **Body**:
```json
{
  "countedCashPaise": 185000,
  "closingNotes": "End of day shift close. Matched expected float."
}
```

---

### 5.5 Standard costs, vendors, and expenses

```text
GET  /api/v1/finance/costs/products
POST /api/v1/finance/costs/products
GET  /api/v1/finance/vendors
POST /api/v1/finance/vendors
PUT  /api/v1/finance/vendors/:id
GET  /api/v1/finance/expenses/categories
POST /api/v1/finance/expenses/categories
GET  /api/v1/finance/expenses
GET  /api/v1/finance/expenses/:id
POST /api/v1/finance/expenses
PUT  /api/v1/finance/expenses/:id
POST /api/v1/finance/expenses/:id/submit
POST /api/v1/finance/expenses/:id/approve
POST /api/v1/finance/expenses/:id/reject
POST /api/v1/finance/expenses/:id/pay
POST /api/v1/finance/expenses/:id/post
POST /api/v1/finance/expenses/:id/void
POST /api/v1/finance/expenses/:id/reverse
GET  /api/v1/finance/expenses/:id/attachments
POST /api/v1/finance/expenses/:id/attachments
GET  /api/v1/finance/expenses/:id/attachments/:attachmentId
GET  /api/v1/finance/source-margin
```

---

### 5.6 Payroll-lite (operating cost)

```text
GET  /api/v1/finance/payroll/profiles
GET  /api/v1/finance/payroll/profiles/:id
POST /api/v1/finance/payroll/profiles
PUT  /api/v1/finance/payroll/profiles/:id
GET  /api/v1/finance/payroll/profiles/:id/compensation
POST /api/v1/finance/payroll/profiles/:id/compensation
GET  /api/v1/finance/payroll/pay-runs
GET  /api/v1/finance/payroll/pay-runs/:id
GET  /api/v1/finance/payroll/pay-runs/:id/export
POST /api/v1/finance/payroll/pay-runs
POST /api/v1/finance/payroll/pay-runs/:id/calculate
POST /api/v1/finance/payroll/pay-runs/:id/approve
POST /api/v1/finance/payroll/pay-runs/:id/pay
POST /api/v1/finance/payroll/pay-runs/:id/post
POST /api/v1/finance/payroll/pay-runs/:id/void
POST /api/v1/finance/payroll/pay-runs/:id/reverse
GET  /api/v1/finance/payroll/pay-runs/:id/statements/:employeeId
```

Pay-run creation and every lifecycle command require an `Idempotency-Key` UUID. Calculation is deterministic and draft-only, and records immutable employee/component snapshots. Approval and payment enforce separate actors plus recent authentication. List, detail, statement, and export remain behind `payroll.read`; cross-store and missing records are both returned as `404`, and exports/statements omit payment references and sensitive identifiers. Posting and exact reversal use the transactional finance outbox and balanced ledger kernel.

---

## 6. Stable error codes

All endpoints return uniform error payloads with stable machine-readable codes:

```json
{
  "status": "error",
  "code": "PERIOD_CLOSED",
  "message": "Fiscal period for 2026-07 is closed and does not permit backdated posting.",
  "statusCode": 400
}
```

### Canonical error dictionary

| Error Code | HTTP Status | Trigger condition |
| --- | --- | --- |
| `PERIOD_CLOSED` | 400 | Attempted posting into a soft-closed or closed fiscal period |
| `JOURNAL_UNBALANCED` | 422 | Total debits do not equal total credits in a posting command |
| `REFUND_EXCEEDS_CAPTURED_AMOUNT` | 422 | Sum of processed + requested refunds exceeds captured payment amount |
| `INVALID_STATE_TRANSITION` | 409 | Aggregate state transition is disallowed by state machine |
| `DUPLICATE_IDEMPOTENCY_KEY` | 409 | Concurrent or conflicting payload with an existing idempotency key |
| `STALE_QUOTE_VERSION` | 409 | Order checkout quote has expired or underlying prices changed |
| `TAX_RULE_NOT_FOUND` | 422 | No valid tax rule found for effective business date |
| `COST_VERSION_OVERLAP` | 422 | Proposed standard cost effective dates overlap an existing cost version |
| `PAYROLL_PROFILE_CONFLICT` | 409 | Employee code or linked user is already assigned within the store |
| `PAYROLL_ENCRYPTION_NOT_CONFIGURED` | 503 | Sensitive payroll metadata was supplied without a dedicated encryption key |
| `COMPENSATION_VERSION_OVERLAP` | 422 | Proposed compensation dates overlap an existing employee version |
| `COMPENSATION_DEDUCTIONS_EXCEED_EARNINGS` | 422 | Recurring employee deductions exceed recurring earnings |
| `PAY_RUN_PERIOD_CONFLICT` | 409 | A monthly pay run already exists for the store and period |
| `PAY_RUN_INVALID_STATE` | 409 | Pay-run command is not allowed from the current lifecycle state |
| `PAY_RUN_NO_ELIGIBLE_EMPLOYEES` | 422 | No active employee finance profiles overlap the pay period |
| `PAY_RUN_COMPENSATION_MISSING` | 422 | An eligible employee has no compensation effective at period end |
| `PAY_RUN_SEGREGATION_VIOLATION` | 403 | Drafter/calculator attempted approval, or drafter/calculator/approver attempted payment |
| `RECENT_AUTHENTICATION_REQUIRED` | 401 | A high-risk payroll command requires authentication within the last 15 minutes |
| `SEGREGATION_OF_DUTIES_VIOLATION` | 403 | Actor attempted self-approval or forbidden dual action (e.g. create + approve expense) |
| `STORE_SCOPE_MISMATCH` | 404 | Resource belongs to a different store (masked as 404 to prevent resource existence disclosure) |
| `ACTIVE_CASH_SESSION_EXISTS` | 409 | Attempted opening a second cash session for the same store and date |
| `PAY_RUN_ALREADY_POSTED` | 409 | Attempted mutation of an approved/posted pay run without reversal |

---

## 7. Role-permission matrix and segregation of duties

### 7.1 Role definitions

1. **`platform_admin`**: Platform owner; consolidated view across all stores; period close/reopen; exceptional approvals; master configuration.
2. **`store_manager`**: Operational management of assigned store; inventory, orders, daily cash close, standard expense approval, refund approval up to threshold.
3. **`finance_manager`**: Store financial accountant; ledger inspection, expense verification/payment, settlement reconciliation, manual journals, financial statement review.
4. **`payroll_manager`**: Restricted compensation manager; employee financial profile creation, salary versioning, pay-run calculation, payslip access.
5. **`operator`**: Front-of-house kitchen/order operations; order status updates, COD cash collection movements, refund requests.
6. **`inventory_staff`**: Stock room and ingredients management; stock counts, wastage records, standard cost reads (when permitted).

### 7.2 Permission matrix

| Permission | `platform_admin` | `store_manager` | `finance_manager` | `payroll_manager` | `operator` | `inventory_staff` |
| --- | :---: | :---: | :---: | :---: | :---: | :---: |
| `dashboard.operations.read` | Yes | Yes | Yes | No | Yes | Yes |
| `dashboard.finance.read` | Yes | Yes | Yes | No | No | No |
| `finance.overview.read` | Yes | Yes | Yes | No | No | No |
| `finance.sales.read` | Yes | Yes | Yes | No | No | No |
| `finance.expenses.read` | Yes | Yes | Yes | No | No | No |
| `finance.expenses.create` | Yes | Yes | Yes | No | No | No |
| `finance.expenses.approve` | Yes | Yes (threshold) | Yes | No | No | No |
| `finance.expenses.pay` | Yes | No | Yes | No | No | No |
| `finance.refunds.create` | Yes | Yes | Yes | No | Yes | No |
| `finance.refunds.approve` | Yes | Yes (threshold) | Yes | No | No | No |
| `finance.cash.manage` | Yes | Yes | Yes | No | Yes (movements) | No |
| `finance.settlements.read` | Yes | Yes | Yes | No | No | No |
| `finance.reconciliation.manage` | Yes | No | Yes | No | No | No |
| `finance.ledger.read` | Yes | No | Yes | No | No | No |
| `finance.ledger.post` | Yes | No | Yes | No | No | No |
| `finance.period.close` | Yes | No | No | No | No | No |
| `finance.costs.manage` | Yes | Yes | Yes | No | No | Yes (read) |
| `payroll.read` | Yes | No | No | Yes | No | No |
| `payroll.manage` | Yes | No | No | Yes | No | No |
| `payroll.calculate` | Yes | No | No | Yes | No | No |
| `payroll.approve` | Yes | No | No | Yes | No | No |
| `payroll.pay` | Yes | No | No | Yes | No | No |

---

### 7.3 Actor-level segregation of duties

Role membership alone is necessary but **not sufficient** to execute high-risk operations. The following actor-level constraints are enforced in domain policies:

1. **Expense approval**: An actor cannot approve an expense they created (`expense.createdBy !== actor.userId`).
2. **Expense payment**: An actor cannot pay an expense they created or approved (unless platform admin override is explicitly audited).
3. **Refund approval**: An actor cannot approve a refund they requested.
4. **Pay-run approval**: An actor who calculated or drafted a pay run cannot be the sole approver.
5. **Pay-run payment**: An actor who drafted, calculated, or approved a pay run cannot mark it paid.
6. **Cross-store masking**: If a user attempts to access a financial resource (e.g. `/finance/expenses/:id`) belonging to a store where they lack active membership, the system returns `404 Not Found` (never `403 Forbidden`) to eliminate object-enumeration risks per OWASP API Security standards.
7. **Privacy boundary**: Non-payroll roles (including store and finance managers) are prevented from seeing compensation rates, employee bank details, detailed statements, exact payroll employer-cost aggregates, or payroll-derived operating results in any API response or export.
8. **High-risk audit boundary**: Successful sensitive mutations are audited in their transaction. Denied and failed refund, expense approval/payment, settlement resolution, fiscal-period, manual-journal, compensation, and pay-run commands persist a separate safe attempt row with the request ID and stable reason code. Missing and cross-store resources retain identical `404` responses, and a required audit-write failure fails closed.

---

## 8. Summary of rollout checklist

- [x] Operational dashboard maintains Gross Order Value semantics (Q01).
- [x] Phase 0.6 introduces `finance_manager` and `payroll_manager` store roles and the permission foundation.
- [x] Phase 1 introduces `pricing.service.ts`, server quote endpoint, and canonical `delivered`/`out_for_delivery` lifecycle.
- [x] Phase 2 decomposes payment reconciliation and introduces payment attempts, refunds, and settlement reconciliation.
- [x] Phase 3 establishes cash sessions, standard product costs, vendors, and expenses.
- [x] Phase 4 implements the general ledger posting kernel, fiscal periods, and trial balance.
- [x] Phase 5 builds the owner Finance Workspace, management reports, drill-down, and CSV exports.
- [x] Phase 6 adds restricted payroll-lite profiles, effective compensation, pay runs, statements, and reversible ledger-backed operating cost.
- [x] High-risk finance/payroll success, denial, and terminal failure outcomes have append-only request-correlated audit evidence with sensitive-data redaction.
