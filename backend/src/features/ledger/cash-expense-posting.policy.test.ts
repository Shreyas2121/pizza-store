import { describe, expect, it } from "vitest";
import type { FinancialOutboxEvent } from "../../db/schema";
import { buildCashClosurePosting, buildCashMovementPosting, buildCashReopenReversal, buildExpensePosting, buildExpenseReversal } from "./cash-expense-posting.policy";

const event = (eventType: FinancialOutboxEvent["eventType"], payload: Record<string, unknown>): FinancialOutboxEvent => ({
  id: 2, eventId: "evt-2", eventType, schemaVersion: 1, sourceType: eventType.startsWith("expense") ? "expense" : eventType.startsWith("cash.session") ? "cash_session" : "cash_movement", sourceId: "8", sourceVersion: 3,
  storeId: 1, currency: "INR", occurredAt: new Date("2026-09-06T08:00:00.000Z"), businessDate: "2026-09-06", timezone: "Asia/Kolkata", actorId: 7,
  correlationId: "corr-2", causationId: null, payload, payloadHash: "b".repeat(64), status: "processing", attemptCount: 1, availableAt: new Date(), claimedAt: new Date(), claimedBy: "worker", processedAt: null, lastError: null, createdAt: new Date(), updatedAt: new Date(),
});

describe("cash and expense posting policy", () => {
  it("posts deposits while leaving COD and refund movements as evidence only", () => {
    const deposit = buildCashMovementPosting(event("cash.movement_recorded", { movementId: 8, sessionId: 3, type: "deposit", amountPaise: -20_000, orderId: null, refundId: null, reversesMovementId: null, reason: "Bank deposit" }));
    expect(deposit && "lines" in deposit ? deposit.lines : []).toEqual([expect.objectContaining({ accountCode: "1010", side: "debit", amountPaise: 20_000 }), expect.objectContaining({ accountCode: "1000", side: "credit", amountPaise: 20_000 })]);
    expect(buildCashMovementPosting(event("cash.movement_recorded", { movementId: 9, sessionId: 3, type: "cod_collection", amountPaise: 10_000, orderId: 4, refundId: null, reversesMovementId: null, reason: null }))).toBeNull();
  });

  it("requires explicit mappings for unsupported manual cash movements", () => {
    expect(() => buildCashMovementPosting(event("cash.movement_recorded", { movementId: 8, sessionId: 3, type: "cash_out", amountPaise: -2_000, orderId: null, refundId: null, reversesMovementId: null, reason: "Supplies" }))).toThrowError(expect.objectContaining({ code: "CASH_LEDGER_MAPPING_REQUIRED" }));
  });

  it("posts shortages and overages to cash over/short and skips zero variance", () => {
    expect(buildCashClosurePosting(event("cash.session_closed", { sessionId: 3, variancePaise: -500, closedAt: "2026-09-06T08:00:00.000Z" }))?.lines).toEqual([expect.objectContaining({ accountCode: "6100", side: "debit", amountPaise: 500 }), expect.objectContaining({ accountCode: "1000", side: "credit", amountPaise: 500 })]);
    expect(buildCashClosurePosting(event("cash.session_closed", { sessionId: 3, variancePaise: 300, closedAt: "2026-09-06T08:00:00.000Z" }))?.lines[0]).toMatchObject({ accountCode: "1000", side: "debit", amountPaise: 300 });
    expect(buildCashClosurePosting(event("cash.session_closed", { sessionId: 3, variancePaise: 0, closedAt: "2026-09-06T08:00:00.000Z" }))).toBeNull();
  });

  it("uses exact source identities for movement and session reversals", () => {
    const movement = buildCashMovementPosting(event("cash.movement_recorded", { movementId: 9, sessionId: 3, type: "adjustment", amountPaise: 20_000, orderId: null, refundId: null, reversesMovementId: 8, reason: "Deposit recorded in error" }));
    expect(movement && "originalSource" in movement ? movement.originalSource : null).toEqual({ sourceType: "cash_movement", sourceId: 8, eventType: "cash.movement_recorded", sourceVersion: 1 });
    const reopened = buildCashReopenReversal(event("cash.session_reopened", { sessionId: 3, originalCloseSource: { sourceType: "cash_session", sourceId: 3, eventType: "cash.session_closed", sourceVersion: 2 }, priorVariancePaise: -500, reason: "Recount", authorizedActorId: 7, reopenedAt: "2026-09-06T08:00:00.000Z" }));
    expect(reopened?.originalSource.sourceVersion).toBe(2);
    expect(buildCashReopenReversal(event("cash.session_reopened", { sessionId: 3, originalCloseSource: { sourceType: "cash_session", sourceId: 3, eventType: "cash.session_closed", sourceVersion: 2 }, priorVariancePaise: 0, reason: "Recount", authorizedActorId: 7, reopenedAt: "2026-09-06T08:00:00.000Z" }))).toBeNull();
  });

  it("posts inclusive expense allocations only to explicit accounts", () => {
    const command = buildExpensePosting(event("expense.posted", { expenseId: 12, totalPaise: 15_000, paymentMethod: "cash", paymentReference: "petty-12", paidAt: "2026-09-05T08:00:00.000Z", postedAt: "2026-09-06T08:00:00.000Z", allocations: [{ storeId: 1, categoryId: 4, ledgerAccountId: 22, ledgerAccountCode: "6901", costCenter: "kitchen", amountPaise: 15_000 }] }));
    expect(command.lines).toEqual([expect.objectContaining({ accountCode: "6901", side: "debit", amountPaise: 15_000 }), expect.objectContaining({ accountCode: "1000", side: "credit", amountPaise: 15_000 })]);
  });

  it("rejects missing expense mappings and links exact expense reversals", () => {
    expect(() => buildExpensePosting(event("expense.posted", { expenseId: 12, totalPaise: 15_000, paymentMethod: "cash", paymentReference: null, paidAt: "2026-09-05T08:00:00.000Z", postedAt: "2026-09-06T08:00:00.000Z", allocations: [{ storeId: 1, categoryId: 4, ledgerAccountId: 22, costCenter: null, amountPaise: 15_000 }] }))).toThrowError(expect.objectContaining({ code: "INVALID_POSTING_EVENT" }));
    const result = buildExpenseReversal(event("expense.reversed", { expenseId: 12, originalPostingSource: { sourceType: "expense", sourceId: 12, eventType: "expense.posted", sourceVersion: 4 }, reason: "Duplicate bill", authorizedActorId: 7, effectiveBusinessDate: "2026-09-06" }));
    expect(result.originalSource).toEqual({ sourceType: "expense", sourceId: 12, eventType: "expense.posted", sourceVersion: 4 });
  });
});
