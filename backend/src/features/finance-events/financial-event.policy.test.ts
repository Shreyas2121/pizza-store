import { describe, expect, it } from "vitest";
import { AppError } from "../../utils/error";
import { hashFinancialEvent, safeOutboxError, validateFinancialEvent } from "./financial-event.policy";

const event = {
  eventType: "settlement.reconciled" as const,
  schemaVersion: 1,
  sourceType: "settlement_batch",
  sourceId: 7,
  sourceVersion: 1,
  storeId: 2,
  currency: "INR" as const,
  occurredAt: new Date("2026-08-15T06:00:00.000Z"),
  businessDate: "2026-08-15",
  timezone: "Asia/Kolkata",
  payload: { netAmountPaise: 68_348, batchId: 7 },
};

describe("financial event policy", () => {
  it("hashes logically identical payloads deterministically", () => {
    expect(hashFinancialEvent(event)).toBe(hashFinancialEvent({
      ...event,
      payload: { batchId: 7, netAmountPaise: 68_348 },
    }));
  });

  it("rejects invalid versions and non-INR events", () => {
    expect(() => validateFinancialEvent({ ...event, sourceVersion: 0 })).toThrow(AppError);
    expect(() => validateFinancialEvent({ ...event, currency: "USD" as "INR" })).toThrow("currency");
  });

  it("sanitizes retry errors without preserving multiline payloads", () => {
    expect(safeOutboxError(new Error("provider\nsecret\tdata"))).toBe("provider secret data");
  });
});
