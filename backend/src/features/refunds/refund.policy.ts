import { AppError } from "../../utils/error";
import type { RefundStatus } from "../../utils/types";
import type { RequestRefundInput } from "./refund.schemas";

export interface RefundableOrderItem {
  id: number;
  quantity: number;
  lineTotalPaise: number;
  discountAllocationPaise: number;
  taxRateBps: number;
  taxPaise: number;
}

export interface ExistingAllocation {
  kind: "item" | "delivery_fee";
  orderItemId: number | null;
  quantity: number | null;
  amountPaise: number;
  taxPaise: number;
}

export const activeRefundStatuses: RefundStatus[] = [
  "requested", "approved", "submitted", "processing", "processed", "failed",
];

const conflict = (message: string) =>
  new AppError(message, 409, "INVALID_STATE_TRANSITION");

export const requireRefundStatus = (
  actual: RefundStatus,
  expected: RefundStatus | RefundStatus[]
) => {
  const allowed = Array.isArray(expected) ? expected : [expected];
  if (!allowed.includes(actual)) throw conflict(`Refund cannot transition from ${actual}.`);
};

export const assertRefundCapacity = (
  capturedPaise: number,
  reservedPaise: number,
  requestedPaise: number
) => {
  if (reservedPaise + requestedPaise > capturedPaise) {
    throw new AppError(
      "Refund amount exceeds the captured payment balance.",
      422,
      "REFUND_EXCEEDS_CAPTURED_AMOUNT"
    );
  }
};

const proportional = (part: number, total: number, amount: number) => {
  if (total === 0) return 0;
  return Number((BigInt(part) * BigInt(amount)) / BigInt(total));
};

const remainingTaxAllocation = (paidTax: number, paidAmount: number, usedTax: number, usedAmount: number, amount: number) =>
  Math.min(amount, paidTax - usedTax, Math.max(0, proportional(paidTax, paidAmount, usedAmount + amount) - usedTax));

export const buildRefundAllocations = ({
  input,
  orderItems,
  deliveryFeePaise,
  deliveryTaxPaise,
  existing,
}: {
  input: RequestRefundInput;
  orderItems: RefundableOrderItem[];
  deliveryFeePaise: number;
  deliveryTaxRateBps: number;
  deliveryTaxPaise: number;
  existing: ExistingAllocation[];
}) => {
  const itemById = new Map(orderItems.map((item) => [item.id, item]));
  const seenItems = new Set<number>();
  let seenDelivery = false;
  let total = 0;

  const rows = input.allocations.map((allocation) => {
    total += allocation.allocatedPaise;
    if ("orderItemId" in allocation) {
      if (seenItems.has(allocation.orderItemId)) {
        throw new AppError("Each order item may be allocated only once.", 400, "INVALID_REFUND_ALLOCATION");
      }
      seenItems.add(allocation.orderItemId);
      const item = itemById.get(allocation.orderItemId);
      if (!item) throw new AppError("Refund allocation does not belong to this order.", 422, "INVALID_REFUND_ALLOCATION");
      const usedQuantity = existing
        .filter((row) => row.kind === "item" && row.orderItemId === item.id)
        .reduce((sum, row) => sum + (row.quantity ?? 0), 0);
      const usedAmount = existing
        .filter((row) => row.kind === "item" && row.orderItemId === item.id)
        .reduce((sum, row) => sum + row.amountPaise, 0);
      const maxForQuantity = proportional(item.lineTotalPaise, item.quantity, usedQuantity + allocation.quantity) - usedAmount;
      if (usedQuantity + allocation.quantity > item.quantity ||
          usedAmount + allocation.allocatedPaise > item.lineTotalPaise ||
          allocation.allocatedPaise > maxForQuantity) {
        throw new AppError("Refund item allocation exceeds the purchased quantity or amount.", 422, "INVALID_REFUND_ALLOCATION");
      }
      const usedTax = existing.filter((row) => row.kind === "item" && row.orderItemId === item.id)
        .reduce((sum, row) => sum + row.taxPaise, 0);
      // Cumulative apportionment exhausts the immutable paid tax exactly,
      // including the rounding remainder on the final allocation.
      const taxPaise = remainingTaxAllocation(item.taxPaise, item.lineTotalPaise, usedTax, usedAmount, allocation.allocatedPaise);
      return {
        kind: "item" as const,
        orderItemId: item.id,
        quantity: allocation.quantity,
        amountPaise: allocation.allocatedPaise,
        taxableAmountPaise: allocation.allocatedPaise - taxPaise,
        taxPaise,
        discountReversalPaise: proportional(
          item.discountAllocationPaise,
          item.lineTotalPaise,
          allocation.allocatedPaise
        ),
      };
    }

    if (seenDelivery) throw new AppError("Delivery fee may be allocated only once.", 400, "INVALID_REFUND_ALLOCATION");
    seenDelivery = true;
    const usedAmount = existing
      .filter((row) => row.kind === "delivery_fee")
      .reduce((sum, row) => sum + row.amountPaise, 0);
    if (usedAmount + allocation.allocatedPaise > deliveryFeePaise) {
      throw new AppError("Refund delivery allocation exceeds the charged fee.", 422, "INVALID_REFUND_ALLOCATION");
    }
    const usedTax = existing.filter((row) => row.kind === "delivery_fee")
      .reduce((sum, row) => sum + row.taxPaise, 0);
    const taxPaise = remainingTaxAllocation(deliveryTaxPaise, deliveryFeePaise, usedTax, usedAmount, allocation.allocatedPaise);
    return {
      kind: "delivery_fee" as const,
      orderItemId: null,
      quantity: null,
      amountPaise: allocation.allocatedPaise,
      taxableAmountPaise: allocation.allocatedPaise - taxPaise,
      taxPaise,
      discountReversalPaise: 0,
    };
  });

  if (total !== input.amountPaise) {
    throw new AppError("Refund allocations must equal amountPaise.", 422, "INVALID_REFUND_ALLOCATION");
  }
  return rows;
};

