import { AppError } from "../../utils/error";
import { addPaise, paiseToRupees, subtractPaise } from "../../utils/money";

interface ExactOrderMoney {
  discountPaise: number | null;
  grandTotalPaise: number | null;
}

interface ExactCustomizationSnapshot {
  customizationName: string | null;
  pricePaise: number | null;
  customizationOption?: Record<string, unknown> | null;
}

interface ExactOrderItemSnapshot {
  productName: string | null;
  unitPricePaise: number | null;
  orderItemCustomizations?: ExactCustomizationSnapshot[];
  product?: Record<string, unknown> | null;
}

const missingSnapshot = (field: string): never => {
  throw new AppError(
    `Order is missing its exact ${field} snapshot`,
    500,
    "ORDER_MONEY_SNAPSHOT_MISSING"
  );
};

const requirePaise = (value: number | null, field: string) =>
  value ?? missingSnapshot(field);

export const orderGrandTotalRupees = (order: ExactOrderMoney) =>
  paiseToRupees(requirePaise(order.grandTotalPaise, "grand total"));

// Float rupees exist only in these outward-facing compatibility projections.
const mapCustomization = <T extends ExactCustomizationSnapshot>(snapshot: T) => {
  const name =
    snapshot.customizationName ?? missingSnapshot("customization name");
  const price = paiseToRupees(
    requirePaise(snapshot.pricePaise, "customization price")
  );

  return {
    ...snapshot,
    price,
    customizationOption: snapshot.customizationOption
      ? { ...snapshot.customizationOption, name, price }
      : snapshot.customizationOption,
  };
};

const mapOrderItem = <T extends ExactOrderItemSnapshot>(snapshot: T) => {
  const productName = snapshot.productName ?? missingSnapshot("product name");
  const customizations = (snapshot.orderItemCustomizations ?? []).map(
    mapCustomization
  );
  const customizationUnitPaise = addPaise(
    customizations.map((item) =>
      requirePaise(item.pricePaise, "customization price")
    )
  );
  const baseUnitPricePaise = subtractPaise(
    requirePaise(snapshot.unitPricePaise, "unit price"),
    customizationUnitPaise
  );

  return {
    ...snapshot,
    price: paiseToRupees(baseUnitPricePaise),
    product: snapshot.product
      ? { ...snapshot.product, name: productName }
      : snapshot.product,
    orderItemCustomizations: customizations,
  };
};

export const toOrderResponse = <
  T extends ExactOrderMoney & { items?: ExactOrderItemSnapshot[] },
>(order: T) => ({
  ...order,
  discountAmount: paiseToRupees(
    requirePaise(order.discountPaise, "discount")
  ),
  totalPrice: orderGrandTotalRupees(order),
  ...(order.items ? { items: order.items.map(mapOrderItem) } : {}),
});
