import { describe, expect, it } from "vitest";
import { expenseWriteSchema } from "./expense.schemas";
import { hashExpensePayload, requireExpenseStatus } from "./expense.policy";

const valid = { storeId: 1, expenseDate: "2026-09-06", description: "Monthly internet", subtotalPaise: 10_000, taxPaise: 1_800, totalPaise: 11_800, allocations: [{ storeId: 1, categoryId: 2, amountPaise: 11_800 }] };

describe("expense policy", () => {
  it("requires exact subtotal, tax, and allocation paise totals", () => {
    expect(expenseWriteSchema.safeParse(valid).success).toBe(true);
    expect(expenseWriteSchema.safeParse({ ...valid, totalPaise: 11_801 }).success).toBe(false);
    expect(expenseWriteSchema.safeParse({ ...valid, allocations: [{ ...valid.allocations[0], amountPaise: 11_799 }] }).success).toBe(false);
  });
  it("hashes object keys canonically", () => {
    expect(hashExpensePayload({ a: 1, b: { x: 2, y: 3 } })).toBe(hashExpensePayload({ b: { y: 3, x: 2 }, a: 1 }));
  });
  it("rejects an invalid lifecycle transition", () => {
    expect(() => requireExpenseStatus("posted", ["paid"])).toThrowError(expect.objectContaining({ code: "INVALID_STATE_TRANSITION" }));
  });
});
