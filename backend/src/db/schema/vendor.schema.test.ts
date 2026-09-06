import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { expenseCategoriesTable, vendorsTable } from "./vendor.schema";

describe("vendor and expense category schema", () => {
  it("enforces normalized uniqueness independently for platform and store vendors", () => {
    const indexes = getTableConfig(vendorsTable).indexes.map((item) => item.config.name);
    expect(indexes).toEqual(expect.arrayContaining([
      "vendors_store_normalized_name_unique", "vendors_platform_normalized_name_unique",
    ]));
  });

  it("supports scoped hierarchy and enforces the Phase 4 ledger mapping FK", () => {
    const config = getTableConfig(expenseCategoriesTable);
    expect(config.foreignKeys.map((item) => item.getName())).toContain("expense_categories_parent_fk");
    expect(config.checks.map((item) => item.name)).toEqual(expect.arrayContaining([
      "expense_categories_parent_not_self", "expense_categories_ledger_account_positive",
    ]));
    expect(expenseCategoriesTable.ledgerAccountId).toBeDefined();
    expect(config.foreignKeys.some((item) => item.reference().columns.includes(expenseCategoriesTable.ledgerAccountId))).toBe(true);
  });
});
