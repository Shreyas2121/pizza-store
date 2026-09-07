/**
 * Deterministic Financial Fixtures: Two-Store, Two-Month Reference Scenario
 *
 * This file defines the single source of financial fixture truth for PizzaStore.
 * Used for characterization, unit/integration verification, and seeding.
 *
 * Model: Owner-operated multi-store business (India, Asia/Kolkata, INR).
 * All money amounts are exact non-negative integer paise.
 */

export interface FixtureProduct {
  id: number;
  name: string;
  category: string;
  pricePaise: number;
  taxRateBps: number;
}

export interface FixtureStandardCost {
  productId: number;
  effectiveFrom: string; // ISO date YYYY-MM-DD
  effectiveTo: string | null;
  unitCostPaise: number;
}

export interface FixtureStore {
  id: number;
  name: string;
  city: string;
  timezone: string;
}

export interface FixtureOrderItem {
  productId: number;
  productName: string;
  quantity: number;
  unitPricePaise: number;
  lineSubtotalPaise: number;
  discountAllocationPaise: number;
  taxableAmountPaise: number;
  taxPaise: number;
  lineTotalPaise: number;
  unitCostPaise: number;
  totalCostPaise: number;
  customizationName?: string;
  customizationPricePaise?: number;
  customizationCostPaise?: number;
}

export interface FixtureOrder {
  id: number;
  orderNumber: string;
  storeId: number;
  userId: number;
  placedAt: string; // ISO string
  businessDate: string; // YYYY-MM-DD
  paymentMethod: "cod" | "razorpay";
  paymentStatus: "completed" | "failed" | "refunded" | "processing";
  status: "pending" | "preparing" | "out_for_delivery" | "delivered" | "cancelled";
  itemsSubtotalPaise: number;
  discountPaise: number;
  deliveryFeePaise: number;
  taxableAmountPaise: number;
  taxPaise: number;
  roundingAdjustmentPaise: number;
  grandTotalPaise: number;
  cogsPaise: number;
  items: FixtureOrderItem[];
  couponCode?: string;
  refundPaise?: number;
  refundReason?: string;
}

export interface FixtureSettlement {
  id: string;
  storeId: number;
  settledAt: string;
  businessDate: string;
  matchedOrderIds: number[];
  grossAmountPaise: number;
  refundsDeductedPaise: number;
  gatewayFeePaise: number;
  gatewayTaxPaise: number;
  netPayoutPaise: number;
}

export interface FixtureExpense {
  id: number;
  storeId: number;
  category: "Rent" | "Utilities" | "Cleaning" | "Packaging" | "Marketing";
  businessDate: string;
  description: string;
  amountPaise: number;
  taxPaise: number;
  status: "paid";
  paymentMethod: "bank_transfer" | "petty_cash";
}

export interface FixtureEmployee {
  id: number;
  storeId: number;
  name: string;
  designation: string;
  monthlySalaryMonth1Paise: number;
  monthlySalaryMonth2Paise: number;
}

export interface FixturePayRun {
  id: number;
  storeId: number;
  month: string; // YYYY-MM
  businessDate: string;
  employeeIds: number[];
  totalGrossPayPaise: number;
  totalDeductionsPaise: number;
  totalNetPayPaise: number;
  status: "paid";
}

export interface FixtureStoreMonthSummary {
  storeId: number;
  month: string;
  grossSalesPaise: number;
  discountPaise: number;
  deliveryFeePaise: number;
  recognizedRevenuePaise: number;
  cogsPaise: number;
  grossProfitPaise: number;
  grossMarginBps: number;
  refundsPaise: number;
  operatingExpensesPaise: number;
  payrollCostPaise: number;
  operatingProfitPaise: number;
  settlementsGrossPaise: number;
  settlementFeesPaise: number;
  settlementTaxPaise: number;
  settlementNetPayoutPaise: number;
  cashCollectedPaise: number;
}

export const FIXTURE_STORES: FixtureStore[] = [
  { id: 1, name: "Indiranagar Store", city: "Bengaluru", timezone: "Asia/Kolkata" },
  { id: 2, name: "Koramangala Store", city: "Bengaluru", timezone: "Asia/Kolkata" },
];

export const FIXTURE_PRODUCTS: FixtureProduct[] = [
  { id: 10, name: "Margherita Pizza", category: "Pizza", pricePaise: 40000, taxRateBps: 500 },
  { id: 20, name: "Pepperoni Pizza", category: "Pizza", pricePaise: 60000, taxRateBps: 500 },
  { id: 30, name: "Paneer Tikka Pizza", category: "Pizza", pricePaise: 50000, taxRateBps: 500 },
  { id: 40, name: "Garlic Bread", category: "Sides", pricePaise: 15000, taxRateBps: 500 },
  { id: 50, name: "Coke 500ml", category: "Beverages", pricePaise: 5000, taxRateBps: 500 },
];

export const FIXTURE_STANDARD_COSTS: FixtureStandardCost[] = [
  // Margherita standard cost increases in Month 2 (2026-08) from 14,000 paise to 16,000 paise
  { productId: 10, effectiveFrom: "2026-01-01", effectiveTo: "2026-07-31", unitCostPaise: 14000 },
  { productId: 10, effectiveFrom: "2026-08-01", effectiveTo: null, unitCostPaise: 16000 },
  // Other products remain steady
  { productId: 20, effectiveFrom: "2026-01-01", effectiveTo: null, unitCostPaise: 24000 },
  { productId: 30, effectiveFrom: "2026-01-01", effectiveTo: null, unitCostPaise: 19000 },
  { productId: 40, effectiveFrom: "2026-01-01", effectiveTo: null, unitCostPaise: 5000 },
  { productId: 50, effectiveFrom: "2026-01-01", effectiveTo: null, unitCostPaise: 2500 },
];

export const FIXTURE_ORDERS: FixtureOrder[] = [
  // --- STORE 1 / MONTH 1 (July 2026) ---
  {
    id: 101,
    orderNumber: "ORD-202607-001",
    storeId: 1,
    userId: 1,
    placedAt: "2026-07-05T12:30:00.000Z",
    businessDate: "2026-07-05",
    paymentMethod: "razorpay",
    paymentStatus: "completed",
    status: "delivered",
    couponCode: "PIZZA50",
    itemsSubtotalPaise: 45000, // 40000 base + 5000 cheese
    discountPaise: 5000,
    deliveryFeePaise: 5000,
    taxableAmountPaise: 42857,
    taxPaise: 2143,
    roundingAdjustmentPaise: 0,
    grandTotalPaise: 45000, // 45000 - 5000 + 5000
    cogsPaise: 16000, // 14000 pizza + 2000 cheese
    items: [
      {
        productId: 10,
        productName: "Margherita Pizza",
        quantity: 1,
        unitPricePaise: 40000,
        lineSubtotalPaise: 45000,
        discountAllocationPaise: 5000,
        taxableAmountPaise: 38095,
        taxPaise: 1905,
        lineTotalPaise: 40000,
        unitCostPaise: 14000,
        totalCostPaise: 16000,
        customizationName: "Extra Cheese",
        customizationPricePaise: 5000,
        customizationCostPaise: 2000,
      },
    ],
  },
  {
    id: 102,
    orderNumber: "ORD-202607-002",
    storeId: 1,
    userId: 2,
    placedAt: "2026-07-12T19:15:00.000Z",
    businessDate: "2026-07-12",
    paymentMethod: "cod",
    paymentStatus: "completed",
    status: "delivered",
    itemsSubtotalPaise: 60000,
    discountPaise: 0,
    deliveryFeePaise: 5000,
    taxableAmountPaise: 61905,
    taxPaise: 3095,
    roundingAdjustmentPaise: 0,
    grandTotalPaise: 65000,
    cogsPaise: 24000,
    items: [
      {
        productId: 20,
        productName: "Pepperoni Pizza",
        quantity: 1,
        unitPricePaise: 60000,
        lineSubtotalPaise: 60000,
        discountAllocationPaise: 0,
        taxableAmountPaise: 57143,
        taxPaise: 2857,
        lineTotalPaise: 60000,
        unitCostPaise: 24000,
        totalCostPaise: 24000,
      },
    ],
  },
  {
    id: 103,
    orderNumber: "ORD-202607-003",
    storeId: 1,
    userId: 3,
    placedAt: "2026-07-18T14:00:00.000Z",
    businessDate: "2026-07-18",
    paymentMethod: "razorpay",
    paymentStatus: "failed",
    status: "cancelled", // cancelled prior to delivery -> 0 recognized revenue / COGS
    itemsSubtotalPaise: 50000,
    discountPaise: 0,
    deliveryFeePaise: 5000,
    taxableAmountPaise: 52381,
    taxPaise: 2619,
    roundingAdjustmentPaise: 0,
    grandTotalPaise: 55000,
    cogsPaise: 0,
    items: [
      {
        productId: 30,
        productName: "Paneer Tikka Pizza",
        quantity: 1,
        unitPricePaise: 50000,
        lineSubtotalPaise: 50000,
        discountAllocationPaise: 0,
        taxableAmountPaise: 47619,
        taxPaise: 2381,
        lineTotalPaise: 50000,
        unitCostPaise: 19000,
        totalCostPaise: 0,
      },
    ],
  },
  {
    id: 104,
    orderNumber: "ORD-202607-004",
    storeId: 1,
    userId: 4,
    placedAt: "2026-07-22T20:30:00.000Z",
    businessDate: "2026-07-22",
    paymentMethod: "razorpay",
    paymentStatus: "refunded",
    status: "delivered",
    itemsSubtotalPaise: 45000, // 40000 pizza + 5000 coke
    discountPaise: 0,
    deliveryFeePaise: 5000,
    taxableAmountPaise: 47619,
    taxPaise: 2381,
    roundingAdjustmentPaise: 0,
    grandTotalPaise: 50000,
    cogsPaise: 16500, // 14000 pizza + 2500 coke
    refundPaise: 40000, // Damaged pizza partially refunded on 2026-07-23
    refundReason: "Damaged pizza on delivery",
    items: [
      {
        productId: 10,
        productName: "Margherita Pizza",
        quantity: 1,
        unitPricePaise: 40000,
        lineSubtotalPaise: 40000,
        discountAllocationPaise: 0,
        taxableAmountPaise: 38095,
        taxPaise: 1905,
        lineTotalPaise: 40000,
        unitCostPaise: 14000,
        totalCostPaise: 14000,
      },
      {
        productId: 50,
        productName: "Coke 500ml",
        quantity: 1,
        unitPricePaise: 5000,
        lineSubtotalPaise: 5000,
        discountAllocationPaise: 0,
        taxableAmountPaise: 4762,
        taxPaise: 238,
        lineTotalPaise: 5000,
        unitCostPaise: 2500,
        totalCostPaise: 2500,
      },
    ],
  },

  // --- STORE 2 / MONTH 1 (July 2026) ---
  {
    id: 105,
    orderNumber: "ORD-202607-005",
    storeId: 2,
    userId: 5,
    placedAt: "2026-07-15T18:45:00.000Z",
    businessDate: "2026-07-15",
    paymentMethod: "cod",
    paymentStatus: "completed",
    status: "delivered",
    itemsSubtotalPaise: 30000, // 2x 15000
    discountPaise: 0,
    deliveryFeePaise: 5000,
    taxableAmountPaise: 33333,
    taxPaise: 1667,
    roundingAdjustmentPaise: 0,
    grandTotalPaise: 35000,
    cogsPaise: 10000, // 2 * 5000
    items: [
      {
        productId: 40,
        productName: "Garlic Bread",
        quantity: 2,
        unitPricePaise: 15000,
        lineSubtotalPaise: 30000,
        discountAllocationPaise: 0,
        taxableAmountPaise: 28571,
        taxPaise: 1429,
        lineTotalPaise: 30000,
        unitCostPaise: 5000,
        totalCostPaise: 10000,
      },
    ],
  },

  // --- STORE 1 / MONTH 2 (August 2026) ---
  {
    id: 201,
    orderNumber: "ORD-202608-001",
    storeId: 1,
    userId: 1,
    placedAt: "2026-08-04T13:00:00.000Z",
    businessDate: "2026-08-04",
    paymentMethod: "razorpay",
    paymentStatus: "completed",
    status: "delivered",
    itemsSubtotalPaise: 40000,
    discountPaise: 0,
    deliveryFeePaise: 5000,
    taxableAmountPaise: 42857,
    taxPaise: 2143,
    roundingAdjustmentPaise: 0,
    grandTotalPaise: 45000,
    cogsPaise: 16000, // M2 revised standard cost: 16000 paise
    items: [
      {
        productId: 10,
        productName: "Margherita Pizza",
        quantity: 1,
        unitPricePaise: 40000,
        lineSubtotalPaise: 40000,
        discountAllocationPaise: 0,
        taxableAmountPaise: 38095,
        taxPaise: 1905,
        lineTotalPaise: 40000,
        unitCostPaise: 16000,
        totalCostPaise: 16000,
      },
    ],
  },

  // --- STORE 2 / MONTH 2 (August 2026) ---
  {
    id: 202,
    orderNumber: "ORD-202608-002",
    storeId: 2,
    userId: 6,
    placedAt: "2026-08-10T19:00:00.000Z",
    businessDate: "2026-08-10",
    paymentMethod: "razorpay",
    paymentStatus: "completed",
    status: "delivered",
    itemsSubtotalPaise: 65000, // 60000 pepperoni + 5000 coke
    discountPaise: 0,
    deliveryFeePaise: 5000,
    taxableAmountPaise: 66667,
    taxPaise: 3333,
    roundingAdjustmentPaise: 0,
    grandTotalPaise: 70000,
    cogsPaise: 26500, // 24000 + 2500
    items: [
      {
        productId: 20,
        productName: "Pepperoni Pizza",
        quantity: 1,
        unitPricePaise: 60000,
        lineSubtotalPaise: 60000,
        discountAllocationPaise: 0,
        taxableAmountPaise: 57143,
        taxPaise: 2857,
        lineTotalPaise: 60000,
        unitCostPaise: 24000,
        totalCostPaise: 24000,
      },
      {
        productId: 50,
        productName: "Coke 500ml",
        quantity: 1,
        unitPricePaise: 5000,
        lineSubtotalPaise: 5000,
        discountAllocationPaise: 0,
        taxableAmountPaise: 4762,
        taxPaise: 238,
        lineTotalPaise: 5000,
        unitCostPaise: 2500,
        totalCostPaise: 2500,
      },
    ],
  },
  {
    id: 203,
    orderNumber: "ORD-202608-003",
    storeId: 2,
    userId: 7,
    placedAt: "2026-08-20T21:10:00.000Z",
    businessDate: "2026-08-20",
    paymentMethod: "cod",
    paymentStatus: "completed",
    status: "delivered",
    itemsSubtotalPaise: 50000,
    discountPaise: 0,
    deliveryFeePaise: 5000,
    taxableAmountPaise: 52381,
    taxPaise: 2619,
    roundingAdjustmentPaise: 0,
    grandTotalPaise: 55000,
    cogsPaise: 19000,
    items: [
      {
        productId: 30,
        productName: "Paneer Tikka Pizza",
        quantity: 1,
        unitPricePaise: 50000,
        lineSubtotalPaise: 50000,
        discountAllocationPaise: 0,
        taxableAmountPaise: 47619,
        taxPaise: 2381,
        lineTotalPaise: 50000,
        unitCostPaise: 19000,
        totalCostPaise: 19000,
      },
    ],
  },
];

export const FIXTURE_SETTLEMENTS: FixtureSettlement[] = [
  // Settlement 1 (Store 1, July 2026) matches Order 101 (45,000) + Order 104 (50,000) less 40,000 refund
  // Fee: 2% on 95,000 = 1,900 paise; Tax: 18% on 1,900 = 342 paise; Total charges = 2,242 paise
  // Net payout = 55,000 - 2,242 = 52,758 paise
  {
    id: "set_m1_s1_001",
    storeId: 1,
    settledAt: "2026-07-28T06:00:00.000Z",
    businessDate: "2026-07-28",
    matchedOrderIds: [101, 104],
    grossAmountPaise: 95000,
    refundsDeductedPaise: 40000,
    gatewayFeePaise: 1900,
    gatewayTaxPaise: 342,
    netPayoutPaise: 52758,
  },
  // Settlement 2 (Store 2, August 2026) matches Order 202 (70,000)
  // Fee: 2% on 70,000 = 1,400 paise; Tax: 18% on 1,400 = 252 paise; Total charges = 1,652 paise
  // Net payout = 70,000 - 1,652 = 68,348 paise
  {
    id: "set_m2_s2_001",
    storeId: 2,
    settledAt: "2026-08-15T06:00:00.000Z",
    businessDate: "2026-08-15",
    matchedOrderIds: [202],
    grossAmountPaise: 70000,
    refundsDeductedPaise: 0,
    gatewayFeePaise: 1400,
    gatewayTaxPaise: 252,
    netPayoutPaise: 68348,
  },
];

export const FIXTURE_EXPENSES: FixtureExpense[] = [
  // Store 1 Month 1 (July 2026)
  { id: 101, storeId: 1, category: "Rent", businessDate: "2026-07-01", description: "Indiranagar Store Rent July 2026", amountPaise: 1500000, taxPaise: 0, status: "paid", paymentMethod: "bank_transfer" },
  { id: 102, storeId: 1, category: "Utilities", businessDate: "2026-07-10", description: "Electricity & Water July 2026", amountPaise: 300000, taxPaise: 0, status: "paid", paymentMethod: "bank_transfer" },
  { id: 103, storeId: 1, category: "Cleaning", businessDate: "2026-07-15", description: "Kitchen deep cleaning", amountPaise: 150000, taxPaise: 0, status: "paid", paymentMethod: "petty_cash" },

  // Store 2 Month 1 (July 2026)
  { id: 104, storeId: 2, category: "Rent", businessDate: "2026-07-01", description: "Koramangala Store Rent July 2026", amountPaise: 1800000, taxPaise: 0, status: "paid", paymentMethod: "bank_transfer" },
  { id: 105, storeId: 2, category: "Utilities", businessDate: "2026-07-10", description: "Electricity & Gas July 2026", amountPaise: 350000, taxPaise: 0, status: "paid", paymentMethod: "bank_transfer" },

  // Store 1 Month 2 (August 2026)
  { id: 201, storeId: 1, category: "Rent", businessDate: "2026-08-01", description: "Indiranagar Store Rent August 2026", amountPaise: 1500000, taxPaise: 0, status: "paid", paymentMethod: "bank_transfer" },
  { id: 202, storeId: 1, category: "Utilities", businessDate: "2026-08-10", description: "Electricity & Water August 2026", amountPaise: 320000, taxPaise: 0, status: "paid", paymentMethod: "bank_transfer" },
  { id: 203, storeId: 1, category: "Packaging", businessDate: "2026-08-18", description: "Custom pizza boxes batch", amountPaise: 200000, taxPaise: 0, status: "paid", paymentMethod: "bank_transfer" },

  // Store 2 Month 2 (August 2026)
  { id: 204, storeId: 2, category: "Rent", businessDate: "2026-08-01", description: "Koramangala Store Rent August 2026", amountPaise: 1800000, taxPaise: 0, status: "paid", paymentMethod: "bank_transfer" },
  { id: 205, storeId: 2, category: "Utilities", businessDate: "2026-08-10", description: "Electricity & Gas August 2026", amountPaise: 380000, taxPaise: 0, status: "paid", paymentMethod: "bank_transfer" },
];

export const FIXTURE_EMPLOYEES: FixtureEmployee[] = [
  { id: 1, storeId: 1, name: "Ravi Kumar", designation: "Head Chef", monthlySalaryMonth1Paise: 2500000, monthlySalaryMonth2Paise: 2800000 },
  { id: 2, storeId: 1, name: "Anil Sharma", designation: "Kitchen Staff", monthlySalaryMonth1Paise: 1500000, monthlySalaryMonth2Paise: 1500000 },
  { id: 3, storeId: 2, name: "Priya Nair", designation: "Store Supervisor", monthlySalaryMonth1Paise: 2200000, monthlySalaryMonth2Paise: 2200000 },
  { id: 4, storeId: 2, name: "Suresh Gowda", designation: "Kitchen Staff", monthlySalaryMonth1Paise: 1400000, monthlySalaryMonth2Paise: 1400000 },
];

export const FIXTURE_PAY_RUNS: FixturePayRun[] = [
  // Store 1 Month 1 (July 2026): Ravi (25k) + Anil (15k) = 40,000 paise (₹40,000)
  { id: 1, storeId: 1, month: "2026-07", businessDate: "2026-07-31", employeeIds: [1, 2], totalGrossPayPaise: 4000000, totalDeductionsPaise: 0, totalNetPayPaise: 4000000, status: "paid" },
  // Store 2 Month 1 (July 2026): Priya (22k) + Suresh (14k) = 36,000 paise (₹36,000)
  { id: 2, storeId: 2, month: "2026-07", businessDate: "2026-07-31", employeeIds: [3, 4], totalGrossPayPaise: 3600000, totalDeductionsPaise: 0, totalNetPayPaise: 3600000, status: "paid" },
  // Store 1 Month 2 (August 2026): Ravi raise to 28k + Anil 15k = 43,000 paise (₹43,000)
  { id: 3, storeId: 1, month: "2026-08", businessDate: "2026-08-31", employeeIds: [1, 2], totalGrossPayPaise: 4300000, totalDeductionsPaise: 0, totalNetPayPaise: 4300000, status: "paid" },
  // Store 2 Month 2 (August 2026): Priya 22k + Suresh 14k = 36,000 paise (₹36,000)
  { id: 4, storeId: 2, month: "2026-08", businessDate: "2026-08-31", employeeIds: [3, 4], totalGrossPayPaise: 3600000, totalDeductionsPaise: 0, totalNetPayPaise: 3600000, status: "paid" },
];

/**
 * Hand-Checkable Store-Month Summaries and Expected Accounting P&L Results
 */
export const EXPECTED_STORE_MONTH_SUMMARIES: Record<string, FixtureStoreMonthSummary> = {
  // Store 1 - July 2026 (Delivered Orders 101, 102, 104; Cancelled 103)
  // Gross sales = 45,000 + 65,000 + 50,000 = 160,000 paise
  // Refunds = 40,000 paise -> Net Recognized Revenue = 120,000 paise
  // COGS = 16,000 + 24,000 + 16,500 = 56,500 paise
  // Gross Profit = 120,000 - 56,500 = 63,500 paise
  // Operating Expenses = 1,500,000 + 300,000 + 150,000 = 1,950,000 paise
  // Payroll = 4,000,000 paise
  // Operating Result = 63,500 - 1,950,000 - 4,000,000 = -5,886,500 paise
  "store_1_2026_07": {
    storeId: 1,
    month: "2026-07",
    grossSalesPaise: 160000,
    discountPaise: 5000,
    deliveryFeePaise: 15000,
    recognizedRevenuePaise: 120000,
    cogsPaise: 56500,
    grossProfitPaise: 63500,
    grossMarginBps: 5292, // (63500 / 120000) * 10000 = 52.92%
    refundsPaise: 40000,
    operatingExpensesPaise: 1950000,
    payrollCostPaise: 4000000,
    operatingProfitPaise: -5886500,
    settlementsGrossPaise: 95000,
    settlementFeesPaise: 1900,
    settlementTaxPaise: 342,
    settlementNetPayoutPaise: 52758,
    cashCollectedPaise: 65000, // Order 102
  },

  // Store 2 - July 2026 (Delivered Order 105)
  // Gross sales = 35,000 paise
  // Recognized revenue = 35,000 paise
  // COGS = 10,000 paise
  // Gross Profit = 25,000 paise
  // Operating Expenses = 1,800,000 + 350,000 = 2,150,000 paise
  // Payroll = 3,600,000 paise
  // Operating Result = 25,000 - 2,150,000 - 3,600,000 = -5,725,000 paise
  "store_2_2026_07": {
    storeId: 2,
    month: "2026-07",
    grossSalesPaise: 35000,
    discountPaise: 0,
    deliveryFeePaise: 5000,
    recognizedRevenuePaise: 35000,
    cogsPaise: 10000,
    grossProfitPaise: 25000,
    grossMarginBps: 7143, // (25000 / 35000) * 10000 = 71.43%
    refundsPaise: 0,
    operatingExpensesPaise: 2150000,
    payrollCostPaise: 3600000,
    operatingProfitPaise: -5725000,
    settlementsGrossPaise: 0,
    settlementFeesPaise: 0,
    settlementTaxPaise: 0,
    settlementNetPayoutPaise: 0,
    cashCollectedPaise: 35000, // Order 105
  },

  // Store 1 - August 2026 (Delivered Order 201)
  // Gross sales = 45,000 paise
  // Recognized revenue = 45,000 paise
  // COGS = 16,000 paise (revised standard cost!)
  // Gross profit = 29,000 paise
  // Operating expenses = 1,500,000 + 320,000 + 200,000 = 2,020,000 paise
  // Payroll = 4,300,000 paise (Ravi merit raise)
  // Operating result = 29,000 - 2,020,000 - 4,300,000 = -6,291,000 paise
  "store_1_2026_08": {
    storeId: 1,
    month: "2026-08",
    grossSalesPaise: 45000,
    discountPaise: 0,
    deliveryFeePaise: 5000,
    recognizedRevenuePaise: 45000,
    cogsPaise: 16000,
    grossProfitPaise: 29000,
    grossMarginBps: 6444, // (29000 / 45000) * 10000 = 64.44%
    refundsPaise: 0,
    operatingExpensesPaise: 2020000,
    payrollCostPaise: 4300000,
    operatingProfitPaise: -6291000,
    settlementsGrossPaise: 0,
    settlementFeesPaise: 0,
    settlementTaxPaise: 0,
    settlementNetPayoutPaise: 0,
    cashCollectedPaise: 0,
  },

  // Store 2 - August 2026 (Delivered Orders 202, 203)
  // Gross sales = 70,000 + 55,000 = 125,000 paise
  // Recognized revenue = 125,000 paise
  // COGS = 26,500 + 19,000 = 45,500 paise
  // Gross profit = 79,500 paise
  // Operating expenses = 1,800,000 + 380,000 = 2,180,000 paise
  // Payroll = 3,600,000 paise
  // Operating result = 79,500 - 2,180,000 - 3,600,000 = -5,700,500 paise
  "store_2_2026_08": {
    storeId: 2,
    month: "2026-08",
    grossSalesPaise: 125000,
    discountPaise: 0,
    deliveryFeePaise: 10000,
    recognizedRevenuePaise: 125000,
    cogsPaise: 45500,
    grossProfitPaise: 79500,
    grossMarginBps: 6360, // (79500 / 125000) * 10000 = 63.60%
    refundsPaise: 0,
    operatingExpensesPaise: 2180000,
    payrollCostPaise: 3600000,
    operatingProfitPaise: -5700500,
    settlementsGrossPaise: 70000,
    settlementFeesPaise: 1400,
    settlementTaxPaise: 252,
    settlementNetPayoutPaise: 68348,
    cashCollectedPaise: 55000, // Order 203
  },
};

/**
 * Consolidated 2-Month Business Total
 */
export const EXPECTED_CONSOLIDATED_TWO_MONTH_TOTAL = {
  grossSalesPaise: 365000, // 160k + 35k + 45k + 125k
  refundsPaise: 40000,
  netRecognizedRevenuePaise: 325000, // 365k - 40k
  cogsPaise: 128000, // 56.5k + 10k + 16k + 45.5k
  grossProfitPaise: 197000, // 325k - 128k
  operatingExpensesPaise: 8300000, // 19.5k + 21.5k + 20.2k + 21.8k
  payrollCostPaise: 15500000, // 40k + 36k + 43k + 36k
  operatingProfitPaise: -23603000, // 197k - 8300k - 15500k
};

/**
 * Ledger-backed report expectations for the same fixture. Customer headline
 * totals above are tax-inclusive; these values follow ADR-004 by separating
 * included demo tax from recognized revenue. Gateway charges and cash
 * variance are operating expense accounts in the P&L projection.
 */
export interface FixtureLedgerReportSummary {
  storeId: number;
  month: string;
  salesRevenuePaise: number;
  deliveryRevenuePaise: number;
  discountsPaise: number;
  refundsPaise: number;
  recognizedRevenuePaise: number;
  collectionsPaise: number;
  cogsPaise: number;
  grossProfitPaise: number;
  operatingExpensesPaise: number;
  payrollCostPaise: number;
  operatingResultPaise: number;
  unsettledRazorpayPaise: number;
  cashVariancePaise: number;
}

export const EXPECTED_LEDGER_REPORT_STORE_MONTH_SUMMARIES: Record<string, FixtureLedgerReportSummary> = {
  "store_1_2026_07": { storeId: 1, month: "2026-07", salesRevenuePaise: 142857, deliveryRevenuePaise: 14286, discountsPaise: 4762, refundsPaise: 38095, recognizedRevenuePaise: 114286, collectionsPaise: 160000, cogsPaise: 56500, grossProfitPaise: 57786, operatingExpensesPaise: 1953242, payrollCostPaise: 4000000, operatingResultPaise: -5895456, unsettledRazorpayPaise: 0, cashVariancePaise: 1000 },
  "store_2_2026_07": { storeId: 2, month: "2026-07", salesRevenuePaise: 28571, deliveryRevenuePaise: 4762, discountsPaise: 0, refundsPaise: 0, recognizedRevenuePaise: 33333, collectionsPaise: 35000, cogsPaise: 10000, grossProfitPaise: 23333, operatingExpensesPaise: 2150000, payrollCostPaise: 3600000, operatingResultPaise: -5726667, unsettledRazorpayPaise: 0, cashVariancePaise: 0 },
  "store_1_2026_08": { storeId: 1, month: "2026-08", salesRevenuePaise: 38095, deliveryRevenuePaise: 4762, discountsPaise: 0, refundsPaise: 0, recognizedRevenuePaise: 42857, collectionsPaise: 45000, cogsPaise: 16000, grossProfitPaise: 26857, operatingExpensesPaise: 2020000, payrollCostPaise: 4300000, operatingResultPaise: -6293143, unsettledRazorpayPaise: 45000, cashVariancePaise: 0 },
  "store_2_2026_08": { storeId: 2, month: "2026-08", salesRevenuePaise: 109524, deliveryRevenuePaise: 9524, discountsPaise: 0, refundsPaise: 0, recognizedRevenuePaise: 119048, collectionsPaise: 125000, cogsPaise: 45500, grossProfitPaise: 73548, operatingExpensesPaise: 2181652, payrollCostPaise: 3600000, operatingResultPaise: -5708104, unsettledRazorpayPaise: 0, cashVariancePaise: 0 },
};

export const EXPECTED_LEDGER_REPORT_CONSOLIDATED_TWO_MONTH_TOTAL = {
  salesRevenuePaise: 319047,
  deliveryRevenuePaise: 33334,
  discountsPaise: 4762,
  refundsPaise: 38095,
  recognizedRevenuePaise: 309524,
  collectionsPaise: 365000,
  cogsPaise: 128000,
  grossProfitPaise: 181524,
  operatingExpensesPaise: 8304894,
  payrollCostPaise: 15500000,
  operatingResultPaise: -23623370,
  cashVariancePaise: 1000,
};
