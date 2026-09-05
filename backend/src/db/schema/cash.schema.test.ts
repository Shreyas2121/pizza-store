import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { cashMovementsTable, cashSessionClosuresTable, cashSessionsTable } from "./cash.schema";

describe("cash management database schema", () => {
  it("enforces one session per store business date and exact close evidence", () => {
    const config = getTableConfig(cashSessionsTable);
    expect(config.uniqueConstraints.map((item) => item.name)).toContain("cash_sessions_store_business_date_unique");
    expect(config.checks.map((item) => item.name)).toEqual(expect.arrayContaining([
      "cash_sessions_amounts_valid", "cash_sessions_close_evidence",
    ]));
  });

  it("keeps source and reversal identities unique", () => {
    const movements = getTableConfig(cashMovementsTable);
    expect(movements.uniqueConstraints.map((item) => item.name)).toEqual(expect.arrayContaining([
      "cash_movements_order_unique", "cash_movements_refund_unique", "cash_movements_reversal_unique",
    ]));
    expect(movements.checks.map((item) => item.name)).toContain("cash_movements_manual_reason");
    expect(getTableConfig(cashSessionClosuresTable).uniqueConstraints.map((item) => item.name))
      .toContain("cash_session_closures_session_version_unique");
  });
});
