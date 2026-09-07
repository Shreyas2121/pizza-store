import { describe, expect, it } from "vitest";
import { createCompensationVersionSchema, createPayrollProfileSchema, updatePayrollProfileSchema } from "./payroll.schemas";

describe("payroll schemas", () => {
  it("normalizes identifiers and enforces employment lifecycle dates", () => {
    expect(createPayrollProfileSchema.parse({
      storeId: 1, employeeCode: "emp-01", displayName: "Demo Employee",
      employmentStartDate: "2026-01-01", bankAccountNumber: "ab12345678",
    })).toMatchObject({ employeeCode: "EMP-01", bankAccountNumber: "AB12345678", status: "active", payFrequency: "monthly" });
    expect(createPayrollProfileSchema.safeParse({
      storeId: 1, employeeCode: "EMP-01", displayName: "Demo Employee",
      employmentStartDate: "2026-01-01", status: "terminated",
    }).success).toBe(false);
    expect(updatePayrollProfileSchema.safeParse({}).success).toBe(false);
  });

  it("accepts only bounded, unique demo compensation components", () => {
    const base = {
      effectiveFrom: "2026-01-01",
      components: [{ type: "earning" as const, code: "base", name: "Base", amountPaise: 100_000 }],
    };
    expect(createCompensationVersionSchema.parse(base).components[0].code).toBe("BASE");
    expect(createCompensationVersionSchema.safeParse({ ...base, components: [
      ...base.components, { ...base.components[0] },
    ] }).success).toBe(false);
    expect(createCompensationVersionSchema.safeParse({ ...base, effectiveTo: "2025-12-31" }).success).toBe(false);
  });
});
