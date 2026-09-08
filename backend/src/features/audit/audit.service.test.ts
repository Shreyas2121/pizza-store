import { describe, expect, it, vi } from "vitest";
import type { TransactionType } from "../../utils/types";
import { db } from "../../db";
import { withRequestContext } from "../../utils/request-context";
import { AuditService } from "./audit.service";

describe("AuditService", () => {
  it("inserts only allow-listed staff before/after fields", async () => {
    const values = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn().mockReturnValue({ values });
    const tx = { insert } as unknown as TransactionType;
    const service = new AuditService();

    await withRequestContext("123e4567-e89b-42d3-a456-426614174001", () => service.write({
      tx,
      actor: { userId: 1, email: "admin@example.com", platformRole: "admin", tokenVersion: 9 },
      storeId: 3,
      action: "staff.membership.updated",
      resourceType: "store_membership",
      resourceId: 12,
      before: { role: "operator", status: "active", bankAccountNumber: "1234567890" },
      after: { role: "inventory_staff", status: "suspended", taxIdentifierEncrypted: "encrypted-value" },
      metadata: { nested: { gross_pay_paise: 900000, safeCount: 2 }, paymentReference: "UTR-PRIVATE", bankDetails: "PRIVATE", pan: "ABCDE1234F", signature: "signed", rawProviderPayload: { private: true } },
    }));

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 1,
        requestId: "123e4567-e89b-42d3-a456-426614174001",
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
    expect(serialized).not.toContain("ABCDE1234F");
    expect(serialized).not.toContain("signed");
    expect(serialized).not.toContain("rawProviderPayload");
    expect(serialized).toContain("safeCount");
  });

  it("persists a safe standalone denied attempt with request correlation", async () => {
    const values = vi.fn().mockResolvedValue(undefined);
    const insert = vi.spyOn(db, "insert").mockReturnValue({ values } as never);
    const service = new AuditService();

    await withRequestContext("123e4567-e89b-42d3-a456-426614174002", () => service.writeAttempt({
      actor: { userId: 7, email: "private@example.com", platformRole: "user", tokenVersion: 4 },
      storeId: null,
      operation: "expense.approve",
      resourceType: "expense",
      resourceId: 99,
      outcome: "denied",
      reasonCode: "RESOURCE_NOT_FOUND",
    }));

    expect(values).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: 7,
      actorEmailSnapshot: null,
      action: "expense.approve.denied",
      outcome: "denied",
      requestId: "123e4567-e89b-42d3-a456-426614174002",
      resourceId: "99",
      metadata: { reasonCode: "RESOURCE_NOT_FOUND" },
    }));
    expect(JSON.stringify(values.mock.calls[0][0])).not.toContain("private@example.com");
    insert.mockRestore();
  });
});
