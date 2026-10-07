import { describe, expect, it } from "vitest";
import type { FinancialOutboxEvent } from "../../db/schema";
import { promotionFinanceFixture } from "../../fixtures/promotion-finance.fixtures";
import { FIXTURE_ORDERS } from "../../fixtures/financial-scenario.fixtures";
import { calculateInclusiveTax } from "../../utils/money";
import { buildDeliveredOrderPayload } from "../finance-events/order-recognition.payload";
import { projectFinanceReport, type FinanceMovement } from "../finance-reports/finance-report.policy";
import { buildRefundAllocations } from "../refunds/refund.policy";
import { buildProcessedRefundPosting } from "./refund-settlement-posting.policy";
import { buildDeliveredOrderPosting } from "./commerce-posting.policy";
import { validatePostingCommand } from "./ledger.policy";
import type { PostingCommand } from "./ledger.types";

const occurredAt = new Date("2026-07-05T12:30:00.000Z");
const event = (storeId: number, payload: Record<string, unknown>, eventType = "order.delivered"): FinancialOutboxEvent => ({
  id: storeId, eventId: `fixture-${storeId}`, eventType, schemaVersion: 1, sourceType: "order",
  sourceId: String(payload.orderId), sourceVersion: 1, storeId, currency: "INR", occurredAt,
  businessDate: "2026-07-05", timezone: "Asia/Kolkata", actorId: null, correlationId: null, causationId: null,
  payload, payloadHash: "a".repeat(64), status: "pending", attemptCount: 0, availableAt: occurredAt,
  claimedAt: null, claimedBy: null, processedAt: null, lastError: null, createdAt: occurredAt, updatedAt: occurredAt,
});
const movements = (command: PostingCommand): FinanceMovement[] => command.lines.map((line) => ({
  businessDate: command.businessDate, accountCode: line.accountCode, accountName: line.accountCode,
  accountType: line.accountCode === "4100" || line.accountCode === "4110" ? "contra_revenue" : "revenue",
  debitPaise: line.side === "debit" ? String(line.amountPaise) : "0",
  creditPaise: line.side === "credit" ? String(line.amountPaise) : "0",
}));

describe("promotion-adjusted store and platform finance", () => {
  it("validates every delivered financial demo fixture through the production recognition builder", () => {
    for (const fixture of FIXTURE_ORDERS.filter((order) => order.status === "delivered")) {
      const deliveryTax = calculateInclusiveTax(fixture.deliveryFeePaise, 500);
      const payload = buildDeliveredOrderPayload({
        ...fixture, pricingPolicyVersion: 4, discountMode: fixture.couponCode ? "coupon" : "none",
        deliveryTaxableAmountPaise: deliveryTax.taxableAmountPaise, deliveryTaxPaise: deliveryTax.taxPaise,
      }, fixture.items.map((item, index) => ({
        ...item, orderItemId: index + 1, costVersionId: 3, lineCostPaise: item.totalCostPaise, taxRateBps: 500,
      })), new Date(fixture.placedAt));
      expect(() => validatePostingCommand(buildDeliveredOrderPosting(event(fixture.storeId, payload)))).not.toThrow();
    }
  });

  it.each(["automatic_deals", "coupon"] as const)("recognizes one global %s promotion in two stores and consolidates once", (mode) => {
    const commands = ([1, 2] as const).map((storeId) => {
      const fixture = promotionFinanceFixture(storeId, mode);
      const payload = buildDeliveredOrderPayload(fixture.order, fixture.lines, occurredAt);
      const command = buildDeliveredOrderPosting(event(storeId, payload));
      expect(() => validatePostingCommand(command)).not.toThrow();
      expect(command.storeId).toBe(storeId);
      expect(command.lines.find((line) => line.accountCode === "4100")?.amountPaise).toBe(1_000 * storeId);
      expect(command.lines.find((line) => line.accountCode === "4000")?.amountPaise).toBe(10_000 * storeId);
      expect(command.lines.find((line) => line.accountCode === "2200")?.amountPaise).toBe(450 * storeId + (mode === "coupon" ? 250 : 0));
      expect(fixture.applications.find((row) => row.promotionId === 7)?.itemDiscountPaise).toBe(1_050 * storeId);
      const report = projectFinanceReport(movements(command)).totals;
      expect(report.recognizedRevenuePaise).toBe(String(9_000 * storeId + (mode === "coupon" ? 5_000 : 0)));
      return command;
    });
    const platform = projectFinanceReport(commands.flatMap(movements)).totals;
    expect(platform.discountsPaise).toBe("3000");
    expect(platform.recognizedRevenuePaise).toBe(mode === "coupon" ? "37000" : "27000");
    expect(BigInt(platform.recognizedRevenuePaise)).toBe(commands.reduce((sum, command) => sum + BigInt(projectFinanceReport(movements(command)).totals.recognizedRevenuePaise), 0n));
  });

  it("keeps free-delivery savings and bundle compare-at markdown out of 4100 and refunds", () => {
    const fixture = promotionFinanceFixture(1, "automatic_deals", true);
    const payload = buildDeliveredOrderPayload(fixture.order, fixture.lines, occurredAt);
    const command = buildDeliveredOrderPosting(event(1, payload));
    expect(() => validatePostingCommand(command)).not.toThrow();
    expect(command.lines.map((line) => line.accountCode)).not.toContain("4100");
    expect(command.lines.map((line) => line.accountCode)).not.toContain("4010");
    expect(projectFinanceReport(movements(command)).totals.recognizedRevenuePaise).toBe("10000");
    expect(fixture.applications[0].totalSavingsPaise).toBe(5_250);
    const refund = (amount: number) => buildRefundAllocations({
      input: { reasonCode: "damaged", amountPaise: amount, allocations: [{ orderItemId: fixture.lines[0].orderItemId, quantity: 1, allocatedPaise: amount }] },
      orderItems: fixture.lines.map((line) => ({ ...line, id: line.orderItemId, lineTotalPaise: line.taxableAmountPaise + line.taxPaise })),
      deliveryFeePaise: 0, deliveryTaxPaise: 0, existing: [],
    });
    expect(refund(10_500)[0]).toMatchObject({ amountPaise: 10_500, taxableAmountPaise: 10_000, taxPaise: 500, discountReversalPaise: 0 });
    expect(() => refund(15_750)).toThrow();
    expect(() => buildRefundAllocations({
      input: { reasonCode: "damaged", amountPaise: 1, allocations: [{ type: "delivery_fee", allocatedPaise: 1 }] },
      orderItems: [], deliveryFeePaise: 0, deliveryTaxPaise: 0, existing: [],
    })).toThrow();
  });

  it("reverses only paid post-discount revenue and saved tax on a delivered refund", () => {
    const fixture = promotionFinanceFixture(1);
    const allocations = buildRefundAllocations({
      input: { reasonCode: "damaged", amountPaise: 9_450, allocations: [{ orderItemId: 201, quantity: 1, allocatedPaise: 9_450 }] },
      orderItems: fixture.lines.map((line) => ({ ...line, id: line.orderItemId, lineTotalPaise: line.taxableAmountPaise + line.taxPaise })),
      deliveryFeePaise: 0, deliveryTaxPaise: 0, existing: [],
    });
    const refund = buildProcessedRefundPosting(event(1, {
      refundId: 3, orderId: 101, paymentAttemptId: 4, totalPaise: 9_450, provider: "razorpay",
      providerReference: "rfnd_fixture", processedAt: occurredAt.toISOString(), fulfilmentState: "delivered",
      recognizedAt: occurredAt.toISOString(), allocations,
    }, "refund.processed"));
    expect(() => validatePostingCommand(refund)).not.toThrow();
    expect(refund.lines).toEqual(expect.arrayContaining([
      expect.objectContaining({ accountCode: "4110", amountPaise: 9_000 }),
      expect.objectContaining({ accountCode: "2200", amountPaise: 450 }),
      expect.objectContaining({ accountCode: "2100", amountPaise: 9_450 }),
    ]));
    const delivery = buildDeliveredOrderPosting(event(1, buildDeliveredOrderPayload(fixture.order, fixture.lines, occurredAt)));
    expect(projectFinanceReport([...movements(delivery), ...movements(refund)]).totals.recognizedRevenuePaise).toBe("0");
  });

  it("rejects inconsistent paid snapshots and unbalanced posting payloads", () => {
    const fixture = promotionFinanceFixture(1);
    expect(() => buildDeliveredOrderPayload({ ...fixture.order, discountPaise: 1_051 }, fixture.lines, occurredAt)).toThrowError(expect.objectContaining({ code: "ORDER_RECOGNITION_MISMATCH" }));
    const payload = buildDeliveredOrderPayload(fixture.order, fixture.lines, occurredAt);
    expect(() => buildDeliveredOrderPosting(event(1, { ...payload, customerTotalPaise: 9_451 }))).toThrowError(expect.objectContaining({ code: "INVALID_POSTING_EVENT" }));
  });
});
