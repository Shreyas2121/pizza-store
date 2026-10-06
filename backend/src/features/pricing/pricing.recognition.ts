import { AppError } from "../../utils/error";
import {
  addPaise,
  subtractPaise,
  calculateInclusiveTax,
  MONEY_CAPS,
} from "../../utils/money";

export const buildRecognitionPricingSnapshot = (input: {
  lines: ReadonlyArray<{
    lineSubtotalPaise: number;
    taxableAmountPaise: number;
    taxPaise: number;
    taxRateBps: number;
  }>;
  deliveryTaxableAmountPaise: number;
  deliveryTaxPaise: number;
  totalTaxPaise: number;
}) => {
  const preDiscountTaxableFoodPaise = addPaise(
    input.lines.map(
      (line) =>
        calculateInclusiveTax(line.lineSubtotalPaise, line.taxRateBps)
          .taxableAmountPaise,
    ),
    MONEY_CAPS.ORDER_AMOUNT,
    "Pre-discount taxable food total",
  );
  const postDiscountTaxableFoodPaise = addPaise(
    input.lines.map((line) => line.taxableAmountPaise),
    MONEY_CAPS.ORDER_AMOUNT,
    "Taxable food total",
  );
  const itemTaxPaise = addPaise(
    input.lines.map((line) => line.taxPaise),
    MONEY_CAPS.ORDER_AMOUNT,
    "Item tax total",
  );
  if (itemTaxPaise + input.deliveryTaxPaise !== input.totalTaxPaise) {
    throw new AppError(
      "Order recognition tax snapshot does not reconcile.",
      409,
      "ORDER_RECOGNITION_MISMATCH",
    );
  }
  return {
    preDiscountTaxableFoodPaise,
    discountContraPaise: subtractPaise(
      preDiscountTaxableFoodPaise,
      postDiscountTaxableFoodPaise,
      {
        domainCap: MONEY_CAPS.ORDER_AMOUNT,
      },
    ),
    taxableDeliveryPaise: input.deliveryTaxableAmountPaise,
    itemTaxPaise,
    deliveryTaxPaise: input.deliveryTaxPaise,
  };
};
