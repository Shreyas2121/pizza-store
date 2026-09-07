import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { compensationComponentsTable, compensationVersionsTable, employeeFinanceProfilesTable, payRunCommandsTable, payRunEmployeesTable, payRunLinesTable, payRunsTable } from "./payroll.schema";

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

  it("enforces complete immutable pay-run snapshots and command idempotency", () => {
    const runs = getTableConfig(payRunsTable);
    expect(runs.checks.map((item) => item.name)).toEqual(expect.arrayContaining([
      "pay_runs_monthly_period",
      "pay_runs_totals_complete",
      "pay_runs_payment_evidence",
      "pay_runs_reversal_evidence",
    ]));
    expect(getTableConfig(payRunEmployeesTable).checks.map((item) => item.name)).toContain("pay_run_employees_totals_valid");
    expect(getTableConfig(payRunLinesTable).uniqueConstraints.map((item) => item.name)).toContain("pay_run_lines_employee_type_code_unique");
    expect(getTableConfig(payRunCommandsTable).uniqueConstraints.map((item) => item.name)).toContain("pay_run_commands_idempotency_unique");
  });
});
