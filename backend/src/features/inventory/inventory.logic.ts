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
