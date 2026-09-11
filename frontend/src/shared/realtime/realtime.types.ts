import type { Socket } from "socket.io-client";

export const RealtimeEvents = {
  orderPlaced: "orderPlaced",
  orderStatusChanged: "orderStatusChanged",
  lowStock: "lowStock",
  inventoryChanged: "inventoryChanged",
  refundStatusChanged: "refundStatusChanged",
  expenseStatusChanged: "expenseStatusChanged",
  chatRequest: "chatRequest",
  chatStatusChange: "chatStatusChange",
  newMessage: "newMessage",
  membershipChanged: "membershipChanged",
} as const;

export type RealtimeOrderStatus =
  | "awaiting_payment"
  | "pending"
  | "preparing"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export interface OrderPlacedPayload {
  orderId: number;
  storeId?: number;
  status: RealtimeOrderStatus;
  total: number;
}

export interface OrderStatusChangedPayload {
  orderId: number;
  storeId: number;
  previousStatus: RealtimeOrderStatus;
  status: RealtimeOrderStatus;
  updatedAt: string;
}

export interface LowStockPayload {
  storeId: number;
  storeName?: string;
  storeProductId: number;
  productId: number;
  productName: string;
  currentQuantity: number;
  threshold: number;
  severity: "low_stock" | "out_of_stock";
}

export interface InventoryChangedPayload {
  storeId: number;
  storeProductId: number;
  productId: number;
  productName: string;
  action: "restock" | "adjust";
  previousQuantity: number;
  newQuantity: number;
  quantityChange: number;
  severity?: "low_stock" | "out_of_stock";
}

export interface RefundStatusChangedPayload {
  refundId: number;
  orderId: number;
  storeId: number;
  status:
    | "requested"
    | "approved"
    | "rejected"
    | "cancelled"
    | "submitted"
    | "processing"
    | "processed"
    | "failed";
  amountPaise: number;
  updatedAt: string;
}

export interface ExpenseStatusChangedPayload {
  expenseId: number;
  storeId: number;
  action: "submit" | "approve" | "reject" | "pay" | "post" | "void" | "reverse";
  status:
    | "draft"
    | "submitted"
    | "approved"
    | "paid"
    | "posted"
    | "rejected"
    | "voided"
    | "reversed";
  version: number;
  updatedAt: string;
}

export interface ChatMessagePayload {
  id: number;
  timestamp: string;
  type: "admin" | "user";
  message: string;
}

export interface ChatSessionPayload {
  id: number;
  userId: number;
  subject: string | null;
  status: "open" | "close" | "rejected" | "pending";
  createdAt: string;
  updatedAt: string;
}

export interface MembershipChangedPayload {
  storeId: number;
  message: string;
}

export interface ServerToClientEvents {
  [RealtimeEvents.orderPlaced]: (payload: OrderPlacedPayload) => void;
  [RealtimeEvents.orderStatusChanged]: (
    payload: OrderStatusChangedPayload
  ) => void;
  [RealtimeEvents.lowStock]: (payload: LowStockPayload) => void;
  [RealtimeEvents.inventoryChanged]: (payload: InventoryChangedPayload) => void;
  [RealtimeEvents.refundStatusChanged]: (
    payload: RefundStatusChangedPayload
  ) => void;
  [RealtimeEvents.expenseStatusChanged]: (
    payload: ExpenseStatusChangedPayload
  ) => void;
  [RealtimeEvents.chatRequest]: (payload: ChatSessionPayload) => void;
  [RealtimeEvents.chatStatusChange]: (payload: ChatSessionPayload) => void;
  [RealtimeEvents.newMessage]: (payload: ChatMessagePayload) => void;
  [RealtimeEvents.membershipChanged]: (
    payload: MembershipChangedPayload
  ) => void;
}

export type ClientToServerEvents = Record<string, never>;

export type RealtimeSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
