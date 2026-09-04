import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import {
  RECONCILIATION_ISSUE_TYPES,
  SETTLEMENT_BATCH_STATUSES,
  SETTLEMENT_LINE_TYPES,
  SETTLEMENT_MATCH_STATUSES,
} from "../../utils/types";
import {
  reconciliationIssuesTable,
  settlementBatchesTable,
  settlementLinesTable,
} from "./settlement.schema";

const checkNames = (table: Parameters<typeof getTableConfig>[0]) =>
  getTableConfig(table).checks.map((check) => check.name);

describe("settlement database schema", () => {
  it("publishes the documented settlement and issue states", () => {
    expect(SETTLEMENT_BATCH_STATUSES).toEqual([
      "imported", "reconciling", "needs_review", "reconciled",
    ]);
    expect(SETTLEMENT_LINE_TYPES).toEqual(["payment", "refund", "adjustment"]);
    expect(SETTLEMENT_MATCH_STATUSES).toEqual(["unmatched", "matched", "mismatch", "ignored"]);
    expect(RECONCILIATION_ISSUE_TYPES).toContain("missing_local");
    expect(RECONCILIATION_ISSUE_TYPES).toContain("amount_mismatch");
  });

  it("enforces exact batch arithmetic and immutable provider evidence", () => {
    const config = getTableConfig(settlementBatchesTable);
    expect(settlementBatchesTable.providerSettlementId.notNull).toBe(true);
    expect(settlementBatchesTable.payloadHash.notNull).toBe(true);
    expect(checkNames(settlementBatchesTable)).toEqual(expect.arrayContaining([
      "settlement_batches_amounts_valid",
      "settlement_batches_currency_inr",
      "settlement_batches_payload_hash_valid",
      "settlement_batches_reconciled_evidence",
    ]));
    expect(config.uniqueConstraints.map((constraint) => constraint.name))
      .toContain("settlement_batches_id_store_unique");
  });

  it("keeps lines and issues within their batch store scope", () => {
    const lineForeignKeys = getTableConfig(settlementLinesTable).foreignKeys
      .map((foreignKey) => foreignKey.getName());
    const issueForeignKeys = getTableConfig(reconciliationIssuesTable).foreignKeys
      .map((foreignKey) => foreignKey.getName());
    expect(lineForeignKeys).toContain("settlement_lines_batch_store_fk");
    expect(checkNames(settlementLinesTable)).toContain(
      "settlement_lines_matched_target_present"
    );
    expect(issueForeignKeys).toEqual(expect.arrayContaining([
      "reconciliation_issues_batch_store_fk",
      "reconciliation_issues_line_store_fk",
    ]));
    expect(checkNames(reconciliationIssuesTable)).toContain(
      "reconciliation_issues_resolution_valid"
    );
  });
});
