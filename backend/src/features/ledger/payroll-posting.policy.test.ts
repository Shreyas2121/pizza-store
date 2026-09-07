import { describe, expect, it } from "vitest";
import type { FinancialOutboxEvent } from "../../db/schema";
import { buildPayRunPosting, buildPayRunReversal } from "./payroll-posting.policy";

const event = (eventType: string, payload: Record<string, unknown>) => ({
  eventId: "11111111-1111-4111-8111-111111111111", eventType, schemaVersion: 1,
  sourceType: "pay_run", sourceId: "7", sourceVersion: eventType === "pay_run.posted" ? 5 : 6,
  storeId: 2, currency: "INR", occurredAt: new Date("2026-09-07T10:00:00Z"), businessDate: "2026-08-31",
  timezone: "Asia/Kolkata", actorId: 9, correlationId: null, causationId: null, payload,
} as FinancialOutboxEvent);

describe("payroll ledger posting policy", () => {
  it("posts employer cost, net pay, deductions/liabilities, and bank clearing as a balanced journal", () => {
    const result = buildPayRunPosting(event("pay_run.posted", {
      payRunId: 7, periodStart: "2026-08-01", periodEnd: "2026-08-31", grossPayPaise: 300_000,
      deductionPaise: 10_000, netPayPaise: 290_000, employerCostPaise: 20_000,
      totalEmployerCostPaise: 320_000, paymentReferenceRecorded: true, postedAt: "2026-09-07T10:00:00.000Z",
    }));
    expect(result.lines.map(({ accountCode, side, amountPaise }) => ({ accountCode, side, amountPaise }))).toEqual([
      { accountCode: "6200", side: "debit", amountPaise: 320_000 },
      { accountCode: "2300", side: "credit", amountPaise: 290_000 },
      { accountCode: "2310", side: "credit", amountPaise: 30_000 },
      { accountCode: "2300", side: "debit", amountPaise: 290_000 },
      { accountCode: "1010", side: "credit", amountPaise: 290_000 },
    ]);
  });

  it("builds an exact reversal command without employee or payment details", () => {
    const result = buildPayRunReversal(event("pay_run.reversed", {
      payRunId: 7, originalPostingSource: { sourceType: "pay_run", sourceId: 7, eventType: "pay_run.posted", sourceVersion: 5 },
      reason: "Correction", authorizedActorId: 9, effectiveBusinessDate: "2026-09-07",
    }));
    expect(result.originalSource).toEqual({ sourceType: "pay_run", sourceId: 7, eventType: "pay_run.posted", sourceVersion: 5 });
    expect(JSON.stringify(result)).not.toContain("paymentReference");
  });

  it("omits zero-value bank and payroll-payable lines", () => {
    const result = buildPayRunPosting(event("pay_run.posted", {
      payRunId: 7, periodStart: "2026-08-01", periodEnd: "2026-08-31", grossPayPaise: 100_000,
      deductionPaise: 100_000, netPayPaise: 0, employerCostPaise: 0,
      totalEmployerCostPaise: 100_000, paymentReferenceRecorded: true, postedAt: "2026-09-07T10:00:00.000Z",
    }));
    expect(result.lines.map((line) => line.accountCode)).toEqual(["6200", "2310"]);
  });
});
