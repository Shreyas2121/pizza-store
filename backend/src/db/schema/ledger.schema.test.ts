import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { fiscalPeriodsTable, journalEntriesTable, journalLinesTable, ledgerAccountsTable } from "./ledger.schema";

describe("ledger database schema", () => {
  it("keeps account codes and posting source identities unique", () => {
    const accounts = getTableConfig(ledgerAccountsTable);
    const journals = getTableConfig(journalEntriesTable);
    expect(accounts.uniqueConstraints.map((item) => item.name)).toContain("ledger_accounts_code_unique");
    expect(journals.uniqueConstraints.map((item) => item.name)).toEqual(expect.arrayContaining([
      "journal_entries_source_identity_unique",
      "journal_entries_reversal_unique",
      "journal_entries_store_number_unique",
    ]));
  });

  it("has the partial date-leading index used by consolidated finance reports", () => {
    const indexes = getTableConfig(journalEntriesTable).indexes;
    expect(indexes.map((item) => item.config.name)).toContain("journal_entries_finance_report_idx");
    const reportIndex = indexes.find((item) => item.config.name === "journal_entries_finance_report_idx");
    expect(reportIndex?.config.where).toBeDefined();
  });

  it("requires one positive side per line and exact period state evidence", () => {
    expect(getTableConfig(journalLinesTable).checks.map((item) => item.name)).toEqual(expect.arrayContaining([
      "journal_lines_exactly_one_side",
      "journal_lines_line_number_positive",
    ]));
    expect(getTableConfig(fiscalPeriodsTable).checks.map((item) => item.name)).toEqual(expect.arrayContaining([
      "fiscal_periods_range_valid",
      "fiscal_periods_soft_close_evidence",
      "fiscal_periods_close_evidence",
    ]));
  });
});
