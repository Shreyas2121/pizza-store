import { describe, expect, it } from "vitest";
import { reconcileFinancialScenarioReports } from "./reconcile-financial-scenario";

describe("financial scenario report reconciliation", () => {
  it("reconciles every screen report and CSV export to the checked-in expected results", async () => {
    await expect(reconcileFinancialScenarioReports()).resolves.toEqual({
      checkedReports: 12,
      checkedCsvExports: 12,
      storeMonths: 4,
      expectedSource: "financial-scenario.fixtures.ts",
    });
  });
});
