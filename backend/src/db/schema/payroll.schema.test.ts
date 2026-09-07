import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { compensationComponentsTable, compensationVersionsTable, employeeFinanceProfilesTable } from "./payroll.schema";

describe("payroll database schema", () => {
  it("keeps employment separate from access and sensitive values paired with masks", () => {
    const config = getTableConfig(employeeFinanceProfilesTable);
    expect(config.uniqueConstraints.map((item) => item.name)).toEqual(expect.arrayContaining([
      "employee_finance_profiles_store_code_unique",
      "employee_finance_profiles_id_store_unique",
    ]));
    expect(config.checks.map((item) => item.name)).toEqual(expect.arrayContaining([
      "employee_finance_profiles_dates_valid",
      "employee_finance_profiles_terminated_date",
      "employee_finance_profiles_bank_pair",
      "employee_finance_profiles_tax_pair",
    ]));
  });

  it("restricts effective versions and component amounts to the demo contract", () => {
    expect(getTableConfig(compensationVersionsTable).checks.map((item) => item.name)).toEqual(expect.arrayContaining([
      "compensation_versions_range_valid",
      "compensation_versions_currency_inr",
      "compensation_versions_demo_only",
    ]));
    expect(getTableConfig(compensationComponentsTable).checks.map((item) => item.name)).toEqual(expect.arrayContaining([
      "compensation_components_type_valid",
      "compensation_components_amount_positive",
    ]));
  });
});
