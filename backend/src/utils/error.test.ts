import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { logger } from "./logger";
import { AppError, handleError, handleErrorWithAudit } from "./error";
import { setRequestFailureAuditor } from "./request-failure-audit";

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

  it("fails closed when a required high-risk audit cannot be persisted", async () => {
    const req = { ...request } as never;
    setRequestFailureAuditor(req, vi.fn().mockRejectedValue(new Error("database unavailable")));
    const res = response();
    const log = vi.spyOn(logger, "error").mockImplementation(() => logger);

    await handleErrorWithAudit(new AppError("Permission denied.", 403, "PERMISSION_DENIED"), req, res.value);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Internal Server Error", code: "AUDIT_PERSISTENCE_FAILED" });
    expect(JSON.stringify(log.mock.calls)).not.toContain("database unavailable");
  });

  it("preserves the hidden-resource response after a denial audit succeeds", async () => {
    const req = { ...request } as never;
    const audit = vi.fn().mockResolvedValue(undefined);
    setRequestFailureAuditor(req, audit);
    const res = response();

    await handleErrorWithAudit(new AppError("Resource not found.", 404, "RESOURCE_NOT_FOUND"), req, res.value);

    expect(audit).toHaveBeenCalledOnce();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Resource not found.", code: "RESOURCE_NOT_FOUND" });
  });
});
