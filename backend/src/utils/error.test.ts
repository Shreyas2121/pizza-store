import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { logger } from "./logger";
import { AppError, handleError } from "./error";

const request = { method: "POST", path: "/api/v1/finance/payroll/pay-runs/4/pay" } as never;
const response = () => {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  return { value: { status } as never, status, json };
};

describe("safe request error logging", () => {
  it("logs only stable error metadata, never sensitive error messages or data", () => {
    const log = vi.spyOn(logger, "error").mockImplementation(() => logger);
    const res = response();
    handleError(new AppError("Payment UTR-PRIVATE failed", 409, "PAYMENT_FAILED", { paymentReference: "UTR-PRIVATE" }), request, res.value);
    expect(log).toHaveBeenCalledWith("Request failed", {
      status: 409, code: "PAYMENT_FAILED", method: "POST", path: request.path,
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain("UTR-PRIVATE");
  });

  it("does not log rejected validation input", () => {
    const log = vi.spyOn(logger, "error").mockImplementation(() => logger);
    const res = response();
    const error = z.object({ paymentReference: z.string().min(20) }).safeParse({ paymentReference: "UTR-PRIVATE" });
    if (error.success) throw new Error("Expected validation failure");
    handleError(error.error, request, res.value);
    expect(JSON.stringify(log.mock.calls)).not.toContain("UTR-PRIVATE");
    expect(log).toHaveBeenCalledWith("Request validation failed", expect.objectContaining({ issueCount: 1 }));
  });
});
