export { OrderAddress } from "./components/order-address";
export { OrderCoupon } from "./components/order-coupon";
export { OrderItems } from "./components/order-items";
export { OrderStatus, getOrderStatusMeta } from "./components/order-status";
export { CustomerOrdersPage } from "./pages/customer-orders-page";

export { CustomerOrderDetailsPage } from "./pages/customer-order-details-page";
export { AdminOrdersPage } from "./pages/admin-orders-page";
export { AdminOrderDetailsPage } from "./pages/admin-order-details-page";

export { customerOrderColumns } from "./components/customer/customer-order-columns";
export { adminOrderColumns } from "./components/admin/admin-order-columns";

export {
  orderKeys,
  useCreateOrder,
  useGetOrders,
  useGetOrder,
  useGetAdminOrders,
  useOrderUpdateStatus,
} from "./api/order.queries";

export type {
  Order,
  OrderItem,
  OrderItemRes,
  OrderRes,
  OrdersAdmin,
  OrderStatus as OrderStatusType,
} from "./model/order.types";

export { orderStatus } from "./model/order.types";
