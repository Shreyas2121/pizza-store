import { describe, expect, it } from "vitest";
import { SYSTEM_LEDGER_ACCOUNTS } from "./ledger.accounts";
import { assertPeriodAllowsPosting, hashPostingCommand, validatePostingCommand } from "./ledger.policy";
import { credit, debit, type PostingCommand } from "./ledger.types";

const command = (overrides: Partial<PostingCommand> = {}): PostingCommand => ({
  kind: "source",
  storeId: 1,
  currency: "INR",
  businessDate: "2026-09-06",
  occurredAt: new Date("2026-09-06T08:00:00.000Z"),
  description: "Captured order",
  source: { sourceType: "payment_attempt", sourceId: 12, eventType: "payment.captured", sourceVersion: 1 },
  lines: [debit("1100", 52_500), credit("2000", 52_500)],
  ...overrides,
});

describe("ledger posting policy", () => {
  it("defines the complete accepted system chart with valid type-side semantics", () => {
    expect(SYSTEM_LEDGER_ACCOUNTS).toHaveLength(21);
    expect(new Set(SYSTEM_LEDGER_ACCOUNTS.map((account) => account.code)).size).toBe(21);
    for (const account of SYSTEM_LEDGER_ACCOUNTS) {
      expect(["asset", "expense", "contra_revenue"].includes(account.type) ? "debit" : "credit")
        .toBe(account.normalSide);
    }
  });

  it("accepts an exact integer-paise balanced journal", () => {
    expect(validatePostingCommand(command())).toEqual({ debitsPaise: 52_500, creditsPaise: 52_500 });
  });

  it.each([
    [[], "JOURNAL_EMPTY"],
    [[debit("1100", 100), credit("2000", 99)], "JOURNAL_UNBALANCED"],
    [[{ accountCode: "1100", side: "both", amountPaise: 100 }, credit("2000", 100)], "JOURNAL_SIDE_INVALID"],
    [[debit("1100", 0), credit("2000", 0)], "JOURNAL_AMOUNT_INVALID"],
  ])("rejects invalid lines %#", (lines, code) => {
    expect(() => validatePostingCommand(command({ lines: lines as never }))).toThrowError(expect.objectContaining({ code }));
  });

  it("uses a canonical stable command hash", () => {
    expect(hashPostingCommand(command())).toBe(hashPostingCommand(command()));
  });

  it("requires an actor for manual journals", () => {
    expect(() => validatePostingCommand(command({ kind: "manual" })))
      .toThrowError(expect.objectContaining({ code: "JOURNAL_ACTOR_REQUIRED" }));
    expect(() => validatePostingCommand(command({ kind: "manual", postedBy: 7 }))).not.toThrow();
  });

  it("enforces open, soft-closed, and closed period behavior", () => {
    expect(() => assertPeriodAllowsPosting({ status: "open" }, "manual")).not.toThrow();
    expect(() => assertPeriodAllowsPosting({ status: "soft_closed" }, "source")).not.toThrow();
    expect(() => assertPeriodAllowsPosting({ status: "soft_closed" }, "manual"))
      .toThrowError(expect.objectContaining({ code: "PERIOD_CLOSED" }));
    expect(() => assertPeriodAllowsPosting({ status: "closed" }, "source"))
      .toThrowError(expect.objectContaining({ code: "PERIOD_CLOSED" }));
    expect(() => assertPeriodAllowsPosting(undefined, "source"))
      .toThrowError(expect.objectContaining({ code: "FISCAL_PERIOD_NOT_FOUND" }));
  });
});
