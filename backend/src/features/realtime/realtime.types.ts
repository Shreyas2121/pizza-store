import type { Server, Socket } from "socket.io";
import type { AuthPrincipal } from "../auth/auth.types";
import type { LowStockAlert } from "../inventory/inventory.logic";
import type {
  ChatStatus,
  ExpenseStatus,
  OrderStatus,
  RefundStatus,
} from "../../utils/types";

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

export interface OrderPlacedPayload {
  orderId: number;
  storeId?: number;
  status: OrderStatus;
  total: number;
}

export interface OrderStatusChangedPayload {
  orderId: number;
  storeId: number;
  previousStatus: OrderStatus;
  status: OrderStatus;
  updatedAt: string;
}

export interface ChatSessionPayload {
  id: number;
  userId: number;
  subject: string | null;
  status: ChatStatus;
  createdAt: string;
  updatedAt: string;
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
  status: RefundStatus;
  amountPaise: number;
  updatedAt: string;
}

export interface ExpenseStatusChangedPayload {
  expenseId: number;
  storeId: number;
  action: "submit" | "approve" | "reject" | "pay" | "post" | "void" | "reverse";
  status: ExpenseStatus;
  version: number;
  updatedAt: string;
}

export interface ChatMessagePayload {
  id: number;
  timestamp: string;
  type: "admin" | "user";
  message: string;
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
  [RealtimeEvents.lowStock]: (payload: LowStockAlert) => void;
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

export type InterServerEvents = Record<string, never>;

export interface RealtimeSocketData {
  principal: AuthPrincipal;
}

export type RealtimeServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  RealtimeSocketData
>;

export type RealtimeSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  RealtimeSocketData
>;
