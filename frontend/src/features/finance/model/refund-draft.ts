import type { OrderRes } from "@/features/orders";
import { parseRupeesToPaise } from "@/shared/lib";

export function buildRefundDraft(order: Pick<OrderRes, "chargedDeliveryFeePaise" | "grandTotalPaise"> & {
  items: Array<Pick<OrderRes["items"][number], "id" | "quantity" | "lineTotalPaise">>;
}, draft: {
  orderItemId: string | null;
  quantity: number | string;
  itemAmountRupees: number | string;
  includeDelivery: boolean;
  deliveryAmountRupees: number | string;
}) {
  const allocations: Array<{ orderItemId: number; quantity: number; allocatedPaise: number } | { type: "delivery_fee"; allocatedPaise: number }> = [];
  const positiveAmount = (value: number | string, label: string) => {
    const amount = value === "" ? 0 : parseRupeesToPaise(value);
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error(`Enter a positive ${label}.`);
    return amount;
  };
  if (draft.orderItemId !== null) {
    const item = order.items.find((item) => String(item.id) === draft.orderItemId);
    const quantity = draft.quantity;
    if (!item || typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1 || quantity > item.quantity) {
      throw new Error("Select a valid purchased item and quantity.");
    }
    const allocatedPaise = positiveAmount(draft.itemAmountRupees, "item refund amount");
    const maxItemPaise = Number(BigInt(item.lineTotalPaise) * BigInt(quantity) / BigInt(item.quantity));
    if (allocatedPaise > maxItemPaise) throw new Error("Item refund exceeds the paid amount for this quantity. Refund delivery separately below.");
    allocations.push({ orderItemId: item.id, quantity, allocatedPaise });
  }
  if (draft.includeDelivery) {
    const allocatedPaise = positiveAmount(draft.deliveryAmountRupees, "delivery refund amount");
    if (allocatedPaise > order.chargedDeliveryFeePaise) throw new Error("Delivery refund exceeds the charged delivery fee.");
    allocations.push({ type: "delivery_fee", allocatedPaise });
  }
  if (!allocations.length) throw new Error("Select an item or delivery charge to refund.");
  const amountPaise = allocations.reduce((total, allocation) => total + allocation.allocatedPaise, 0);
  if (!Number.isSafeInteger(amountPaise) || amountPaise > order.grandTotalPaise) throw new Error("Total refund exceeds the paid order total.");
  return { amountPaise, allocations };
}
