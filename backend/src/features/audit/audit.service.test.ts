import { describe, expect, it, vi } from "vitest";
import type { TransactionType } from "../../utils/types";
import { AuditService } from "./audit.service";

describe("AuditService", () => {
  it("inserts only allow-listed staff before/after fields", async () => {
    const values = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn().mockReturnValue({ values });
    const tx = { insert } as unknown as TransactionType;
    const service = new AuditService();

    await service.write({
      tx,
      actor: { userId: 1, email: "admin@example.com", platformRole: "admin", tokenVersion: 9 },
      storeId: 3,
      action: "staff.membership.updated",
      resourceType: "store_membership",
      resourceId: 12,
      before: { role: "operator", status: "active", bankAccountNumber: "1234567890" },
      after: { role: "inventory_staff", status: "suspended", taxIdentifierEncrypted: "encrypted-value" },
      metadata: { nested: { gross_pay_paise: 900000, safeCount: 2 }, paymentReference: "UTR-PRIVATE" },
    });

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 1,
        metadata: {
          before: { role: "operator", status: "active" },
          after: { role: "inventory_staff", status: "suspended" },
          nested: { safeCount: 2 },
        },
      })
    );
    const serialized = JSON.stringify(values.mock.calls[0][0]);
    expect(serialized).not.toContain("tokenVersion");
    expect(serialized).not.toContain("password");
    expect(serialized).not.toContain("tokenHash");
    expect(serialized).not.toContain("1234567890");
    expect(serialized).not.toContain("encrypted-value");
    expect(serialized).not.toContain("900000");
    expect(serialized).not.toContain("UTR-PRIVATE");
    expect(serialized).toContain("safeCount");
  });
});
