import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createMutation, createQuery } from "./useApi";
import { API, Order, OrderRes, OrdersAdmin, OrderStatus, QUERY_KEYS } from "@/lib";

const useCreateOrder = () => {
  return createMutation<{
    data: number;
    message: string;
  }>("/order", "post", [
    [QUERY_KEYS.cart.getCart],
    [QUERY_KEYS.cart.cartCount],
    [QUERY_KEYS.cart.cartCheckout],
  ]);
};

const useGetOrders = (status: OrderStatus) => {
  return createQuery<Order[]>([QUERY_KEYS.order.all], "/order", "data", {
    status,
  });
};

const useGetOrder = (orderId: number) => {
  return createQuery<OrderRes>(
    [QUERY_KEYS.order.single, orderId],
    `/order/${orderId}`,
    "data"
  );
};

const useGetAdminOrders = (status: OrderStatus) => {
  return createQuery<OrdersAdmin[]>(
    [QUERY_KEYS.order.adminAll, status],
    "/order/admin/all",
    "data",
    { status }
  );
};

const useOrderUpdateStatus = () => {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async (orderData: { orderId: number; status: OrderStatus }) => {
      const data = await API.patch(`/order/${orderData.orderId}`, {
        status: orderData.status,
      });
      return data.data as {
        message: string;
        data: number;
      };
    },
    onSuccess: (res) => {
      client.invalidateQueries({
        queryKey: [QUERY_KEYS.order.single, res.data],
      });
    },
  });
};

export const ORDER_API_HOOKS = {
  useCreateOrder,
  useGetOrders,
  useGetOrder,
  useGetAdminOrders,
  useOrderUpdateStatus,
};
