import { describe, expect, it } from "vitest";
import { comparisonPeriodFor, groupFinanceReport, projectFinanceReport, reportPeriodKey, type FinanceMovement } from "./finance-report.policy";

const movement = (accountCode: string, accountType: FinanceMovement["accountType"], debitPaise: number, creditPaise: number, businessDate = "2026-04-01", accountName = accountCode): FinanceMovement => ({
  businessDate, accountCode, accountName, accountType, debitPaise: String(debitPaise), creditPaise: String(creditPaise),
});

describe("finance report policy", () => {
  const rows: FinanceMovement[] = [
    movement("4000", "revenue", 0, 10_000),
    movement("4010", "revenue", 0, 2_000),
    movement("4100", "contra_revenue", 1_000, 0),
    movement("4110", "contra_revenue", 500, 0),
    movement("5000", "expense", 4_000, 0),
    movement("6000", "expense", 100, 0, "2026-04-01", "Gateway fees"),
    movement("6100", "expense", 50, 0, "2026-04-01", "Cash variance"),
    movement("6200", "expense", 2_000, 0),
    movement("6901", "expense", 300, 0, "2026-04-01", "Rent"),
  ];

  it("projects exact ledger-backed management metrics without floats", () => {
    const report = projectFinanceReport(rows, { collectionsPaise: "12500", unsettledRazorpayPaise: "800" });
    expect(report.totals).toEqual({
      salesRevenuePaise: "10000", deliveryRevenuePaise: "2000", discountsPaise: "1000", refundsPaise: "500",
      recognizedRevenuePaise: "10500", collectionsPaise: "12500", cogsPaise: "4000", grossProfitPaise: "6500",
      grossMarginBps: 6190, operatingExpensesPaise: "450", payrollCostPaise: "2000", operatingResultPaise: "4050",
      unsettledRazorpayPaise: "800", cashVariancePaise: "50",
    });
    expect(report.operatingExpenseLines).toEqual([
      { accountCode: "6000", accountName: "Gateway fees", amountPaise: "100" },
      { accountCode: "6100", accountName: "Cash variance", amountPaise: "50" },
      { accountCode: "6901", accountName: "Rent", amountPaise: "300" },
    ]);
  });

  it("groups calendar and Indian fiscal periods deterministically", () => {
    expect(reportPeriodKey("2026-03-31", "fiscal_year")).toBe("FY 2025-26");
    expect(reportPeriodKey("2026-04-01", "fiscal_year")).toBe("FY 2026-27");
    expect(reportPeriodKey("2026-07-01", "quarter")).toBe("2026-Q3");
    expect(groupFinanceReport([movement("4000", "revenue", 0, 100, "2026-03-31"), movement("4000", "revenue", 0, 200, "2026-04-01")], "fiscal_year").map((row) => row.period)).toEqual(["FY 2025-26", "FY 2026-27"]);
  });

  it("builds an inclusive immediately preceding comparison period", () => {
    expect(comparisonPeriodFor("2026-04-01", "2026-04-30")).toEqual({ from: "2026-03-02", to: "2026-03-31" });
    expect(comparisonPeriodFor("2024-02-29", "2024-02-29")).toEqual({ from: "2024-02-28", to: "2024-02-28" });
  });
});
