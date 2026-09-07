import { describe, expect, it } from "vitest";
import { buildFinanceReportCsv, escapeCsvField, financeExportFilename } from "./finance-report.csv";
import { profitAndLossResponseSchema } from "./finance-report.schemas";

const totals = {
  salesRevenuePaise: "10000", deliveryRevenuePaise: "500", discountsPaise: "200", refundsPaise: "100",
  recognizedRevenuePaise: "10200", collectionsPaise: "10300", cogsPaise: "4000", grossProfitPaise: "6200",
  grossMarginBps: 6078, operatingExpensesPaise: "300", payrollCostPaise: "0", operatingResultPaise: "5900",
  unsettledRazorpayPaise: "800", cashVariancePaise: "-50",
};

const report = profitAndLossResponseSchema.parse({
  policy: { currency: "INR", timezone: "Asia/Kolkata", dateBasis: "journal_business_date", recognitionBasis: "delivery", includedJournalStatuses: ["posted", "reversed"], generatedAt: "2026-05-01T00:00:00.000Z", lastReconciledAt: "2026-04-29T10:00:00.000Z", scope: { kind: "store", storeIds: [7] } },
  period: { from: "2026-04-01", to: "2026-04-30" }, comparisonPeriod: { from: "2026-03-02", to: "2026-03-31" }, groupBy: "month",
  totals,
  operatingExpenseLines: [{ accountCode: "6901", accountName: "=HYPERLINK(\"bad\")", amountPaise: "300" }],
  periods: [{ period: "2026-04", recognizedRevenuePaise: "10200", cogsPaise: "4000", grossProfitPaise: "6200", grossMarginBps: 6078, operatingExpensesPaise: "300", payrollCostPaise: "0", operatingResultPaise: "5900" }],
  comparison: { totals, operatingExpenseLines: [], periods: [] },
});

describe("finance report CSV", () => {
  it("uses deterministic policy headings, explicit units, and safe fields", () => {
    const csv = buildFinanceReportCsv({ reportType: "profit-and-loss", report });
    expect(csv.split("\r\n")[0]).toBe("report_type,scope_kind,store_ids,period_from,period_to,comparison_from,comparison_to,timezone,currency,date_basis,recognition_basis,included_journal_statuses,generated_at,last_reconciled_at,amount_unit,group_by,row_type,row_key,account_code,account_name,metric,value");
    expect(csv).toContain("profit-and-loss,store,7,2026-04-01,2026-04-30,2026-03-02,2026-03-31,Asia/Kolkata,INR,journal_business_date,delivery,posted|reversed,2026-05-01T00:00:00.000Z,2026-04-29T10:00:00.000Z,paise");
    expect(csv).toContain("basis_points,month,current_total,current,,,grossMarginBps,6078");
    expect(csv).toContain("paise,month,current_total,current,,,cashVariancePaise,-50");
    expect(csv).toContain('6901,"\'=HYPERLINK(""bad"")"');
    expect(financeExportFilename("profit-and-loss", report)).toBe("finance-profit-and-loss-store-7-2026-04-01-2026-04-30.csv");
  });

  it.each(["=1+1", "+cmd", "-2+3", "@SUM(A1)", "  =cmd", "\tcmd"])('neutralizes spreadsheet formula field %j', (value) => {
    expect(escapeCsvField(value)).toMatch(/^'/);
  });

  it("quotes commas, quotes, and line breaks according to RFC 4180", () => {
    expect(escapeCsvField('Rent, "April"\npaid')).toBe('"Rent, ""April""\npaid"');
  });
});
