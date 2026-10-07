import type { ordersTable } from "../../db/schema";
import type { OrderCostSnapshot } from "../costs/cost.service";
import { AppError } from "../../utils/error";
import { addPaise, MONEY_CAPS } from "../../utils/money";
import { buildRecognitionPricingSnapshot } from "../pricing/pricing.recognition";

type RecognitionOrder = Pick<typeof ordersTable.$inferSelect,
  "id" | "pricingPolicyVersion" | "discountMode" | "itemsSubtotalPaise" | "discountPaise" |
  "deliveryFeePaise" | "deliveryTaxableAmountPaise" | "deliveryTaxPaise" | "taxPaise" |
  "grandTotalPaise" | "roundingAdjustmentPaise">;

// The order's paid selling prices are authoritative. Catalogue compare-at prices,
// mutable promotion definitions, and waived delivery fees cannot enter revenue.
export const buildDeliveredOrderPayload = (
  order: RecognitionOrder,
  lines: readonly OrderCostSnapshot[],
  deliveredAt: Date,
) => {
  const sum = (values: number[]) => addPaise(values, MONEY_CAPS.ORDER_AMOUNT);
  const recognition = buildRecognitionPricingSnapshot({
    lines,
    deliveryTaxableAmountPaise: order.deliveryTaxableAmountPaise,
    deliveryTaxPaise: order.deliveryTaxPaise,
    totalTaxPaise: order.taxPaise,
  });
  if (!lines.length ||
    lines.some((line) => line.taxableAmountPaise + line.taxPaise !== line.lineSubtotalPaise - line.discountAllocationPaise) ||
    sum(lines.map((line) => line.lineSubtotalPaise)) !== order.itemsSubtotalPaise ||
    sum(lines.map((line) => line.discountAllocationPaise)) !== order.discountPaise ||
    order.deliveryTaxableAmountPaise + order.deliveryTaxPaise !== order.deliveryFeePaise ||
    order.itemsSubtotalPaise - order.discountPaise + order.deliveryFeePaise + order.roundingAdjustmentPaise !== order.grandTotalPaise) {
    throw new AppError("Order recognition paid snapshots do not reconcile.", 409, "ORDER_RECOGNITION_MISMATCH");
  }
  return {
    orderId: order.id,
    pricingPolicyVersion: order.pricingPolicyVersion,
    discountMode: order.discountMode,
    customerTotalPaise: order.grandTotalPaise,
    ...recognition,
    foodSubtotalPaise: order.itemsSubtotalPaise,
    itemDiscountPaise: order.discountPaise,
    chargedDeliveryFeePaise: order.deliveryFeePaise,
    roundingAdjustmentPaise: order.roundingAdjustmentPaise,
    lineCostSnapshots: lines,
    deliveredAt: deliveredAt.toISOString(),
  };
};
