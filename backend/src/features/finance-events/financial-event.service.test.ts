import { describe, expect, it, vi } from "vitest";
import { FinancialEventService } from "./financial-event.service";

const input = {
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
  payload: { batchId: 7, netAmountPaise: 68_348 },
};

describe("financial event service", () => {
  it("returns an identical source event on retry and rejects conflicting content", async () => {
    let stored: { payloadHash: string } | undefined;
    const repository = {
      create: vi.fn(async (_tx, value) => {
        if (!stored) stored = { payloadHash: value.payloadHash };
        return { event: stored, created: false };
      }),
    };
    const service = new FinancialEventService(repository as never);
    await expect(service.write({} as never, input)).resolves.toBe(stored);
    await expect(service.write({} as never, input)).resolves.toBe(stored);
    await expect(service.write({} as never, { ...input, payload: { batchId: 7, netAmountPaise: 1 } }))
      .rejects.toMatchObject({ code: "FINANCIAL_EVENT_CONFLICT" });
  });

  it("lets concurrent workers receive disjoint claimed events", async () => {
    const queue = [{ eventId: "one" }, { eventId: "two" }];
    const repository = {
      transaction: (work: (tx: never) => Promise<unknown>) => work({} as never),
      claim: vi.fn(async () => {
        const event = queue.shift();
        return event ? [event] : [];
      }),
    };
    const service = new FinancialEventService(repository as never);
    const [left, right] = await Promise.all([service.claim("worker-a", 1), service.claim("worker-b", 1)]);
    expect([...left, ...right].map((item) => item.eventId).sort()).toEqual(["one", "two"]);
  });

  it("uses bounded exponential retry timing and sanitized failure text", async () => {
    const markFailed = vi.fn().mockResolvedValue({ status: "failed" });
    const repository = {
      transaction: (work: (tx: never) => Promise<unknown>) => work({} as never),
      markFailed,
    };
    const service = new FinancialEventService(repository as never);
    const now = new Date("2026-09-04T00:00:00.000Z");
    await service.markFailed({ eventId: "evt", workerId: "worker", cause: new Error("bad\nvalue"), attemptCount: 3 }, now);
    expect(markFailed).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      error: "FINANCIAL_POSTING_ERROR: Financial event processing failed",
      availableAt: new Date("2026-09-04T00:00:08.000Z"),
    }));
  });

  it("does not claim when a posting worker has no registered event types", async () => {
    const repository = { transaction: vi.fn(), claim: vi.fn() };
    const service = new FinancialEventService(repository as never);
    await expect(service.claim("worker", 25, 10, new Date(), 60_000, [])).resolves.toEqual([]);
    expect(repository.transaction).not.toHaveBeenCalled();
  });
});
