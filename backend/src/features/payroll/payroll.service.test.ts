import { beforeEach, describe, expect, it, vi } from "vitest";
import authorizationService from "../access/access.service";
import auditService from "../audit/audit.service";
import { PayrollService } from "./payroll.service";

const actor = { userId: 9, email: "payroll@example.com", platformRole: "user" as const, tokenVersion: 1 };
const profile = {
  id: 7, storeId: 1, userId: 22, employeeCode: "EMP-01", displayName: "Demo Employee",
  employmentStartDate: "2026-01-01", employmentEndDate: null, status: "active" as const,
  payFrequency: "monthly" as const, bankAccountEncrypted: "ciphertext-bank", bankAccountLast4: "7890",
  taxIdentifierEncrypted: "ciphertext-tax", taxIdentifierLast4: "F123",
  createdBy: 9, updatedBy: 9, createdAt: new Date("2026-01-01T00:00:00Z"), updatedAt: new Date("2026-01-01T00:00:00Z"),
};

describe("payroll service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(authorizationService, "requireStorePermission").mockResolvedValue({
      access: "membership", userId: 9, storeId: 1, permission: "payroll.manage", membershipId: 2, membershipRole: "payroll_manager",
    });
    vi.spyOn(authorizationService, "requireResourceStorePermission").mockResolvedValue({
      access: "membership", userId: 9, storeId: 1, permission: "payroll.manage", membershipId: 2, membershipRole: "payroll_manager",
    });
    vi.spyOn(auditService, "write").mockResolvedValue();
  });

  it("encrypts sensitive profile fields and returns masks without ciphertext", async () => {
    const createProfile = vi.fn().mockResolvedValue(profile);
    const repository = {
      findStore: vi.fn().mockResolvedValue({ id: 1 }),
      findUser: vi.fn().mockResolvedValue({ id: 22 }),
      transaction: (work: (tx: never) => Promise<unknown>) => work({} as never),
      createProfile,
    };
    const sensitiveData = { protect: vi.fn((value: string) => ({ encrypted: `protected:${value}`, last4: value.slice(-4) })) };
    const service = new PayrollService(repository as never, sensitiveData);
    const result = await service.createProfile(actor, {
      storeId: 1, userId: 22, employeeCode: "EMP-01", displayName: "Demo Employee",
      employmentStartDate: "2026-01-01", status: "active", payFrequency: "monthly",
      bankAccountNumber: "AB1234567890", taxIdentifier: "ABCDE123F123",
    });

    expect(createProfile).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
      bankAccountEncrypted: "protected:AB1234567890", bankAccountLast4: "7890",
      taxIdentifierEncrypted: "protected:ABCDE123F123", taxIdentifierLast4: "F123",
    }, 9);
    expect(result.data).toMatchObject({ bankAccountMasked: "••••7890", taxIdentifierMasked: "••••F123" });
    expect(JSON.stringify(result)).not.toContain("ciphertext");
    expect(JSON.stringify(auditService.write.mock.calls)).not.toContain("AB1234567890");
    expect(JSON.stringify(auditService.write.mock.calls)).not.toContain("amountPaise");
  });

  it("rejects overlapping effective compensation before writing", async () => {
    const repository = {
      findProfileIdentity: vi.fn().mockResolvedValue({ id: 7, storeId: 1 }),
      transaction: (work: (tx: never) => Promise<unknown>) => work({} as never),
      lockProfile: vi.fn().mockResolvedValue(profile),
      findCompensationOverlap: vi.fn().mockResolvedValue({ id: 4 }),
    };
    const service = new PayrollService(repository as never, { protect: vi.fn() });
    await expect(service.createCompensation(actor, 7, {
      effectiveFrom: "2026-07-01", effectiveTo: null, sourceNote: "Demo review",
      components: [{ type: "earning", code: "BASE", name: "Base", amountPaise: 100_000 }],
    })).rejects.toMatchObject({ code: "COMPENSATION_VERSION_OVERLAP" });
  });

  it("returns exact recurring totals while keeping compensation out of audit metadata", async () => {
    const created = {
      version: { id: 4, profileId: 7, storeId: 1, effectiveFrom: "2026-07-01", effectiveTo: null, currency: "INR" as const, sourceNote: "Demo review", demoOnly: true, createdBy: 9, createdAt: new Date() },
      components: [
        { id: 1, compensationVersionId: 4, type: "earning" as const, code: "BASE", name: "Base", amountPaise: 100_000, createdAt: new Date() },
        { id: 2, compensationVersionId: 4, type: "earning" as const, code: "ALLOWANCE", name: "Allowance", amountPaise: 20_000, createdAt: new Date() },
        { id: 3, compensationVersionId: 4, type: "deduction" as const, code: "DEMO_DEDUCTION", name: "Demo deduction", amountPaise: 5_000, createdAt: new Date() },
        { id: 4, compensationVersionId: 4, type: "employer_cost" as const, code: "DEMO_EMPLOYER", name: "Demo employer cost", amountPaise: 10_000, createdAt: new Date() },
      ],
    };
    const repository = {
      findProfileIdentity: vi.fn().mockResolvedValue({ id: 7, storeId: 1 }),
      transaction: (work: (tx: never) => Promise<unknown>) => work({} as never),
      lockProfile: vi.fn().mockResolvedValue(profile),
      findCompensationOverlap: vi.fn().mockResolvedValue(undefined),
      createCompensationVersion: vi.fn().mockResolvedValue(created),
    };
    const service = new PayrollService(repository as never, { protect: vi.fn() });
    const result = await service.createCompensation(actor, 7, {
      effectiveFrom: "2026-07-01", sourceNote: "Demo review",
      components: created.components.map(({ type, code, name, amountPaise }) => ({ type, code, name, amountPaise })),
    });

    expect(result.data.totals).toEqual({
      grossPayPaise: 120_000, deductionPaise: 5_000, netPayPaise: 115_000,
      employerCostPaise: 10_000, totalEmployerCostPaise: 130_000,
    });
    const auditPayload = auditService.write.mock.calls.at(-1)?.[0];
    expect(auditPayload?.after).toEqual({
      profileId: 7, effectiveFrom: "2026-07-01", effectiveTo: null, currency: "INR", demoOnly: true,
    });
  });
});
