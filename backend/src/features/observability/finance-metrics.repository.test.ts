import { describe, expect, it, vi } from "vitest";
import { FinanceMetricsRepository } from "./finance-metrics.repository";

describe("finance metrics repository", () => {
  it("maps database aggregates without exposing row identifiers", async () => {
    const responses = [
      { rows: [{ status: "failed", count: "2", retry_count: "7", oldest_age_seconds: "3600" }] },
      { rows: [{ status: "pending", age_bucket: "lt_1h", count: "3" }] },
      { rows: [{ age_bucket: "1h_24h", count: "1", amount_paise: "45000" }] },
      { rows: [{ match_status: "matched", count: "8", variance_paise: "0" }] },
      { rows: [{ open_sessions: "2", variance_paise: "-100" }] },
    ];
    const client = { query: vi.fn().mockImplementation(async () => responses.shift()) };
    const result = await new FinanceMetricsRepository(client as never).snapshot();
    expect(result.outbox.find((row) => row.status === "failed")).toEqual({ status: "failed", count: 2, retryCount: 7, oldestAgeSeconds: 3600 });
    expect(result.outbox.find((row) => row.status === "dead_letter")?.count).toBe(0);
    expect(result.unsettled).toEqual([{ ageBucket: "1h_24h", count: 1, amountPaise: 45000 }]);
    expect(result.openCashSessions).toBe(2);
    expect(JSON.stringify(result)).not.toMatch(/orderId|paymentId|employeeId|email/i);
  });
});
