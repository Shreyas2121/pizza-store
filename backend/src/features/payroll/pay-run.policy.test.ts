import { describe, expect, it } from "vitest";
import { calculatePayRunSnapshot, hashPayRunPayload, requireIndependentApprover, requireIndependentPayer, requirePayRunStatus, requireRecentPayrollAuthentication } from "./pay-run.policy";

describe("pay run policy", () => {
  it("builds deterministic exact employee and run snapshots", () => {
    const result = calculatePayRunSnapshot([
      { profileId: 2, compensationVersionId: 20, employeeCode: "EMP-2", displayName: "Second", components: [
        { id: 3, type: "deduction", code: "DEMO_DEDUCTION", name: "Demo deduction", amountPaise: 10_000 },
        { id: 2, type: "earning", code: "BASE", name: "Base", amountPaise: 200_000 },
        { id: 4, type: "employer_cost", code: "DEMO_EMPLOYER", name: "Demo employer cost", amountPaise: 20_000 },
      ] },
      { profileId: 1, compensationVersionId: 10, employeeCode: "EMP-1", displayName: "First", components: [
        { id: 1, type: "earning", code: "BASE", name: "Base", amountPaise: 100_000 },
      ] },
    ]);
    expect(result.employees.map((item) => item.profileId)).toEqual([1, 2]);
    expect(result.employees[1]).toMatchObject({ grossPayPaise: 200_000, deductionPaise: 10_000, netPayPaise: 190_000, employerCostPaise: 20_000, totalEmployerCostPaise: 220_000 });
    expect(result.totals).toEqual({ employeeCount: 2, grossPayPaise: 300_000, deductionPaise: 10_000, netPayPaise: 290_000, employerCostPaise: 20_000, totalEmployerCostPaise: 320_000 });
  });

  it("uses stable payload hashing regardless of object key order", () => {
    expect(hashPayRunPayload({ action: "pay", value: { b: 2, a: 1 } })).toBe(hashPayRunPayload({ value: { a: 1, b: 2 }, action: "pay" }));
  });

  it("enforces state, recent authentication, and three-way duty separation", () => {
    expect(() => requirePayRunStatus("paid", ["approved"])).toThrowError(expect.objectContaining({ code: "PAY_RUN_INVALID_STATE" }));
    expect(() => requireRecentPayrollAuthentication({ userId: 1, email: "x", platformRole: "user", tokenVersion: 1, authenticatedAt: new Date("2026-09-01T09:00:00Z") }, new Date("2026-09-01T09:16:00Z"))).toThrowError(expect.objectContaining({ code: "RECENT_AUTHENTICATION_REQUIRED" }));
    expect(() => requireIndependentApprover(1, { createdBy: 1, calculatedBy: 2 })).toThrowError(expect.objectContaining({ code: "PAY_RUN_SEGREGATION_VIOLATION" }));
    expect(() => requireIndependentPayer(3, { createdBy: 1, calculatedBy: 2, approvedBy: 3 })).toThrowError(expect.objectContaining({ code: "PAY_RUN_SEGREGATION_VIOLATION" }));
  });
});
