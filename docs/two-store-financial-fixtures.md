# Deterministic two-store financial fixtures

C14 adds a separate promotion benchmark without changing the historical July/August expected totals. [`promotion-reconciliation.fixtures.ts`](../backend/src/fixtures/promotion-reconciliation.fixtures.ts) passes production recognition, posting validation and report projection across two stores for automatic offers/free delivery, manual coupons, and bundle markdown/free delivery. Expected platform tax-exclusive recognized revenue is respectively 27,000, 37,000 and 30,000 paise; item contra-revenue is 3,000, 3,000 and zero. The platform equals the sum of store reports, with no second discount. The offline `finance:reconcile-fixture` command executes both benchmarks. This is fixture evidence, not live ledger reconciliation; see [C14 handoff](promotions-c14-handoff.md).

- Status: Reference benchmark accepted for verification and seeding
- Date: 2026-08-31
- Target branch: `feature/financial-overhaul`
- Source code fixtures: [`backend/src/fixtures/financial-scenario.fixtures.ts`](../backend/src/fixtures/financial-scenario.fixtures.ts)
- Related documents: [Overhaul plan](../plan.md), [Implementation guide](../guide.md), [ADR-001](adr/0001-money-representation-and-rounding.md), [ADR-002](adr/0002-revenue-cogs-recognition-and-refunds.md), [ADR-003](adr/0003-ledger-accounts-and-posting-rules.md), [ADR-005](adr/0005-store-timezone-business-date-financial-year.md)

---

## 1. Overview and scenario structure

This benchmark provides a **hand-checkable, deterministic financial scenario** spanning two stores and two monthly fiscal periods (July 2026 and August 2026). It contains zero pseudorandom/Faker values and models the owner-operated multi-branch business in India (`Asia/Kolkata`, `INR`).

### 1.1 Stores
1. **Store 1 (ID: 1)**: Indiranagar Store, Bengaluru.
2. **Store 2 (ID: 2)**: Koramangala Store, Bengaluru.

### 1.2 Timeline and fiscal periods
- **Period 1 (`2026-07`)**: July 1, 2026 to July 31, 2026 (closed at end of month).
- **Period 2 (`2026-08`)**: August 1, 2026 to August 31, 2026 (active open period).

---

## 2. Master catalogue and standard product costs

All prices and costs are defined in integer paise. Tax rate is 5% inclusive GST (`taxRateBps = 500`).

| Product ID | Product Name | Category | Menu Price | M1 Standard Cost (July 2026) | M2 Standard Cost (Aug 2026) | Cost Change Reason |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **10** | Margherita Pizza | Pizza | ₹400.00 (40,000 p) | ₹140.00 (14,000 p) | ₹160.00 (16,000 p) | Cheese ingredient cost revision |
| **20** | Pepperoni Pizza | Pizza | ₹600.00 (60,000 p) | ₹240.00 (24,000 p) | ₹240.00 (24,000 p) | Unchanged |
| **30** | Paneer Tikka Pizza | Pizza | ₹500.00 (50,000 p) | ₹190.00 (19,000 p) | ₹190.00 (19,000 p) | Unchanged |
| **40** | Garlic Bread | Sides | ₹150.00 (15,000 p) | ₹50.00 (5,000 p) | ₹50.00 (5,000 p) | Unchanged |
| **50** | Coke (500ml) | Beverages | ₹50.00 (5,000 p) | ₹25.00 (2,500 p) | ₹25.00 (2,500 p) | Unchanged |
| **101** | Extra Cheese (Customization) | Topping | ₹50.00 (5,000 p) | ₹20.00 (2,000 p) | ₹20.00 (2,000 p) | Unchanged |

---

## 3. Order lifecycle and transaction log

### 3.1 Month 1 (July 2026)

| Order ID | Store | Date | Items & Customizations | Coupon | Delivery Fee | Grand Total | Payment Method | Status | Recognized Revenue | Standard COGS | Notes |
| :--- | :---: | :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **101** | S1 | 2026-07-05 | 1x Margherita + Extra Cheese (45,000 p) | PIZZA50 (-5,000 p) | ₹50.00 (5,000 p) | **₹450.00 (45,000 p)** | Razorpay | `delivered` | **₹450.00 (45,000 p)** | **₹160.00 (16,000 p)** | Captured online; delivered. |
| **102** | S1 | 2026-07-12 | 1x Pepperoni (60,000 p) | None | ₹50.00 (5,000 p) | **₹650.00 (65,000 p)** | COD | `delivered` | **₹650.00 (65,000 p)** | **₹240.00 (24,000 p)** | Cash collected on delivery. |
| **103** | S1 | 2026-07-18 | 1x Paneer Tikka (50,000 p) | None | ₹50.00 (5,000 p) | **₹550.00 (55,000 p)** | Razorpay | `cancelled` | **₹0.00 (0 p)** | **₹0.00 (0 p)** | Payment failed; order cancelled before prep. |
| **104** | S1 | 2026-07-22 | 1x Margherita (40,000 p) + 1x Coke (5,000 p) | None | ₹50.00 (5,000 p) | **₹500.00 (50,000 p)** | Razorpay | `delivered` | **₹100.00 (10,000 p)** | **₹165.00 (16,500 p)** | Gross 50,000 p; ₹400 (40,000 p) partial refund for damaged pizza. Net revenue = 10,000 p. |
| **105** | S2 | 2026-07-15 | 2x Garlic Bread (30,000 p) | None | ₹50.00 (5,000 p) | **₹350.00 (35,000 p)** | COD | `delivered` | **₹350.00 (35,000 p)** | **₹100.00 (10,000 p)** | Cash collected on delivery. |

### 3.2 Month 2 (August 2026)

| Order ID | Store | Date | Items & Customizations | Coupon | Delivery Fee | Grand Total | Payment Method | Status | Recognized Revenue | Standard COGS | Notes |
| :--- | :---: | :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **201** | S1 | 2026-08-04 | 1x Margherita (40,000 p) | None | ₹50.00 (5,000 p) | **₹450.00 (45,000 p)** | Razorpay | `delivered` | **₹450.00 (45,000 p)** | **₹160.00 (16,000 p)** | Uses revised August standard cost (₹160). |
| **202** | S2 | 2026-08-10 | 1x Pepperoni (60,000 p) + 1x Coke (5,000 p) | None | ₹50.00 (5,000 p) | **₹700.00 (70,000 p)** | Razorpay | `delivered` | **₹700.00 (70,000 p)** | **₹265.00 (26,500 p)** | Captured online; delivered. |
| **203** | S2 | 2026-08-20 | 1x Paneer Tikka (50,000 p) | None | ₹50.00 (5,000 p) | **₹550.00 (55,000 p)** | COD | `delivered` | **₹550.00 (55,000 p)** | **₹190.00 (19,000 p)** | Cash collected on delivery. |

---

## 4. Payment settlements and gateway charges

Razorpay gateway terms: **2.00% fee + 18% GST on fee**.

### 4.1 Settlement `set_m1_s1_001` (Store 1, `2026-07-28`)
- **Matched online captures**: Order 101 (45,000 p) + Order 104 (50,000 p) = **95,000 paise gross**.
- **Less refunds deducted**: Order 104 partial refund = **-40,000 paise**.
- **Base net settlement**: 55,000 paise.
- **Gateway Fee (2%)**: `round(95,000 * 0.02)` = **1,900 paise**.
- **GST on Fee (18%)**: `round(1,900 * 0.18)` = **342 paise**.
- **Total Gateway Charges**: **2,242 paise**.
- **Net Bank Payout**: `55,000 - 2,242` = **52,758 paise (₹527.58)**.

### 4.2 Settlement `set_m2_s2_001` (Store 2, `2026-08-15`)
- **Matched online captures**: Order 202 (70,000 p) = **70,000 paise gross**.
- **Less refunds deducted**: 0 paise.
- **Gateway Fee (2%)**: `round(70,000 * 0.02)` = **1,400 paise**.
- **GST on Fee (18%)**: `round(1,400 * 0.18)` = **252 paise**.
- **Total Gateway Charges**: **1,652 paise**.
- **Net Bank Payout**: `70,000 - 1,652` = **68,348 paise (₹683.48)**.

---

## 5. Operating expenses and payroll

### 5.1 Operating expenses
| ID | Store | Month | Category | Description | Amount (Paise) | Payment Method | Status |
| :---: | :---: | :---: | :--- | :--- | :---: | :---: | :---: |
| 101 | S1 | 2026-07 | Rent | Indiranagar Store Rent July 2026 | 1,500,000 p (₹15,000) | Bank transfer | `paid` |
| 102 | S1 | 2026-07 | Utilities | Electricity & Water July 2026 | 300,000 p (₹3,000) | Bank transfer | `paid` |
| 103 | S1 | 2026-07 | Cleaning | Kitchen deep cleaning | 150,000 p (₹1,500) | Petty cash | `paid` |
| 104 | S2 | 2026-07 | Rent | Koramangala Store Rent July 2026 | 1,800,000 p (₹18,000) | Bank transfer | `paid` |
| 105 | S2 | 2026-07 | Utilities | Electricity & Gas July 2026 | 350,000 p (₹3,500) | Bank transfer | `paid` |
| 201 | S1 | 2026-08 | Rent | Indiranagar Store Rent August 2026 | 1,500,000 p (₹15,000) | Bank transfer | `paid` |
| 202 | S1 | 2026-08 | Utilities | Electricity & Water August 2026 | 320,000 p (₹3,200) | Bank transfer | `paid` |
| 203 | S1 | 2026-08 | Packaging | Custom pizza boxes batch | 200,000 p (₹2,000) | Bank transfer | `paid` |
| 204 | S2 | 2026-08 | Rent | Koramangala Store Rent August 2026 | 1,800,000 p (₹18,000) | Bank transfer | `paid` |
| 205 | S2 | 2026-08 | Utilities | Electricity & Gas August 2026 | 380,000 p (₹3,800) | Bank transfer | `paid` |

### 5.2 Payroll pay runs
| Run ID | Store | Month | Employee | Designation | Gross Base Salary | Net Pay Disbursed | Status |
| :---: | :---: | :---: | :--- | :--- | :---: | :---: | :---: |
| **1** | S1 | 2026-07 | Ravi Kumar<br>Anil Sharma | Head Chef<br>Kitchen Staff | 2,500,000 p (₹25k)<br>1,500,000 p (₹15k) | **4,000,000 paise (₹40,000)** | `paid` |
| **2** | S2 | 2026-07 | Priya Nair<br>Suresh Gowda | Store Supervisor<br>Kitchen Staff | 2,200,000 p (₹22k)<br>1,400,000 p (₹14k) | **3,600,000 paise (₹36,000)** | `paid` |
| **3** | S1 | 2026-08 | Ravi Kumar (Merit raise)<br>Anil Sharma | Head Chef<br>Kitchen Staff | 2,800,000 p (₹28k)<br>1,500,000 p (₹15k) | **4,300,000 paise (₹43,000)** | `paid` |
| **4** | S2 | 2026-08 | Priya Nair<br>Suresh Gowda | Store Supervisor<br>Kitchen Staff | 2,200,000 p (₹22k)<br>1,400,000 p (₹14k) | **3,600,000 paise (₹36,000)** | `paid` |

---

## 6. Hand-checkable Profit & Loss (P&L) statements

### 6.1 Store 1 & Store 2 Monthly Statements

```text
========================================================================================
P&L LINE ITEM              STORE 1 (2026-07)  STORE 2 (2026-07)  STORE 1 (2026-08)  STORE 2 (2026-08)
========================================================================================
Gross Sales                    160,000 p           35,000 p           45,000 p          125,000 p
Less: Customer Discounts        (5,000 p)               0 p                0 p                0 p
Plus: Delivery Fees             15,000 p            5,000 p            5,000 p           10,000 p
Less: Customer Refunds         (40,000 p)               0 p                0 p                0 p
----------------------------------------------------------------------------------------
NET RECOGNIZED REVENUE         120,000 p           35,000 p           45,000 p          125,000 p
Cost of Goods Sold (COGS)      (56,500 p)         (10,000 p)         (16,000 p)         (45,500 p)
----------------------------------------------------------------------------------------
GROSS PROFIT                    63,500 p           25,000 p           29,000 p           79,500 p
Gross Margin %                    52.92%             71.43%             64.44%             63.60%
----------------------------------------------------------------------------------------
Operating Expenses:
  - Rent                     1,500,000 p        1,800,000 p        1,500,000 p        1,800,000 p
  - Utilities                  300,000 p          350,000 p          320,000 p          380,000 p
  - Cleaning / Packaging       150,000 p                0 p          200,000 p                0 p
Total Operating Expenses     1,950,000 p        2,150,000 p        2,020,000 p        2,180,000 p
----------------------------------------------------------------------------------------
Payroll Cost                 4,000,000 p        3,600,000 p        4,300,000 p        3,600,000 p
----------------------------------------------------------------------------------------
NET OPERATING PROFIT / (LOSS) -5,886,500 p       -5,725,000 p       -6,291,000 p       -5,700,500 p
========================================================================================
```

### 6.2 Consolidated 2-Month Business Total

| Line Item | Amount in Paise | Amount in INR | % of Net Revenue |
| :--- | :---: | :---: | :---: |
| **Gross Order Sales** | 365,000 p | ₹3,650.00 | 112.31% |
| **Less: Customer Refunds** | -40,000 p | -₹400.00 | -12.31% |
| **NET RECOGNIZED REVENUE** | **325,000 p** | **₹3,250.00** | **100.00%** |
| **Cost of Goods Sold (COGS)** | **-128,000 p** | **-₹1,280.00** | **-39.38%** |
| **GROSS PROFIT** | **197,000 p** | **₹1,970.00** | **60.62%** |
| **Total Operating Expenses** | **-8,300,000 p** | **-₹83,000.00** | - |
| **Total Payroll Cost** | **-15,500,000 p** | **-₹155,000.00** | - |
| **NET OPERATING RESULT** | **-23,603,000 p** | **-₹236,030.00** | - |

---

## 7. Trial balance verification rule

Across every store and month, double-entry journal entries generated from these fixtures must satisfy:

$$\sum \text{Debits} - \sum \text{Credits} = 0$$

All automated tests in [`backend/src/fixtures/financial-scenario.fixtures.test.ts`](../backend/src/fixtures/financial-scenario.fixtures.test.ts) verify this invariant.
