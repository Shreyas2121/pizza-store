import { describe, expect, it, vi } from "vitest";
import { currentRequestId, requestContextMiddleware } from "./request-context";

describe("request context", () => {
  it("accepts a bounded safe request ID and exposes it within the request", () => {
    const setHeader = vi.fn();
    const requestId = "123e4567-e89b-42d3-a456-426614174000";
    const next = vi.fn(() => expect(currentRequestId()).toBe(requestId));
    requestContextMiddleware(
      { get: vi.fn().mockReturnValue(requestId) } as never,
      { setHeader } as never,
      next,
    );
    expect(setHeader).toHaveBeenCalledWith("X-Request-ID", requestId);
    expect(next).toHaveBeenCalledOnce();
  });

  it("replaces unsafe request IDs instead of persisting them", () => {
    const setHeader = vi.fn();
    requestContextMiddleware(
      { get: vi.fn().mockReturnValue("ABCDE1234F") } as never,
      { setHeader } as never,
      vi.fn(),
    );
    expect(setHeader.mock.calls[0][1]).toMatch(/^[0-9a-f-]{36}$/);
  });
});
