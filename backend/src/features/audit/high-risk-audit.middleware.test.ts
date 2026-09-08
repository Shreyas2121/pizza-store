import { describe, expect, it, vi } from "vitest";
import { AppError } from "../../utils/error";
import { auditRequestFailure } from "../../utils/request-failure-audit";
import type { Auth } from "../../utils/types";
import auditService from "./audit.service";
import { auditHighRiskOperation } from "./high-risk-audit.middleware";

const actor = { userId: 4, email: "finance@example.com", platformRole: "user" as const, tokenVersion: 1 };

describe("high-risk audit middleware", () => {
  it("records masked resource denials without copying request payloads", async () => {
    const req = {
      params: { expenseId: "91" },
      body: { paymentReference: "UTR-PRIVATE", bankDetails: "PRIVATE" },
      principal: actor,
    } as unknown as Auth;
    const writeAttempt = vi.spyOn(auditService, "writeAttempt").mockResolvedValue();
    const next = vi.fn();
    auditHighRiskOperation({
      operation: "expense.pay",
      resourceType: "expense",
      resourceId: (request) => request.params.expenseId,
    })(req, {} as never, next);

    await auditRequestFailure(req, new AppError("Resource not found.", 404, "RESOURCE_NOT_FOUND"));

    expect(next).toHaveBeenCalledOnce();
    expect(writeAttempt).toHaveBeenCalledWith({
      actor,
      storeId: null,
      operation: "expense.pay",
      resourceType: "expense",
      resourceId: "91",
      outcome: "denied",
      reasonCode: "RESOURCE_NOT_FOUND",
    });
    expect(JSON.stringify(writeAttempt.mock.calls)).not.toContain("UTR-PRIVATE");
  });

  it("records validation and operational errors with stable reason codes", async () => {
    const req = { params: {}, body: { storeId: 2 }, principal: actor } as unknown as Auth;
    const writeAttempt = vi.spyOn(auditService, "writeAttempt").mockResolvedValue();
    auditHighRiskOperation({
      operation: "ledger.manual_journal_post",
      resourceType: "journal_entry",
      resourceId: () => "new",
      storeId: (request) => request.body.storeId,
    })(req, {} as never, vi.fn());

    await auditRequestFailure(req, new AppError("Period is closed.", 409, "FISCAL_PERIOD_CLOSED"));

    expect(writeAttempt).toHaveBeenCalledWith(expect.objectContaining({
      storeId: 2,
      outcome: "failure",
      reasonCode: "FISCAL_PERIOD_CLOSED",
    }));
  });
});
