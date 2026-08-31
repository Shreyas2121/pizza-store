import { describe, expect, it } from "vitest";
import {
  EXPECTED_CONSOLIDATED_TWO_MONTH_TOTAL,
  EXPECTED_STORE_MONTH_SUMMARIES,
  FIXTURE_EMPLOYEES,
  FIXTURE_EXPENSES,
  FIXTURE_ORDERS,
  FIXTURE_PAY_RUNS,
  FIXTURE_PRODUCTS,
  FIXTURE_SETTLEMENTS,
  FIXTURE_STANDARD_COSTS,
  FIXTURE_STORES,
} from "./financial-scenario.fixtures";

describe("Deterministic Financial Scenario Fixtures Verification", () => {
  it("defines exactly two stores with Asia/Kolkata timezone", () => {
    expect(FIXTURE_STORES).toHaveLength(2);
    for (const store of FIXTURE_STORES) {
      expect(store.timezone).toBe("Asia/Kolkata");
    }
  });

  describe("Order quote and tax arithmetic", () => {
    it("verifies grand total arithmetic across all orders: itemsSubtotal - discount + delivery + rounding = grandTotal", () => {
      for (const order of FIXTURE_ORDERS) {
        const expectedTotal =
          order.itemsSubtotalPaise -
          order.discountPaise +
          order.deliveryFeePaise +
          order.roundingAdjustmentPaise;
        expect(order.grandTotalPaise).toBe(expectedTotal);
        expect(order.grandTotalPaise).toBeGreaterThan(0);
      }
    });

    it("verifies taxable amount and tax sum to grand total for every order", () => {
      for (const order of FIXTURE_ORDERS) {
        expect(order.taxableAmountPaise + order.taxPaise).toBe(order.grandTotalPaise);
      }
    });

    it("verifies item-level line totals sum exactly to order itemsSubtotalPaise", () => {
      for (const order of FIXTURE_ORDERS) {
        const itemsSum = order.items.reduce(
          (sum, item) => sum + item.lineSubtotalPaise,
          0
        );
        expect(itemsSum).toBe(order.itemsSubtotalPaise);
      }
    });

    it("verifies discount allocations sum exactly to order discountPaise", () => {
      for (const order of FIXTURE_ORDERS) {
        const discountSum = order.items.reduce(
          (sum, item) => sum + item.discountAllocationPaise,
          0
        );
        expect(discountSum).toBe(order.discountPaise);
      }
    });
  });

  describe("Standard COGS and effective-date evaluation", () => {
    it("applies Month 1 Margherita cost (14,000 paise) to July orders and Month 2 cost (16,000 paise) to August orders", () => {
      const julyMargherita = FIXTURE_ORDERS.find(
        (o) => o.id === 101
      )?.items.find((i) => i.productId === 10);
      expect(julyMargherita?.unitCostPaise).toBe(14000);

      const augustMargherita = FIXTURE_ORDERS.find(
        (o) => o.id === 201
      )?.items.find((i) => i.productId === 10);
      expect(augustMargherita?.unitCostPaise).toBe(16000);
    });

    it("evaluates order cogsPaise as sum of item total costs for delivered orders and 0 for cancelled orders", () => {
      for (const order of FIXTURE_ORDERS) {
        if (order.status === "cancelled") {
          expect(order.cogsPaise).toBe(0);
        } else {
          const itemCostSum = order.items.reduce(
            (sum, item) => sum + item.totalCostPaise,
            0
          );
          expect(order.cogsPaise).toBe(itemCostSum);
        }
      }
    });
  });

  describe("Settlement fee and tax calculations", () => {
    it("calculates gateway fee as 2% and GST as 18% of fee, reconciling net payout", () => {
      for (const settlement of FIXTURE_SETTLEMENTS) {
        const expectedFee = Math.round(settlement.grossAmountPaise * 0.02);
        const expectedTax = Math.round(expectedFee * 0.18);
        const expectedNet =
          settlement.grossAmountPaise -
          settlement.refundsDeductedPaise -
          expectedFee -
          expectedTax;

        expect(settlement.gatewayFeePaise).toBe(expectedFee);
        expect(settlement.gatewayTaxPaise).toBe(expectedTax);
        expect(settlement.netPayoutPaise).toBe(expectedNet);
      }
    });
  });

  describe("Operating expenses and payroll", () => {
    it("verifies all expense vouchers are in paid status with positive integer amounts", () => {
      for (const expense of FIXTURE_EXPENSES) {
        expect(expense.status).toBe("paid");
        expect(expense.amountPaise).toBeGreaterThan(0);
        expect(Number.isInteger(expense.amountPaise)).toBe(true);
      }
    });

    it("verifies payroll pay runs reconcile with employee salary structures", () => {
      // Month 1 Store 1: Ravi (25k) + Anil (15k) = 40,000 paise (40,000.00)
      const payRun1 = FIXTURE_PAY_RUNS.find((p) => p.id === 1);
      expect(payRun1?.totalGrossPayPaise).toBe(4000000);

      // Month 2 Store 1: Ravi raise to 28k + Anil 15k = 43,000 paise (43,000.00)
      const payRun3 = FIXTURE_PAY_RUNS.find((p) => p.id === 3);
      expect(payRun3?.totalGrossPayPaise).toBe(4300000);
    });
  });

  describe("Store-month summaries and P&L statements", () => {
    it("reconciles Store 1 July 2026 summary: recognized revenue, COGS, gross profit, expenses, and payroll", () => {
      const summary = EXPECTED_STORE_MONTH_SUMMARIES["store_1_2026_07"];
      expect(summary.grossSalesPaise).toBe(160000);
      expect(summary.refundsPaise).toBe(40000);
      expect(summary.recognizedRevenuePaise).toBe(120000);
      expect(summary.cogsPaise).toBe(56500);
      expect(summary.grossProfitPaise).toBe(summary.recognizedRevenuePaise - summary.cogsPaise);
      expect(summary.operatingExpensesPaise).toBe(1950000);
      expect(summary.payrollCostPaise).toBe(4000000);
      expect(summary.operatingProfitPaise).toBe(
        summary.grossProfitPaise - summary.operatingExpensesPaise - summary.payrollCostPaise
      );
    });

    it("reconciles Store 2 July 2026 summary", () => {
      const summary = EXPECTED_STORE_MONTH_SUMMARIES["store_2_2026_07"];
      expect(summary.grossSalesPaise).toBe(35000);
      expect(summary.recognizedRevenuePaise).toBe(35000);
      expect(summary.cogsPaise).toBe(10000);
      expect(summary.grossProfitPaise).toBe(25000);
      expect(summary.operatingProfitPaise).toBe(25000 - 2150000 - 3600000);
    });

    it("reconciles Store 1 August 2026 summary with revised standard costs", () => {
      const summary = EXPECTED_STORE_MONTH_SUMMARIES["store_1_2026_08"];
      expect(summary.grossSalesPaise).toBe(45000);
      expect(summary.cogsPaise).toBe(16000);
      expect(summary.grossProfitPaise).toBe(29000);
      expect(summary.payrollCostPaise).toBe(4300000);
      expect(summary.operatingProfitPaise).toBe(29000 - 2020000 - 4300000);
    });

    it("reconciles Store 2 August 2026 summary", () => {
      const summary = EXPECTED_STORE_MONTH_SUMMARIES["store_2_2026_08"];
      expect(summary.grossSalesPaise).toBe(125000);
      expect(summary.cogsPaise).toBe(45500);
      expect(summary.grossProfitPaise).toBe(79500);
      expect(summary.operatingProfitPaise).toBe(79500 - 2180000 - 3600000);
    });

    it("reconciles consolidated 2-month business total across all stores", () => {
      const summaries = Object.values(EXPECTED_STORE_MONTH_SUMMARIES);
      const totalGrossSales = summaries.reduce((sum, s) => sum + s.grossSalesPaise, 0);
      const totalRefunds = summaries.reduce((sum, s) => sum + s.refundsPaise, 0);
      const totalNetRevenue = summaries.reduce((sum, s) => sum + s.recognizedRevenuePaise, 0);
      const totalCogs = summaries.reduce((sum, s) => sum + s.cogsPaise, 0);
      const totalGrossProfit = summaries.reduce((sum, s) => sum + s.grossProfitPaise, 0);
      const totalExpenses = summaries.reduce((sum, s) => sum + s.operatingExpensesPaise, 0);
      const totalPayroll = summaries.reduce((sum, s) => sum + s.payrollCostPaise, 0);
      const totalOperatingProfit = summaries.reduce((sum, s) => sum + s.operatingProfitPaise, 0);

      expect(totalGrossSales).toBe(EXPECTED_CONSOLIDATED_TWO_MONTH_TOTAL.grossSalesPaise);
      expect(totalRefunds).toBe(EXPECTED_CONSOLIDATED_TWO_MONTH_TOTAL.refundsPaise);
      expect(totalNetRevenue).toBe(EXPECTED_CONSOLIDATED_TWO_MONTH_TOTAL.netRecognizedRevenuePaise);
      expect(totalCogs).toBe(EXPECTED_CONSOLIDATED_TWO_MONTH_TOTAL.cogsPaise);
      expect(totalGrossProfit).toBe(EXPECTED_CONSOLIDATED_TWO_MONTH_TOTAL.grossProfitPaise);
      expect(totalExpenses).toBe(EXPECTED_CONSOLIDATED_TWO_MONTH_TOTAL.operatingExpensesPaise);
      expect(totalPayroll).toBe(EXPECTED_CONSOLIDATED_TWO_MONTH_TOTAL.payrollCostPaise);
      expect(totalOperatingProfit).toBe(EXPECTED_CONSOLIDATED_TWO_MONTH_TOTAL.operatingProfitPaise);
    });
  });
});
