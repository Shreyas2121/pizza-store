const PAISE_PER_RUPEE = 100;

const assertValidMoney = (amount: number, label: string) => {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new RangeError(`${label} must be a finite, non-negative number`);
  }
};

/**
 * Converts the application's rupee values to the integer currency subunits
 * required by Razorpay. The scaled epsilon handles decimal half-values such
 * as 1.005 and 10.075 that IEEE-754 can represent just below the midpoint.
 */
export const rupeesToPaise = (rupees: number) => {
  assertValidMoney(rupees, "Rupee amount");

  const scaledAmount = rupees * PAISE_PER_RUPEE;
  const paise = Math.round(
    scaledAmount + Number.EPSILON * Math.abs(scaledAmount)
  );
  if (!Number.isSafeInteger(paise)) {
    throw new RangeError("Rupee amount is too large to convert safely");
  }

  return paise;
};

export const paiseToRupees = (paise: number) => {
  assertValidMoney(paise, "Paise amount");
  if (!Number.isSafeInteger(paise)) {
    throw new RangeError("Paise amount must be a safe integer");
  }

  return paise / PAISE_PER_RUPEE;
};
