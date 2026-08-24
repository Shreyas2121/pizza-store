import axios from "axios";
import { error } from "./notifications";

export interface InsufficientStockItem {
  productId: number;
  productName: string;
  requestedQuantity: number;
  availableQuantity: number;
}

export interface ApiErrorPayload {
  code?: string;
  message?: string;
  data?: {
    items?: InsufficientStockItem[];
    [key: string]: unknown;
  };
}

export const formatStockErrorMessage = (items: InsufficientStockItem[]): string => {
  if (!items || items.length === 0) {
    return "Some items in your order are out of stock. Please review your cart.";
  }

  const details = items
    .map((item) => {
      if (item.availableQuantity <= 0) {
        return `${item.productName} is out of stock`;
      }
      return `${item.productName}: only ${item.availableQuantity} available (requested ${item.requestedQuantity})`;
    })
    .join("; ");

  return `Insufficient stock: ${details}.`;
};

export const handleStockApiError = (
  cause: unknown,
  fallbackMessage = "This product could not be updated. Please review your cart."
): { isStockError: boolean; message: string; items: InsufficientStockItem[] } => {
  if (axios.isAxiosError<ApiErrorPayload>(cause)) {
    const errorData = cause.response?.data;
    if (errorData?.code === "INSUFFICIENT_STOCK") {
      const items = errorData.data?.items ?? [];
      const formatted = formatStockErrorMessage(items);
      error(formatted, "Stock limit exceeded");
      return { isStockError: true, message: formatted, items };
    }
    const message = errorData?.message ?? fallbackMessage;
    error(message);
    return { isStockError: false, message, items: [] };
  }

  const message = cause instanceof Error ? cause.message : fallbackMessage;
  error(message);
  return { isStockError: false, message, items: [] };
};
