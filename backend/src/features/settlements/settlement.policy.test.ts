import { describe, expect, it } from "vitest";
import { SETTLEMENT_IMPORT_FIXTURES } from "./settlement.fixtures";
import { hashSettlementPayload, validateSettlementImport } from "./settlement.policy";

describe("settlement import policy", () => {
  it("accepts both checked-in fixtures with exact paise reconciliation", () => {
    for (const fixture of SETTLEMENT_IMPORT_FIXTURES) {
      expect(validateSettlementImport(structuredClone(fixture))).toEqual(fixture);
      expect(fixture.netAmountPaise).toBe(
        fixture.grossAmountPaise - fixture.feePaise - fixture.feeTaxPaise
          + fixture.adjustmentPaise
      );
    }
  });

  it("produces stable SHA-256 evidence for an idempotent import", () => {
    const fixture = SETTLEMENT_IMPORT_FIXTURES[0];
    expect(hashSettlementPayload(fixture)).toBe(hashSettlementPayload(fixture));
    expect(hashSettlementPayload(fixture)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rejects a batch whose lines do not reconcile", () => {
    const invalid = structuredClone(SETTLEMENT_IMPORT_FIXTURES[0]);
    invalid.lines[0].feePaise += 1;
    expect(() => validateSettlementImport(invalid)).toThrowError(
      expect.objectContaining({ code: "INVALID_SETTLEMENT_IMPORT", status: 422 })
    );
  });

  it("rejects duplicate immutable provider line IDs", () => {
    const invalid = structuredClone(SETTLEMENT_IMPORT_FIXTURES[0]);
    invalid.lines[1].providerLineId = invalid.lines[0].providerLineId;
    expect(() => validateSettlementImport(invalid)).toThrowError(
      expect.objectContaining({ code: "INVALID_SETTLEMENT_IMPORT" })
    );
  });
});
