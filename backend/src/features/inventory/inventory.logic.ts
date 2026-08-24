import { AppError } from "../../utils/error";
import type { StockStatus } from "../../utils/types";

export interface StockDemandItem {
  productId: number;
  quantity: number;
}

export interface StockChange {
  previousQuantity: number;
  newQuantity: number;
  quantityChange: number;
}

export interface StockAllocationItem {
  storeProductId: number;
  productId: number;
  productName: string;
  demandedQuantity: number;
  isTracked: boolean;
  onHandQuantity: number | null;
  reservedQuantity: number;
  availableQuantity: number | null;
  lowStockThreshold: number;
}

export interface InsufficientStockItem {
  productId: number;
  productName: string;
  requestedQuantity: number;
  availableQuantity: number;
}

export interface LowStockAlert {
  storeId: number;
  storeName?: string;
  storeProductId: number;
  productId: number;
  productName: string;
  currentQuantity: number;
  threshold: number;
  severity: "low_stock" | "out_of_stock";
}

const assertStockInteger = (
  value: number,
  name: string,
  { allowZero }: { allowZero: boolean }
) => {
  if (
    !Number.isSafeInteger(value) ||
    value < 0 ||
    (!allowZero && value === 0)
  ) {
    throw new AppError(`${name} must be a ${allowZero ? "non-negative" : "positive"} integer`, 400);
  }
};

export const aggregateCartDemand = (items: StockDemandItem[]) => {
  const demandByProduct = new Map<number, number>();

  for (const item of items) {
    assertStockInteger(item.productId, "Product ID", { allowZero: false });
    assertStockInteger(item.quantity, "Quantity", { allowZero: false });

    const current = demandByProduct.get(item.productId) ?? 0;
    const next = current + item.quantity;
    if (!Number.isSafeInteger(next)) {
      throw new AppError("Cart quantity is too large", 400);
    }
    demandByProduct.set(item.productId, next);
  }

  return demandByProduct;
};

export const getAvailableQuantity = (
  onHandQuantity: number | null,
  reservedQuantity: number
) => {
  assertStockInteger(reservedQuantity, "Reserved quantity", { allowZero: true });
  if (onHandQuantity === null) return null;

  assertStockInteger(onHandQuantity, "On-hand quantity", { allowZero: true });
  return Math.max(0, onHandQuantity - reservedQuantity);
};

export const deriveStockStatus = (
  onHandQuantity: number | null,
  availableQuantity: number | null,
  lowStockThreshold: number
): StockStatus => {
  assertStockInteger(lowStockThreshold, "Low-stock threshold", {
    allowZero: true,
  });

  if (onHandQuantity === null) return "untracked";
  if (availableQuantity === null) {
    throw new AppError("Tracked stock requires an available quantity", 500);
  }
  assertStockInteger(availableQuantity, "Available quantity", {
    allowZero: true,
  });

  if (availableQuantity === 0) return "out_of_stock";
  if (availableQuantity <= lowStockThreshold) return "low_stock";
  return "in_stock";
};

export const calculateRestock = (
  onHandQuantity: number | null,
  quantityAdded: number
): StockChange => {
  assertStockInteger(quantityAdded, "Restock quantity", { allowZero: false });
  if (onHandQuantity === null) {
    throw new AppError(
      "Enable inventory tracking with an adjustment before restocking",
      409,
      "INVENTORY_NOT_TRACKED"
    );
  }
  assertStockInteger(onHandQuantity, "On-hand quantity", { allowZero: true });

  const newQuantity = onHandQuantity + quantityAdded;
  if (!Number.isSafeInteger(newQuantity)) {
    throw new AppError("Resulting stock quantity is too large", 400);
  }

  return {
    previousQuantity: onHandQuantity,
    newQuantity,
    quantityChange: quantityAdded,
  };
};

export const calculateAdjustment = (
  onHandQuantity: number | null,
  targetQuantity: number
): StockChange => {
  assertStockInteger(targetQuantity, "Target quantity", { allowZero: true });

  // NULL means tracking was disabled. The first adjustment establishes an
  // opening balance, represented as a change from zero in the movement log.
  const previousQuantity = onHandQuantity ?? 0;
  assertStockInteger(previousQuantity, "On-hand quantity", { allowZero: true });

  return {
    previousQuantity,
    newQuantity: targetQuantity,
    quantityChange: targetQuantity - previousQuantity,
  };
};

export const assertAdjustmentCoversReservations = (
  targetQuantity: number,
  reservedQuantity: number
) => {
  assertStockInteger(targetQuantity, "Target quantity", { allowZero: true });
  assertStockInteger(reservedQuantity, "Reserved quantity", { allowZero: true });

  if (targetQuantity < reservedQuantity) {
    throw new AppError(
      "Target quantity cannot be lower than reserved stock",
      409,
      "INVENTORY_ADJUSTMENT_BELOW_RESERVED_STOCK",
      { targetQuantity, reservedQuantity }
    );
  }
};

export const validateStockDemand = (params: {
  demandByProduct: Map<number, number>;
  storeProducts: Array<{
    id: number;
    productId: number;
    onHandQuantity: number | null;
    lowStockThreshold: number;
  }>;
  reservedQuantities: Map<number, number>;
  productNameMap: Map<number, string>;
}): StockAllocationItem[] => {
  const { demandByProduct, storeProducts, reservedQuantities, productNameMap } =
    params;
  const storeProductMap = new Map(
    storeProducts.map((sp) => [sp.productId, sp])
  );

  for (const productId of demandByProduct.keys()) {
    if (!storeProductMap.has(productId)) {
      const productName =
        productNameMap.get(productId) ?? `Product #${productId}`;
      throw new AppError(
        `Store product mapping not found for ${productName}`,
        404,
        "STORE_PRODUCT_NOT_FOUND",
        { productId }
      );
    }
  }

  const allocations: StockAllocationItem[] = [];
  const insufficientItems: InsufficientStockItem[] = [];

  for (const sp of storeProducts) {
    const demanded = demandByProduct.get(sp.productId);
    if (demanded === undefined) continue;

    const reserved = reservedQuantities.get(sp.id) ?? 0;
    const isTracked = sp.onHandQuantity !== null;
    const available = isTracked
      ? getAvailableQuantity(sp.onHandQuantity, reserved)
      : null;
    const productName =
      productNameMap.get(sp.productId) ?? `Product #${sp.productId}`;

    if (isTracked && available !== null && available < demanded) {
      insufficientItems.push({
        productId: sp.productId,
        productName,
        requestedQuantity: demanded,
        availableQuantity: available,
      });
    }

    allocations.push({
      storeProductId: sp.id,
      productId: sp.productId,
      productName,
      demandedQuantity: demanded,
      isTracked,
      onHandQuantity: sp.onHandQuantity,
      reservedQuantity: reserved,
      availableQuantity: available,
      lowStockThreshold: sp.lowStockThreshold,
    });
  }

  if (insufficientItems.length > 0) {
    throw new AppError(
      "Insufficient stock for one or more items",
      409,
      "INSUFFICIENT_STOCK",
      { items: insufficientItems }
    );
  }

  return allocations;
};

export const calculateDownwardThresholdCrossing = (params: {
  storeId: number;
  storeName?: string;
  storeProductId: number;
  productId: number;
  productName: string;
  availableBefore: number;
  availableAfter: number;
  threshold: number;
}): LowStockAlert | null => {
  const {
    storeId,
    storeName,
    storeProductId,
    productId,
    productName,
    availableBefore,
    availableAfter,
    threshold,
  } = params;

  if (availableBefore > 0 && availableAfter <= 0) {
    return {
      storeId,
      ...(storeName ? { storeName } : {}),
      storeProductId,
      productId,
      productName,
      currentQuantity: availableAfter,
      threshold,
      severity: "out_of_stock",
    };
  }

  if (availableBefore > threshold && availableAfter <= threshold) {
    return {
      storeId,
      ...(storeName ? { storeName } : {}),
      storeProductId,
      productId,
      productName,
      currentQuantity: availableAfter,
      threshold,
      severity: "low_stock",
    };
  }

  return null;
};
