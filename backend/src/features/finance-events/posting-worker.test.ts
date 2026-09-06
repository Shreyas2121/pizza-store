import { describe, expect, it, vi } from "vitest";
import { AppError } from "../../utils/error";
import { PostingWorker } from "./posting-worker";

const event = (eventId: string, attemptCount = 1) => ({ eventId, attemptCount });

describe("posting worker", () => {
  it("claims only registered event types and finalizes successful work", async () => {
    const events = {
      claim: vi.fn().mockResolvedValue([event("evt-1")]),
      markProcessed: vi.fn().mockResolvedValue({ status: "processed" }),
      markFailed: vi.fn(),
    };
    const processor = {
      supportedEventTypes: ["order.delivered"] as const,
      process: vi.fn().mockResolvedValue({ journalId: 9 }),
    };
    const result = await new PostingWorker(processor as never, events as never)
      .runOnce("ledger-worker", 10, new Date("2026-09-06T10:00:00.000Z"));
    expect(events.claim).toHaveBeenCalledWith(
      "ledger-worker", 10, 10, new Date("2026-09-06T10:00:00.000Z"), 300_000, ["order.delivered"]
    );
    expect(events.markProcessed).toHaveBeenCalledWith("evt-1", "ledger-worker", expect.any(Date));
    expect(result).toEqual({ claimed: 1, processed: 1, failed: 0, leaseLost: 0 });
  });

  it("leaves posting failures retryable and never includes an event payload in failure handling", async () => {
    const cause = new AppError("Ledger account is unavailable.", 409, "LEDGER_ACCOUNT_UNAVAILABLE");
    const claimed = { ...event("evt-2", 3), payload: { privateReceipt: "must-not-be-forwarded" } };
    const events = {
      claim: vi.fn().mockResolvedValue([claimed]),
      markProcessed: vi.fn(),
      markFailed: vi.fn().mockResolvedValue({ status: "failed" }),
    };
    const processor = {
      supportedEventTypes: ["order.delivered"] as const,
      process: vi.fn().mockRejectedValue(cause),
    };
    const result = await new PostingWorker(processor as never, events as never).runOnce("ledger-worker");
    expect(events.markFailed).toHaveBeenCalledWith({
      eventId: "evt-2", workerId: "ledger-worker", cause, attemptCount: 3,
    }, expect.any(Date));
    expect(JSON.stringify(events.markFailed.mock.calls)).not.toContain("must-not-be-forwarded");
    expect(result).toEqual({ claimed: 1, processed: 0, failed: 1, leaseLost: 0 });
  });

  it("reports a lost lease without overwriting another worker's result", async () => {
    const events = {
      claim: vi.fn().mockResolvedValue([event("evt-3")]),
      markProcessed: vi.fn().mockResolvedValue(undefined),
      markFailed: vi.fn(),
    };
    const processor = { supportedEventTypes: ["order.delivered"] as const, process: vi.fn() };
    await expect(new PostingWorker(processor as never, events as never).runOnce("stale-worker"))
      .resolves.toEqual({ claimed: 1, processed: 0, failed: 0, leaseLost: 1 });
    expect(events.markFailed).not.toHaveBeenCalled();
  });
});
