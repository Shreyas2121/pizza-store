/**
 * Core Money Primitives and Bounded Paise Utilities
 *
 * Implements ADR-001 (Money representation, limits, rounding, and allocation).
 *
 * Standard rules:
 * 1. INR amounts are represented as integer paise (1 Rupee = 100 Paise).
 * 2. Standard transaction fields are bounded by PostgreSQL 32-bit signed int [-2147483648, 2147483647].
 * 3. Domain caps restrict individual business aggregates to prevent arithmetic overflow.
 * 4. Percentage rates use basis points (1% = 100 bps, 100% = 10000 bps).
 * 5. Rounding ties move away from zero (half-away-from-zero).
 * 6. Proportional allocation preserves sum(allocations) === sourceAmount with stable ID remainder tie-breaking.
 * 7. Aggregate DTOs exceeding 32-bit limits use canonical base-10 strings.
 */

export const PAISE_PER_RUPEE = 100;
export const MAX_POSTGRES_INT = 2_147_483_647; // ₹21,474,836.47
export const MIN_POSTGRES_INT = -2_147_483_648;

/**
 * Domain-specific maximum caps in integer paise
 */
export const MONEY_CAPS = {
  ORDER_AMOUNT: 500_000, // ₹5,000.00
  ITEM_PRICE: 100_000, // ₹1,000.00
  CUSTOMIZATION_PRICE: 50_000, // ₹500.00
  DELIVERY_FEE: 50_000, // ₹500.00
  DISCOUNT: 500_000, // ₹5,000.00
  EXPENSE_AMOUNT: 50_000_000, // ₹500,000.00
  PAY_RUN_AMOUNT: 100_000_000, // ₹1,000,000.00
  JOURNAL_LINE: MAX_POSTGRES_INT, // ₹21,474,836.47
} as const;

/**
 * Asserts that a value is a valid non-negative integer number of paise within domain cap
 */
export const assertNonNegativePaise = (
  paise: number,
  domainCap: number = MAX_POSTGRES_INT,
  label = "Paise amount"
): void => {
  if (
    typeof paise !== "number" ||
    !Number.isFinite(paise) ||
    !Number.isInteger(paise) ||
    !Number.isSafeInteger(paise)
  ) {
    throw new TypeError(`${label} must be a safe integer number of paise (received ${paise})`);
  }
  if (paise < 0) {
    throw new RangeError(`${label} cannot be negative (received ${paise})`);
  }
  if (paise > domainCap) {
    throw new RangeError(`${label} exceeds domain limit of ${domainCap} paise (received ${paise})`);
  }
};

/**
 * Asserts that a value is a valid signed integer number of paise within domain cap
 */
export const assertSignedPaise = (
  paise: number,
  domainCap: number = MAX_POSTGRES_INT,
  label = "Signed paise amount"
): void => {
  if (
    typeof paise !== "number" ||
    !Number.isFinite(paise) ||
    !Number.isInteger(paise) ||
    !Number.isSafeInteger(paise)
  ) {
    throw new TypeError(`${label} must be a safe integer number of paise (received ${paise})`);
  }
  if (paise < -domainCap || paise > domainCap) {
    throw new RangeError(
      `${label} exceeds domain range [${-domainCap}, ${domainCap}] paise (received ${paise})`
    );
  }
};

/**
 * Parses and validates an unknown input into a non-negative integer paise number
 */
export const parsePaise = (
  input: unknown,
  domainCap: number = MAX_POSTGRES_INT,
  label = "Paise amount"
): number => {
  if (typeof input === "number") {
    assertNonNegativePaise(input, domainCap, label);
    return input;
  }
  if (typeof input === "string") {
    if (!/^\d+$/.test(input)) {
      throw new TypeError(
        `${label} string must contain digits only without decimals, signs, or formatting (received "${input}")`
      );
    }
    const parsed = Number(input);
    assertNonNegativePaise(parsed, domainCap, label);
    return parsed;
  }
  if (typeof input === "bigint") {
    if (input < 0n || input > BigInt(domainCap)) {
      throw new RangeError(
        `${label} bigint out of range [0, ${domainCap}] (received ${input}n)`
      );
    }
    return Number(input);
  }
  throw new TypeError(`${label} must be a number, numeric string, or bigint`);
};

/**
 * Parses and validates an unknown input into a signed integer paise number
 */
export const parseSignedPaise = (
  input: unknown,
  domainCap: number = MAX_POSTGRES_INT,
  label = "Signed paise amount"
): number => {
  if (typeof input === "number") {
    assertSignedPaise(input, domainCap, label);
    return input;
  }
  if (typeof input === "string") {
    if (!/^-?\d+$/.test(input)) {
      throw new TypeError(
        `${label} string must contain digits with optional leading minus sign only (received "${input}")`
      );
    }
    const parsed = Number(input);
    assertSignedPaise(parsed, domainCap, label);
    return parsed;
  }
  if (typeof input === "bigint") {
    if (input < BigInt(-domainCap) || input > BigInt(domainCap)) {
      throw new RangeError(
        `${label} bigint out of range [${-domainCap}, ${domainCap}] (received ${input}n)`
      );
    }
    return Number(input);
  }
  throw new TypeError(`${label} must be a number, numeric string, or bigint`);
};

/**
 * Rounds a rational number to the nearest integer with ties broken away from zero
 * e.g., 10.5 -> 11, -10.5 -> -11, 10.4 -> 10, -10.4 -> -10
 */
export const roundHalfAwayFromZero = (value: number): number => {
  if (!Number.isFinite(value)) {
    throw new RangeError("Cannot round non-finite value");
  }
  return value >= 0 ? Math.floor(value + 0.5) : Math.ceil(value - 0.5);
};

/**
 * Checked addition of non-negative integer paise amounts
 */
export const addPaise = (
  amounts: number[],
  domainCap: number = MAX_POSTGRES_INT,
  label = "Addition result"
): number => {
  let sum = 0;
  for (const amount of amounts) {
    assertNonNegativePaise(amount, domainCap, "Addend");
    sum += amount;
    if (!Number.isSafeInteger(sum) || sum > domainCap) {
      throw new RangeError(`${label} exceeded domain cap of ${domainCap} paise`);
    }
  }
  return sum;
};

/**
 * Checked subtraction of integer paise amounts
 */
export const subtractPaise = (
  minuend: number,
  subtrahend: number,
  options: { allowNegative?: boolean; domainCap?: number } = {}
): number => {
  const domainCap = options.domainCap ?? MAX_POSTGRES_INT;
  const allowNegative = options.allowNegative ?? false;

  if (allowNegative) {
    assertSignedPaise(minuend, domainCap, "Minuend");
    assertSignedPaise(subtrahend, domainCap, "Subtrahend");
  } else {
    assertNonNegativePaise(minuend, domainCap, "Minuend");
    assertNonNegativePaise(subtrahend, domainCap, "Subtrahend");
  }

  const result = minuend - subtrahend;
  if (!Number.isSafeInteger(result)) {
    throw new RangeError("Subtraction result is not a safe integer");
  }
  if (!allowNegative && result < 0) {
    throw new RangeError(
      `Subtraction result cannot be negative (minuend=${minuend}, subtrahend=${subtrahend})`
    );
  }
  if (Math.abs(result) > domainCap) {
    throw new RangeError(
      `Subtraction result exceeded domain cap of ${domainCap} paise`
    );
  }
  return result;
};

/**
 * Checked multiplication of unit price by non-negative integer quantity
 */
export const multiplyPaiseByQuantity = (
  unitPaise: number,
  quantity: number,
  domainCap: number = MAX_POSTGRES_INT
): number => {
  assertNonNegativePaise(unitPaise, domainCap, "Unit price");
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new RangeError(
      `Quantity must be a non-negative integer (received ${quantity})`
    );
  }
  const result = unitPaise * quantity;
  if (!Number.isSafeInteger(result) || result > domainCap) {
    throw new RangeError(
      `Multiplication result ${result} exceeded domain cap of ${domainCap} paise`
    );
  }
  return result;
};

/**
 * Calculates percentage of an amount in basis points (1 bps = 0.01%, 10000 bps = 100%)
 * Uses exact rational arithmetic with half-away-from-zero rounding.
 */
export const calculateBasisPoints = (
  amountPaise: number,
  rateBps: number
): number => {
  assertNonNegativePaise(amountPaise, MAX_POSTGRES_INT, "Amount");
  if (!Number.isInteger(rateBps) || rateBps < 0) {
    throw new RangeError(
      `Rate basis points must be a non-negative integer (received ${rateBps})`
    );
  }
  const product = amountPaise * rateBps;
  if (!Number.isSafeInteger(product)) {
    throw new RangeError(
      "Intermediate product for basis points calculation exceeded safe integer range"
    );
  }
  return roundHalfAwayFromZero(product / 10000);
};

/**
 * Computes taxable base and inclusive tax breakdown from a gross amount and tax rate in bps
 * taxable = round((gross * 10000) / (10000 + rateBps))
 * tax = gross - taxable
 */
export const calculateInclusiveTax = (
  grossAmountPaise: number,
  taxRateBps: number
): { taxableAmountPaise: number; taxPaise: number } => {
  assertNonNegativePaise(grossAmountPaise, MAX_POSTGRES_INT, "Gross amount");
  if (!Number.isInteger(taxRateBps) || taxRateBps < 0) {
    throw new RangeError(
      `Tax rate basis points must be a non-negative integer (received ${taxRateBps})`
    );
  }
  if (taxRateBps === 0 || grossAmountPaise === 0) {
    return { taxableAmountPaise: grossAmountPaise, taxPaise: 0 };
  }
  const numerator = grossAmountPaise * 10000;
  const denominator = 10000 + taxRateBps;
  const taxableAmountPaise = roundHalfAwayFromZero(numerator / denominator);
  const taxPaise = grossAmountPaise - taxableAmountPaise;

  return { taxableAmountPaise, taxPaise };
};

/**
 * Proportional allocation interface
 */
export interface AllocationItem<T = string | number> {
  id: T;
  weight: number;
}

export interface AllocationResult<T = string | number> {
  id: T;
  allocatedPaise: number;
}

/**
 * Allocates a source paise amount proportionally across lines by weight.
 * Assigns truncated exact share, then distributes leftover paise by descending
 * fractional remainder, resolving ties by ascending stable line ID.
 *
 * Invariant: sum(allocatedPaise) === sourceAmountPaise.
 */
export const allocateProportional = <T extends string | number>(
  sourceAmountPaise: number,
  items: Array<AllocationItem<T>>
): Array<AllocationResult<T>> => {
  if (items.length === 0) {
    if (sourceAmountPaise !== 0) {
      throw new RangeError("Cannot allocate non-zero amount across zero items");
    }
    return [];
  }

  const isNegative = sourceAmountPaise < 0;
  const absSource = Math.abs(sourceAmountPaise);
  assertNonNegativePaise(absSource, MAX_POSTGRES_INT, "Source allocation amount");

  let totalWeight = 0;
  for (const item of items) {
    if (!Number.isInteger(item.weight) || item.weight < 0) {
      throw new RangeError(
        `Allocation weight for item ${String(item.id)} must be a non-negative integer (received ${item.weight})`
      );
    }
    totalWeight += item.weight;
  }

  if (totalWeight === 0) {
    if (absSource !== 0) {
      throw new RangeError("Cannot allocate non-zero amount when total weight is zero");
    }
    return items.map((item) => ({ id: item.id, allocatedPaise: 0 }));
  }

  if (absSource === 0) {
    return items.map((item) => ({ id: item.id, allocatedPaise: 0 }));
  }

  let allocatedSum = 0;
  const lineDetails = items.map((item, originalIndex) => {
    if (item.weight === 0) {
      return {
        id: item.id,
        originalIndex,
        baseShare: 0,
        fractionalRemainder: 0,
      };
    }
    const numerator = absSource * item.weight;
    const baseShare = Math.floor(numerator / totalWeight);
    const remainder = numerator % totalWeight;
    allocatedSum += baseShare;
    return {
      id: item.id,
      originalIndex,
      baseShare,
      fractionalRemainder: remainder / totalWeight,
    };
  });

  const leftoverPaise = absSource - allocatedSum;
  if (leftoverPaise > 0) {
    const sortedIndices = lineDetails
      .map((line, idx) => ({ ...line, idx }))
      .sort((a, b) => {
        if (b.fractionalRemainder !== a.fractionalRemainder) {
          return b.fractionalRemainder - a.fractionalRemainder;
        }
        if (typeof a.id === "number" && typeof b.id === "number") {
          return a.id - b.id;
        }
        return String(a.id).localeCompare(String(b.id));
      });

    for (let i = 0; i < leftoverPaise; i++) {
      const targetIdx = sortedIndices[i % sortedIndices.length].idx;
      lineDetails[targetIdx].baseShare += 1;
    }
  }

  return lineDetails.map((line) => ({
    id: line.id,
    allocatedPaise: isNegative ? -line.baseShare : line.baseShare,
  }));
};

/**
 * Serializes aggregate financial values into canonical base-10 strings (for values that can exceed 32-bit int)
 */
export const serializeAggregatePaise = (
  value: bigint | number | string
): string => {
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (typeof value === "number") {
    if (!Number.isInteger(value) || !Number.isSafeInteger(value)) {
      throw new TypeError(`Cannot serialize non-integer or unsafe number: ${value}`);
    }
    return String(value);
  }
  if (typeof value === "string") {
    if (!/^-?\d+$/.test(value)) {
      throw new TypeError(`Invalid aggregate paise string format: "${value}"`);
    }
    return value;
  }
  throw new TypeError("Value must be a bigint, integer number, or base-10 digit string");
};

/**
 * Parses aggregate financial strings into BigInt
 */
export const parseAggregatePaise = (
  value: string | number | bigint
): bigint => {
  if (typeof value === "bigint") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isInteger(value) || !Number.isSafeInteger(value)) {
      throw new TypeError(`Cannot parse non-integer or unsafe number into aggregate: ${value}`);
    }
    return BigInt(value);
  }
  if (typeof value === "string") {
    if (!/^-?\d+$/.test(value)) {
      throw new TypeError(`Invalid aggregate paise string format: "${value}"`);
    }
    return BigInt(value);
  }
  throw new TypeError("Value must be a bigint, integer number, or base-10 digit string");
};

/**
 * Formats integer paise into standard Indian Rupee string (e.g. ₹1,250.00 or 1250.00)
 */
export const formatPaiseToRupeesString = (
  paise: number,
  options: { includeCurrencySymbol?: boolean } = {}
): string => {
  const isNegative = paise < 0;
  const absPaise = Math.abs(paise);
  assertNonNegativePaise(absPaise, MAX_POSTGRES_INT, "Paise to format");
  const rupees = Math.floor(absPaise / 100);
  const remainingPaise = absPaise % 100;
  const paiseStr = remainingPaise.toString().padStart(2, "0");
  const formattedRupees = rupees.toLocaleString("en-IN");
  const formatted = `${formattedRupees}.${paiseStr}`;

  if (options.includeCurrencySymbol) {
    return isNegative ? `-₹${formatted}` : `₹${formatted}`;
  }
  return isNegative ? `-${formatted}` : formatted;
};

/**
 * Backward-compatible conversion from float rupees to integer paise
 */
export const rupeesToPaise = (rupees: number): number => {
  if (!Number.isFinite(rupees) || rupees < 0) {
    throw new RangeError("Rupee amount must be a finite, non-negative number");
  }
  const scaledAmount = rupees * PAISE_PER_RUPEE;
  const paise = Math.round(
    scaledAmount + Number.EPSILON * Math.abs(scaledAmount)
  );
  if (!Number.isSafeInteger(paise)) {
    throw new RangeError("Rupee amount is too large to convert safely");
  }
  return paise;
};

/**
 * Backward-compatible conversion from integer paise to float rupees (presentation only)
 */
export const paiseToRupees = (paise: number): number => {
  assertNonNegativePaise(paise, MAX_POSTGRES_INT, "Paise amount");
  return paise / PAISE_PER_RUPEE;
};
