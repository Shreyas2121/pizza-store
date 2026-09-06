import { describe, expect, it, vi } from "vitest";
import { hashPostingCommand } from "./ledger.policy";
import { LedgerService } from "./ledger.service";
import { credit, debit, type PostingCommand } from "./ledger.types";

const command: PostingCommand = {
  kind: "source",
  storeId: 1,
  currency: "INR",
  businessDate: "2026-09-06",
  occurredAt: new Date("2026-09-06T08:00:00.000Z"),
  description: "Captured order",
  source: { sourceType: "payment_attempt", sourceId: 12, eventType: "payment.captured", sourceVersion: 1 },
  lines: [debit("1100", 52_500), credit("2000", 52_500)],
};

const account = (id: number, code: string) => ({
  id, code, name: code, type: "asset", normalSide: "debit", parentId: null, currency: "INR",
  isSystem: true, isActive: true, createdAt: new Date(), updatedAt: new Date(),
});

const repository = (overrides: Record<string, unknown> = {}) => ({
  transaction: (work: (tx: never) => Promise<unknown>) => work({} as never),
  findBySource: vi.fn().mockResolvedValue(undefined),
  findPeriodForUpdate: vi.fn().mockResolvedValue([{ status: "open" }]),
  findAccounts: vi.fn().mockResolvedValue([account(1, "1100"), account(2, "2000")]),
  createPosted: vi.fn().mockResolvedValue({ id: 8, status: "posted" }),
  findEntryForUpdate: vi.fn(),
  markReversed: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe("ledger service", () => {
  it("posts a balanced journal once through one transaction", async () => {
    const repo = repository();
    const service = new LedgerService(repo as never);
    await expect(service.post(command)).resolves.toMatchObject({ id: 8, status: "posted" });
    expect(repo.createPosted).toHaveBeenCalledOnce();
  });

  it("returns an identical source retry and rejects conflicting content", async () => {
    const existing = { id: 8, commandHash: hashPostingCommand(command), lines: [] };
    const repo = repository({ findBySource: vi.fn().mockResolvedValue(existing) });
    const service = new LedgerService(repo as never);
    await expect(service.post(command)).resolves.toBe(existing);
    await expect(service.post({ ...command, description: "Changed meaning" }))
      .rejects.toMatchObject({ code: "JOURNAL_SOURCE_CONFLICT" });
    expect(repo.createPosted).not.toHaveBeenCalled();
  });

  it("rejects missing, inactive, and closed-period dependencies without a partial insert", async () => {
    const missing = repository({ findAccounts: vi.fn().mockResolvedValue([account(1, "1100")]) });
    await expect(new LedgerService(missing as never).post(command))
      .rejects.toMatchObject({ code: "LEDGER_ACCOUNT_UNAVAILABLE" });
    expect(missing.createPosted).not.toHaveBeenCalled();

    const closed = repository({ findPeriodForUpdate: vi.fn().mockResolvedValue([{ status: "closed" }]) });
    await expect(new LedgerService(closed as never).post(command)).rejects.toMatchObject({ code: "PERIOD_CLOSED" });
    expect(closed.createPosted).not.toHaveBeenCalled();
  });

  it("builds an exact opposite journal and links the reversal", async () => {
    const original = {
      id: 8,
      storeId: 1,
      status: "posted",
      journalNumber: "JRN-1-original",
      businessDate: "2026-08-31",
      reversalOfJournalEntryId: null,
      lines: [
        { debitPaise: 52_500, creditPaise: 0, description: null, orderId: 4, paymentAttemptId: null, refundId: null, expenseId: null, payRunId: null, dimensions: {}, account: account(1, "1100") },
        { debitPaise: 0, creditPaise: 52_500, description: null, orderId: 4, paymentAttemptId: null, refundId: null, expenseId: null, payRunId: null, dimensions: {}, account: account(2, "2000") },
      ],
    };
    const createPosted = vi.fn().mockImplementation(async (_tx, reversal) => ({ id: 9, lines: reversal.lines }));
    const repo = repository({ findEntryForUpdate: vi.fn().mockResolvedValue(original), createPosted });
    const service = new LedgerService(repo as never);
    const result = await service.reverse({
      journalEntryId: 8,
      storeId: 1,
      businessDate: "2026-09-06",
      occurredAt: new Date("2026-09-06T09:00:00.000Z"),
      reason: "Correct duplicate capture",
      actorId: 3,
      correlationId: "correction-8",
    });
    expect(result.lines).toEqual([
      expect.objectContaining({ accountCode: "1100", side: "credit", amountPaise: 52_500 }),
      expect.objectContaining({ accountCode: "2000", side: "debit", amountPaise: 52_500 }),
    ]);
    expect(createPosted).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.any(String), expect.any(Map), 8, "Correct duplicate capture");
    expect(repo.markReversed).toHaveBeenCalledWith(expect.anything(), 8, new Date("2026-09-06T09:00:00.000Z"));

    const net = new Map<string, number>();
    for (const line of [...original.lines.map((line) => ({ accountCode: line.account.code, side: line.debitPaise ? "debit" : "credit", amountPaise: line.debitPaise || line.creditPaise })), ...result.lines]) {
      net.set(line.accountCode, (net.get(line.accountCode) ?? 0) + (line.side === "debit" ? line.amountPaise : -line.amountPaise));
    }
    expect([...net.values()]).toEqual([0, 0]);
  });
});
