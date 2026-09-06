import { describe, expect, it } from "vitest";
import { businessDateFor } from "../../utils/business-date";
import { createFiscalPeriodSchema, journalsQuerySchema, manualJournalSchema } from "./ledger.schemas";

describe("ledger API schemas", () => {
  it("accepts periods on both sides of the Indian financial-year boundary", () => {
    expect(createFiscalPeriodSchema.parse({ storeId: 1, name: "FY 2025-26", startDate: "2025-04-01", endDate: "2026-03-31", reason: "Open financial year" }).endDate).toBe("2026-03-31");
    expect(createFiscalPeriodSchema.parse({ storeId: 1, name: "FY 2026-27", startDate: "2026-04-01", endDate: "2027-03-31", reason: "Open financial year" }).startDate).toBe("2026-04-01");
  });

  it("uses the store timezone at the 31 March/1 April boundary", () => {
    expect(businessDateFor(new Date("2026-03-31T18:29:59.999Z"), "Asia/Kolkata")).toBe("2026-03-31");
    expect(businessDateFor(new Date("2026-03-31T18:30:00.000Z"), "Asia/Kolkata")).toBe("2026-04-01");
  });

  it("rejects reversed ranges and one-line manual journals", () => {
    expect(() => createFiscalPeriodSchema.parse({ storeId: 1, name: "Bad", startDate: "2026-04-01", endDate: "2026-03-31", reason: "Invalid range" })).toThrow();
    expect(() => manualJournalSchema.parse({ storeId: 1, businessDate: "2026-04-01", description: "One-sided entry", lines: [{ accountCode: "1000", side: "debit", amountPaise: 100 }] })).toThrow();
  });

  it("parses safe journal drill-down filters", () => {
    expect(journalsQuerySchema.parse({ storeId: "1", accountCodes: "4000,4010,4110", accountTypes: "revenue,contra_revenue", eventType: "order.delivered" })).toMatchObject({
      storeId: 1, accountCodes: ["4000", "4010", "4110"], accountTypes: ["revenue", "contra_revenue"], eventType: "order.delivered",
    });
    expect(journalsQuerySchema.parse({ accountCodes: "1100" }).storeId).toBeUndefined();
    expect(() => journalsQuerySchema.parse({ storeId: "1", accountCodes: "4000);drop table" })).toThrow();
  });
});
