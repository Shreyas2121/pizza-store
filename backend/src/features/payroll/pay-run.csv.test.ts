import { describe, expect, it } from "vitest";
import { buildPayRunCsv, payRunExportFilename } from "./pay-run.csv";

describe("pay run CSV", () => {
  const detail = {
    run: { id: 8, storeId: 2, periodStart: "2026-08-01", periodEnd: "2026-08-31", status: "calculated", currency: "INR", demoOnly: true },
    employees: [{
      employeeCode: "=HYPERLINK(1)", displayName: "+Private", grossPayPaise: 100_000,
      deductionPaise: 10_000, netPayPaise: 90_000, employerCostPaise: 5_000,
      totalEmployerCostPaise: 105_000,
      lines: [{ type: "earning", componentCode: "BASE", componentName: "Base", amountPaise: 100_000 }],
    }],
  };

  it("escapes formula-capable employee text and labels every paise field", () => {
    const csv = buildPayRunCsv(detail);
    expect(csv).toContain("'=HYPERLINK(1)");
    expect(csv).toContain("'+Private");
    expect(csv.split("\r\n")[0]).toContain("amount_paise");
    expect(csv).not.toContain("payment_reference");
  });

  it("uses a deterministic store and period filename", () => {
    expect(payRunExportFilename(detail.run)).toBe("payroll-run-8-store-2-2026-08-01-2026-08-31.csv");
  });
});
