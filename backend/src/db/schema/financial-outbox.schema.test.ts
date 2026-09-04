import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { financialOutboxTable } from "./financial-outbox.schema";

describe("financial outbox database schema", () => {
  it("enforces one event per source mutation version", () => {
    const config = getTableConfig(financialOutboxTable);
    expect(config.uniqueConstraints.map((item) => item.name)).toContain(
      "financial_outbox_source_event_version_unique"
    );
    expect(config.checks.map((item) => item.name)).toEqual(expect.arrayContaining([
      "financial_outbox_versions_positive",
      "financial_outbox_claim_evidence",
      "financial_outbox_processed_evidence",
      "financial_outbox_payload_hash_valid",
    ]));
  });
});
