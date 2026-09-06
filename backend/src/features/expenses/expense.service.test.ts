import { beforeEach, describe, expect, it, vi } from "vitest";
import authorizationService from "../access/access.service";
import auditService from "../audit/audit.service";
import { ExpenseService } from "./expense.service";

const admin = { userId: 9, email: "owner@example.com", platformRole: "admin" as const, tokenVersion: 1 };
const base = { id: 4, storeId: 1, vendorId: null, vendorName: null, expenseDate: "2026-09-06", description: "Internet", subtotalPaise: 10_000, taxPaise: 0, totalPaise: 10_000, currency: "INR", status: "submitted", paymentMethod: null, paymentReference: null, clientRequestId: crypto.randomUUID(), payloadHash: "a".repeat(64), version: 2, createdBy: 8, updatedBy: 8, submittedBy: 8, submittedAt: new Date(), approvedBy: null, approvedAt: null, rejectedBy: null, rejectedAt: null, rejectionReason: null, paidBy: null, paidAt: null, postedBy: null, postedAt: null, voidedBy: null, voidedAt: null, voidReason: null, reversedBy: null, reversedAt: null, reversalReason: null, createdAt: new Date(), updatedAt: new Date() } as const;
const allocation = { id: 1, expenseId: 4, expenseStoreId: 1, storeId: 1, categoryId: 2, categoryName: "Utilities", categoryClassification: "variable", ledgerAccountId: 33, costCenter: null, amountPaise: 10_000, createdAt: new Date() } as const;

const concurrentRepository = (initial: Record<string, unknown>) => {
  let expense = { ...initial } as typeof base;
  const commands = new Map<string, Record<string, unknown>>();
  let tail = Promise.resolve();
  const repository = {
    findExpense: vi.fn(async () => ({ ...expense })),
    lockExpense: vi.fn(async () => ({ ...expense })),
    command: vi.fn(async (key: string) => commands.get(key)),
    transaction: vi.fn(async (work: (tx: object) => Promise<unknown>) => { let release!: () => void; const prior = tail; tail = new Promise<void>((resolve) => { release = resolve; }); await prior; try { return await work({}); } finally { release(); } }),
    update: vi.fn(async (_tx: object, _id: number, values: Record<string, unknown>) => { expense = { ...expense, ...values } as typeof base; return { ...expense }; }),
    recordCommand: vi.fn(async (_tx: object, values: Record<string, unknown>) => { commands.set(values.idempotencyKey as string, { id: commands.size + 1, ...values, createdAt: new Date() }); }),
    allocations: vi.fn(async () => [allocation]),
    detail: vi.fn(async () => ({ expense: { ...expense }, allocations: [allocation] })),
    findStore: vi.fn(async () => ({ id: 1, timezone: "Asia/Kolkata" })),
  };
  return repository;
};

describe("expense workflow concurrency and policy", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(authorizationService, "requireResourceStorePermission").mockResolvedValue({ access: "platform", userId: 9, storeId: 1, permission: "finance.expenses.approve" });
    vi.spyOn(auditService, "write").mockResolvedValue();
  });

  it("serializes approve versus void so exactly one transition wins", async () => {
    const repository = concurrentRepository(base);
    const service = new ExpenseService(repository as never, { write: vi.fn() });
    const results = await Promise.allSettled([
      service.approve(admin, 4, crypto.randomUUID()),
      service.void(admin, 4, crypto.randomUUID(), { reason: "Duplicate invoice" }),
    ]);
    expect(results.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((item) => item.status === "rejected")).toHaveLength(1);
    expect(repository.update).toHaveBeenCalledTimes(1);
  });

  it("deduplicates concurrent payment commands by idempotency key", async () => {
    const approved = { ...base, status: "approved", approvedBy: 7, approvedAt: new Date(), version: 3 };
    const repository = concurrentRepository(approved);
    vi.spyOn(authorizationService, "requireResourceStorePermission").mockResolvedValue({ access: "platform", userId: 9, storeId: 1, permission: "finance.expenses.pay" });
    const events = { write: vi.fn().mockResolvedValue({}) };
    const service = new ExpenseService(repository as never, events);
    const key = crypto.randomUUID();
    const results = await Promise.all([
      service.pay(admin, 4, key, { paymentMethod: "bank_transfer", paymentReference: "UTR-1" }),
      service.pay(admin, 4, key, { paymentMethod: "bank_transfer", paymentReference: "UTR-1" }),
    ]);
    expect(results[0].expense.status).toBe("paid");
    expect(results[1].expense.status).toBe("paid");
    expect(repository.update).toHaveBeenCalledTimes(1);
    expect(events.write).toHaveBeenCalledTimes(1);
  });

  it("requires explicit audited override when an admin pays an expense they approved", async () => {
    const approved = { ...base, status: "approved", approvedBy: 9, approvedAt: new Date(), version: 3 };
    const repository = concurrentRepository(approved);
    const service = new ExpenseService(repository as never, { write: vi.fn() });
    await expect(service.pay(admin, 4, crypto.randomUUID(), { paymentMethod: "cash" })).rejects.toMatchObject({ code: "SEGREGATION_OF_DUTIES_VIOLATION" });
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("prevents self-approval and applies the manager approval ceiling", async () => {
    const selfRepository = concurrentRepository({ ...base, createdBy: 9 });
    await expect(new ExpenseService(selfRepository as never, { write: vi.fn() }).approve(admin, 4, crypto.randomUUID()))
      .rejects.toMatchObject({ code: "SEGREGATION_OF_DUTIES_VIOLATION" });

    vi.spyOn(authorizationService, "requireResourceStorePermission").mockResolvedValue({ access: "membership", userId: 9, storeId: 1, membershipId: 12, membershipRole: "manager", permission: "finance.expenses.approve" });
    const largeRepository = concurrentRepository({ ...base, totalPaise: 500_001 });
    await expect(new ExpenseService(largeRepository as never, { write: vi.fn() }).approve(admin, 4, crypto.randomUUID()))
      .rejects.toMatchObject({ code: "EXPENSE_APPROVAL_LIMIT_EXCEEDED" });
    expect(largeRepository.update).not.toHaveBeenCalled();
  });
});
