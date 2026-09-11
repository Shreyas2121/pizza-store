import type { ExpenseStatus, RefundStatus } from "../../utils/types";
import { RealtimeRooms } from "./realtime-rooms";
import { getRealtimeServer } from "./realtime-server";
import {
  RealtimeEvents,
  type ExpenseStatusChangedPayload,
  type InventoryChangedPayload,
  type RefundStatusChangedPayload,
} from "./realtime.types";

type RefundRealtimeRecord = {
  id: number;
  orderId: number;
  storeId: number;
  requestedBy: number;
  status: RefundStatus;
  amountPaise: number;
  updatedAt: Date | string;
};

type ExpenseRealtimeRecord = {
  id: number;
  storeId: number;
  status: ExpenseStatus;
  version: number;
  updatedAt: Date | string;
};

const isoTimestamp = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

export const publishInventoryChanged = (
  payload: InventoryChangedPayload
): void => {
  getRealtimeServer()
    ?.to([
      RealtimeRooms.storeInventory(payload.storeId),
      RealtimeRooms.platformAdmin(),
    ])
    .emit(RealtimeEvents.inventoryChanged, payload);
};

export const publishRefundStatusChanged = (
  refund: RefundRealtimeRecord
): void => {
  const payload: RefundStatusChangedPayload = {
    refundId: refund.id,
    orderId: refund.orderId,
    storeId: refund.storeId,
    status: refund.status,
    amountPaise: refund.amountPaise,
    updatedAt: isoTimestamp(refund.updatedAt),
  };

  getRealtimeServer()
    ?.to([
      RealtimeRooms.storeFinance(refund.storeId),
      RealtimeRooms.user(refund.requestedBy),
      RealtimeRooms.platformAdmin(),
    ])
    .emit(RealtimeEvents.refundStatusChanged, payload);
};

export const publishExpenseStatusChanged = (
  expense: ExpenseRealtimeRecord,
  action: ExpenseStatusChangedPayload["action"]
): void => {
  const payload: ExpenseStatusChangedPayload = {
    expenseId: expense.id,
    storeId: expense.storeId,
    action,
    status: expense.status,
    version: expense.version,
    updatedAt: isoTimestamp(expense.updatedAt),
  };

  getRealtimeServer()
    ?.to([
      RealtimeRooms.storeFinance(expense.storeId),
      RealtimeRooms.platformAdmin(),
    ])
    .emit(RealtimeEvents.expenseStatusChanged, payload);
};
