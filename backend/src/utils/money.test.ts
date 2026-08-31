import { describe, expect, it } from "vitest";
import {
  addPaise,
  allocateProportional,
  assertNonNegativePaise,
  assertSignedPaise,
  calculateBasisPoints,
  calculateInclusiveTax,
  formatPaiseToRupeesString,
  MAX_POSTGRES_INT,
  MIN_POSTGRES_INT,
  MONEY_CAPS,
  multiplyPaiseByQuantity,
  paiseToRupees,
  parseAggregatePaise,
  parsePaise,
  parseSignedPaise,
  roundHalfAwayFromZero,
  rupeesToPaise,
  serializeAggregatePaise,
  subtractPaise,
} from "./money";

describe("Money Primitives and Bounded Paise Utilities (ADR-001)", () => {
  describe("Domain caps and boundary assertions", () => {
    it("asserts non-negative safe integers within domain cap", () => {
      expect(() => assertNonNegativePaise(0)).not.toThrow();
      expect(() => assertNonNegativePaise(50000, MONEY_CAPS.ORDER_AMOUNT)).not.toThrow();
      expect(() => assertNonNegativePaise(MAX_POSTGRES_INT)).not.toThrow();

      // Negative values
      expect(() => assertNonNegativePaise(-1)).toThrow(RangeError);

      // Floats and non-integers
      expect(() => assertNonNegativePaise(10.5)).toThrow(TypeError);
      expect(() => assertNonNegativePaise(NaN)).toThrow(TypeError);
      expect(() => assertNonNegativePaise(Infinity)).toThrow(TypeError);

      // Exceeding domain cap
      expect(() =>
        assertNonNegativePaise(500001, MONEY_CAPS.ORDER_AMOUNT)
      ).toThrow(RangeError);
    });

    it("asserts signed safe integers within domain range", () => {
      expect(() => assertSignedPaise(-500)).not.toThrow();
      expect(() => assertSignedPaise(500)).not.toThrow();
      expect(() => assertSignedPaise(0)).not.toThrow();
      expect(() => assertSignedPaise(MAX_POSTGRES_INT)).not.toThrow();

      // Floats
      expect(() => assertSignedPaise(5.25)).toThrow(TypeError);

      // Exceeding domain cap
      expect(() =>
        assertSignedPaise(100001, 100000)
      ).toThrow(RangeError);
      expect(() =>
        assertSignedPaise(-100001, 100000)
      ).toThrow(RangeError);
    });

    it("parses valid non-negative paise inputs across number, string, and bigint", () => {
      expect(parsePaise(1000)).toBe(1000);
      expect(parsePaise("45000")).toBe(45000);
      expect(parsePaise(500n)).toBe(500);

      // Invalid formats
      expect(() => parsePaise("10.5")).toThrow(TypeError);
      expect(() => parsePaise("-100")).toThrow(TypeError);
      expect(() => parsePaise("₹500")).toThrow(TypeError);
      expect(() => parsePaise(" 100 ")).toThrow(TypeError);
      expect(() => parsePaise(-50)).toThrow(RangeError);
      expect(() => parsePaise(null)).toThrow(TypeError);
    });

    it("parses signed paise inputs with optional leading minus sign", () => {
      expect(parseSignedPaise("-45000")).toBe(-45000);
      expect(parseSignedPaise("45000")).toBe(45000);
      expect(parseSignedPaise(0)).toBe(0);
      expect(parseSignedPaise(-500n)).toBe(-500);

      expect(() => parseSignedPaise("+45000")).toThrow(TypeError);
      expect(() => parseSignedPaise("450.00")).toThrow(TypeError);
    });
  });

  describe("Rounding half-away-from-zero (ADR-001 Rule 6)", () => {
    it("rounds positive halves away from zero (ceil)", () => {
      expect(roundHalfAwayFromZero(10.5)).toBe(11);
      expect(roundHalfAwayFromZero(10.49)).toBe(10);
      expect(roundHalfAwayFromZero(10.51)).toBe(11);
      expect(roundHalfAwayFromZero(0.5)).toBe(1);
      expect(roundHalfAwayFromZero(0)).toBe(0);
    });

    it("rounds negative halves away from zero (floor)", () => {
      expect(roundHalfAwayFromZero(-10.5)).toBe(-11);
      expect(roundHalfAwayFromZero(-10.49)).toBe(-10);
      expect(roundHalfAwayFromZero(-10.51)).toBe(-11);
      expect(roundHalfAwayFromZero(-0.5)).toBe(-1);
    });
  });

  describe("Checked arithmetic", () => {
    it("adds paise safely with cap enforcement", () => {
      expect(addPaise([10000, 20000, 30000])).toBe(60000);
      expect(addPaise([])).toBe(0);
      expect(addPaise([45000])).toBe(45000);

      // Overflow / cap check
      expect(() => addPaise([300000, 300000], MONEY_CAPS.ORDER_AMOUNT)).toThrow(
        RangeError
      );
    });

    it("subtracts paise with negative restriction and optional signed result", () => {
      expect(subtractPaise(50000, 10000)).toBe(40000);
      expect(subtractPaise(50000, 50000)).toBe(0);

      // Denied negative by default
      expect(() => subtractPaise(10000, 50000)).toThrow(RangeError);

      // Allowed signed subtraction
      expect(subtractPaise(10000, 50000, { allowNegative: true })).toBe(-40000);
    });

    it("multiplies unit price by integer quantity", () => {
      expect(multiplyPaiseByQuantity(45000, 3)).toBe(135000);
      expect(multiplyPaiseByQuantity(45000, 0)).toBe(0);

      expect(() => multiplyPaiseByQuantity(45000, -1)).toThrow(RangeError);
      expect(() => multiplyPaiseByQuantity(45000, 1.5)).toThrow(RangeError);
      expect(() =>
        multiplyPaiseByQuantity(300000, 2, MONEY_CAPS.ORDER_AMOUNT)
      ).toThrow(RangeError);
    });

    it("calculates percentage via basis points with exact rounding", () => {
      // 5% of 100 paise = 5 paise
      expect(calculateBasisPoints(100, 500)).toBe(5);

      // 2% fee on 95,000 paise = 1,900 paise
      expect(calculateBasisPoints(95000, 200)).toBe(1900);

      // 18% GST on 1,900 paise = 342 paise
      expect(calculateBasisPoints(1900, 1800)).toBe(342);

      // Half-point tie: 105 * 100 bps (1%) = 1.05 -> rounds to 1
      expect(calculateBasisPoints(105, 100)).toBe(1);

      // Half-point tie: 150 * 100 bps (1%) = 1.50 -> rounds to 2
      expect(calculateBasisPoints(150, 100)).toBe(2);
    });

    it("calculates tax-inclusive breakdown with rounding and exact sum", () => {
      // Gross 45,000 paise at 5% GST (500 bps)
      // taxable = round((45000 * 10000) / 10500) = round(42857.14) = 42857
      // tax = 45000 - 42857 = 2143
      const result = calculateInclusiveTax(45000, 500);
      expect(result.taxableAmountPaise).toBe(42857);
      expect(result.taxPaise).toBe(2143);
      expect(result.taxableAmountPaise + result.taxPaise).toBe(45000);

      // 0 rate or 0 gross
      expect(calculateInclusiveTax(45000, 0)).toEqual({
        taxableAmountPaise: 45000,
        taxPaise: 0,
      });
      expect(calculateInclusiveTax(0, 500)).toEqual({
        taxableAmountPaise: 0,
        taxPaise: 0,
      });
    });
  });

  describe("Proportional allocation with stable remainder resolution (ADR-001 Rule 7)", () => {
    it("allocates exact proportions when there is no fractional remainder", () => {
      const items = [
        { id: "A", weight: 50 },
        { id: "B", weight: 50 },
      ];
      const result = allocateProportional(100, items);

      expect(result).toEqual([
        { id: "A", allocatedPaise: 50 },
        { id: "B", allocatedPaise: 50 },
      ]);
      expect(result.reduce((sum, r) => sum + r.allocatedPaise, 0)).toBe(100);
    });

    it("resolves remainder ties by ascending stable line ID (ADR-001 Example)", () => {
      // Allocate 10 paise across lines A, B, C with equal weights (1:1:1)
      // Base share = 3 each (total 9), remainder = 1 paise.
      // Ascending ID resolves tie -> Line A receives the 1 leftover paise.
      const items = [
        { id: "C", weight: 1 },
        { id: "A", weight: 1 },
        { id: "B", weight: 1 },
      ];
      const result = allocateProportional(10, items);

      expect(result).toEqual([
        { id: "C", allocatedPaise: 3 },
        { id: "A", allocatedPaise: 4 },
        { id: "B", allocatedPaise: 3 },
      ]);
      expect(result.reduce((sum, r) => sum + r.allocatedPaise, 0)).toBe(10);
    });

    it("resolves remainder ties with numeric IDs in ascending order", () => {
      const items = [
        { id: 30, weight: 10 },
        { id: 10, weight: 10 },
        { id: 20, weight: 10 },
      ];
      const result = allocateProportional(100, items);
      // Base shares = 33 each (99 sum), leftover = 1 paise -> ID 10 gets +1
      expect(result).toEqual([
        { id: 30, allocatedPaise: 33 },
        { id: 10, allocatedPaise: 34 },
        { id: 20, allocatedPaise: 33 },
      ]);
      expect(result.reduce((sum, r) => sum + r.allocatedPaise, 0)).toBe(100);
    });

    it("handles zero-weight lines correctly by giving them zero allocation", () => {
      const items = [
        { id: "A", weight: 100 },
        { id: "B", weight: 0 },
      ];
      const result = allocateProportional(5000, items);

      expect(result).toEqual([
        { id: "A", allocatedPaise: 5000 },
        { id: "B", allocatedPaise: 0 },
      ]);
    });

    it("handles signed negative source amounts by reapplying sign", () => {
      const items = [
        { id: "A", weight: 1 },
        { id: "B", weight: 1 },
        { id: "C", weight: 1 },
      ];
      const result = allocateProportional(-10, items);

      expect(result).toEqual([
        { id: "A", allocatedPaise: -4 },
        { id: "B", allocatedPaise: -3 },
        { id: "C", allocatedPaise: -3 },
      ]);
      expect(result.reduce((sum, r) => sum + r.allocatedPaise, 0)).toBe(-10);
    });

    it("throws when allocating non-zero amount across zero total weight or zero items", () => {
      expect(() => allocateProportional(100, [])).toThrow(RangeError);
      expect(() =>
        allocateProportional(100, [
          { id: "A", weight: 0 },
          { id: "B", weight: 0 },
        ])
      ).toThrow(RangeError);
    });
  });

  describe("Aggregate serialization and presentation helpers", () => {
    it("serializes large aggregates to base-10 strings without scientific notation", () => {
      expect(serializeAggregatePaise(3000000000n)).toBe("3000000000");
      expect(serializeAggregatePaise(-5000000000n)).toBe("-5000000000");
      expect(serializeAggregatePaise(125000)).toBe("125000");
      expect(serializeAggregatePaise("999999999999")).toBe("999999999999");

      expect(() => serializeAggregatePaise("10.5")).toThrow(TypeError);
      expect(() => serializeAggregatePaise("abc")).toThrow(TypeError);
    });

    it("parses aggregate strings to BigInt", () => {
      expect(parseAggregatePaise("3000000000")).toBe(3000000000n);
      expect(parseAggregatePaise("-5000000000")).toBe(-5000000000n);
      expect(parseAggregatePaise(125000)).toBe(125000n);
      expect(parseAggregatePaise(500n)).toBe(500n);
    });

    it("formats paise into Indian Rupee presentation string", () => {
      expect(formatPaiseToRupeesString(125000, { includeCurrencySymbol: true })).toBe("₹1,250.00");
      expect(formatPaiseToRupeesString(45050)).toBe("450.50");
      expect(formatPaiseToRupeesString(5)).toBe("0.05");
      expect(formatPaiseToRupeesString(0)).toBe("0.00");
      expect(formatPaiseToRupeesString(-40000, { includeCurrencySymbol: true })).toBe("-₹400.00");
    });

    it("preserves backward compatibility for rupeesToPaise and paiseToRupees", () => {
      expect(rupeesToPaise(450)).toBe(45000);
      expect(rupeesToPaise(1.005)).toBe(101); // IEEE-754 epsilon rounding
      expect(paiseToRupees(45000)).toBe(450);
      expect(paiseToRupees(0)).toBe(0);
    });
  });
});
