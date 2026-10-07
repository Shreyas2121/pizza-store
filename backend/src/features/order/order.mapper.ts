import type { addressTable, orderItemsTable, ordersTable, paymentsTable, promotionApplicationsTable, promotionDiscountAllocationsTable, orderItemBundleComponentsTable } from "../../db/schema";
import { AppError } from "../../utils/error";
import { addPaise, paiseToRupees, subtractPaise } from "../../utils/money";

interface ExactOrderMoney {
  discountPaise: number | null;
  grandTotalPaise: number | null;
}
interface CustomizationSnapshot {
  customizationOptionId?: number;
  customizationName: string | null;
  pricePaise: number | null;
}
type ItemSnapshot = Partial<Omit<typeof orderItemsTable.$inferSelect, "productName" | "unitPricePaise">> & {
  productName: string | null;
  unitPricePaise: number | null;
  product?: { image?: string | null } | null;
  orderItemCustomizations?: CustomizationSnapshot[];
  bundleComponents?: (typeof orderItemBundleComponentsTable.$inferSelect)[];
};
type ApplicationSnapshot = typeof promotionApplicationsTable.$inferSelect & {
  allocations: (typeof promotionDiscountAllocationsTable.$inferSelect)[];
};
type OrderSnapshot = ExactOrderMoney & Partial<Omit<typeof ordersTable.$inferSelect, "discountPaise" | "grandTotalPaise">> & {
  items?: ItemSnapshot[];
  promotionApplications?: ApplicationSnapshot[];
  address?: typeof addressTable.$inferSelect | null;
  payment?: typeof paymentsTable.$inferSelect | null;
  user?: { id: number; fname: string; lname: string; email: string };
  store?: { id: number; name: string; slug: string };
};
const missingSnapshot = (field: string): never => {
  throw new AppError(`Order is missing its exact ${field} snapshot`, 500, "ORDER_MONEY_SNAPSHOT_MISSING");
};
const requireSnapshot = <T>(value: T | null | undefined, field: string): T => value ?? missingSnapshot(field);
export const orderGrandTotalRupees = (order: ExactOrderMoney) =>
  paiseToRupees(requireSnapshot(order.grandTotalPaise, "grand total"));

const mapOrderItem = (snapshot: ItemSnapshot) => {
  const productName = requireSnapshot(snapshot.productName, "product name");
  const unitPricePaise = requireSnapshot(snapshot.unitPricePaise, "unit price");
  const options = (snapshot.orderItemCustomizations ?? []).map((option) => ({
    id: option.customizationOptionId,
    name: requireSnapshot(option.customizationName, "customization name"),
    pricePaise: requireSnapshot(option.pricePaise, "customization price"),
    price: paiseToRupees(requireSnapshot(option.pricePaise, "customization price")),
  }));
  const baseUnitPricePaise = subtractPaise(unitPricePaise, addPaise(options.map((option) => option.pricePaise)));
  return {
    id: snapshot.id, orderId: snapshot.orderId, productId: snapshot.productId,
    quantity: snapshot.quantity, productName, productType: snapshot.productType,
    unitPricePaise, baseUnitPricePaise,
    compareAtUnitPricePaise: snapshot.compareAtUnitPricePaise,
    bundleMarkdownPaise: snapshot.bundleMarkdownPaise ?? 0,
    lineSubtotalPaise: snapshot.lineSubtotalPaise,
    discountAllocationPaise: snapshot.discountAllocationPaise,
    taxableAmountPaise: snapshot.taxableAmountPaise, taxPaise: snapshot.taxPaise,
    lineTotalPaise: snapshot.lineTotalPaise, taxRateBps: snapshot.taxRateBps,
    taxRuleId: snapshot.taxRuleId, taxRuleVersion: snapshot.taxRuleVersion,
    hsnSacCode: snapshot.hsnSacCode, createdAt: snapshot.createdAt, updatedAt: snapshot.updatedAt,
    price: paiseToRupees(baseUnitPricePaise),
    product: { id: snapshot.productId, name: productName, image: snapshot.product?.image ?? null },
    options,
    bundleComponents: [...(snapshot.bundleComponents ?? [])]
      .sort((a, b) => a.componentProductId - b.componentProductId)
      .map((component) => ({
        componentProductId: component.componentProductId, name: component.componentName,
        quantityPerBundle: component.quantityPerBundle, totalQuantity: component.totalQuantity,
      })),
  };
};

// Explicit DTO projection: cost snapshots, provider internals, current definitions
// and unrelated future database columns cannot leak through a spread of rows.
export const toOrderResponse = (order: OrderSnapshot) => {
  const discountPaise = requireSnapshot(order.discountPaise, "discount");
  const totalPrice = orderGrandTotalRupees(order);
  const items = (order.items ?? []).map(mapOrderItem);
  const promotions = [...(order.promotionApplications ?? [])]
    .sort((a, b) => a.promotionId - b.promotionId)
    .map((application) => ({
      id: application.promotionId, applicationId: application.id,
      kind: application.promotionKind, name: application.promotionName, code: application.promotionCode,
      discountType: application.discountType, definitionVersion: application.definitionVersion, status: application.status,
      itemDiscountPaise: application.itemDiscountPaise, deliveryDiscountPaise: application.deliveryDiscountPaise,
      totalSavingsPaise: application.totalSavingsPaise,
      standardDeliveryFeePaise: application.standardDeliveryFeePaise, chargedDeliveryFeePaise: application.chargedDeliveryFeePaise,
      allocations: [...application.allocations].sort((a, b) => a.id - b.id).map((allocation) => ({
        orderItemId: allocation.orderItemId, component: allocation.component,
        unitIndex: allocation.unitIndex, amountPaise: allocation.amountPaise,
      })),
    }));
  const deliveryDiscountPaise = addPaise(promotions.map((promotion) => promotion.deliveryDiscountPaise));
  const bundleMarkdownPaise = addPaise(items.map((item) => item.bundleMarkdownPaise));
  const promotionSavingsPaise = addPaise([discountPaise, deliveryDiscountPaise]);
  return {
    id: requireSnapshot(order.id, "order ID"), userId: requireSnapshot(order.userId, "customer ID"),
    storeId: requireSnapshot(order.storeId, "store ID"),
    discountMode: requireSnapshot(order.discountMode, "discount mode"),
    status: order.status, orderDate: order.orderDate, createdAt: order.createdAt, updatedAt: order.updatedAt,
    paymentType: order.paymentType, paymentId: order.paymentId, addressId: order.addressId,
    itemsSubtotalPaise: order.itemsSubtotalPaise, discountPaise, itemDiscountPaise: discountPaise,
    deliveryFeePaise: order.deliveryFeePaise, chargedDeliveryFeePaise: order.deliveryFeePaise,
    deliveryDiscountPaise, promotionSavingsPaise, bundleMarkdownPaise,
    totalDisplayedSavingsPaise: addPaise([promotionSavingsPaise, bundleMarkdownPaise]),
    taxableAmountPaise: order.taxableAmountPaise, taxPaise: order.taxPaise,
    roundingAdjustmentPaise: order.roundingAdjustmentPaise, grandTotalPaise: order.grandTotalPaise,
    currency: order.currency, quoteVersion: order.quoteVersion, pricingPolicyVersion: order.pricingPolicyVersion,
    pricingBusinessDate: order.pricingBusinessDate, pricingTimezone: order.pricingTimezone,
    taxCalculationPolicyVersion: order.taxCalculationPolicyVersion, taxDisclaimer: order.taxDisclaimer,
    taxIsDemo: order.taxIsDemo, placeOfSupplyState: order.placeOfSupplyState,
    deliveryTaxRateBps: order.deliveryTaxRateBps, deliveryTaxableAmountPaise: order.deliveryTaxableAmountPaise,
    deliveryTaxPaise: order.deliveryTaxPaise, deliveredAt: order.deliveredAt,
    recognizedAt: order.recognizedAt, cancelledAt: order.cancelledAt,
    discountAmount: paiseToRupees(discountPaise), totalPrice, items, promotions,
    ...(order.user ? { user: { id: order.user.id, fname: order.user.fname, lname: order.user.lname, email: order.user.email } } : {}),
    ...(order.store ? { store: { id: order.store.id, name: order.store.name, slug: order.store.slug } } : {}),
    address: order.address ? {
      id: order.address.id, type: order.address.type, street: order.address.street, city: order.address.city,
      state: order.address.state, pincode: order.address.pincode, phone: order.address.phone,
    } : null,
    payment: order.payment ? {
      id: order.payment.id, provider: order.payment.provider, status: order.payment.status,
      providerStatus: order.payment.providerStatus, amountPaise: order.payment.amountPaise, currency: order.payment.currency,
      paidAt: order.payment.paidAt, failedAt: order.payment.failedAt,
    } : null,
  };
};
