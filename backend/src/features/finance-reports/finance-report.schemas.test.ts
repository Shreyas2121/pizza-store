import { describe, expect, it } from "vitest";
import { financeReportQuerySchema, groupedFinanceReportQuerySchema } from "./finance-report.schemas";

describe("finance report schemas", () => {
  it("parses exact ISO filters and bounded grouping", () => {
    expect(groupedFinanceReportQuerySchema.parse({ from: "2026-04-01", to: "2027-03-31", storeId: "2", groupBy: "fiscal_year" })).toEqual({ from: "2026-04-01", to: "2027-03-31", storeId: 2, groupBy: "fiscal_year" });
    expect(financeReportQuerySchema.parse({ from: "2026-04-01", to: "2026-04-01" })).toEqual({ from: "2026-04-01", to: "2026-04-01" });
  });

  it("rejects reversed ranges, unknown fields, and invalid groupings", () => {
    expect(() => financeReportQuerySchema.parse({ from: "2026-04-02", to: "2026-04-01" })).toThrow();
    expect(() => financeReportQuerySchema.parse({ from: "2026-04-01", to: "2026-04-02", surprise: true })).toThrow();
    expect(() => groupedFinanceReportQuerySchema.parse({ from: "2026-04-01", to: "2026-04-02", groupBy: "week" })).toThrow();
  });
});
