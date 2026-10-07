import { ORDER_PAGE_SIZE } from "../model/order.constants";
import { keepPreviousData, useMutation, useQueryClient } from "@tanstack/react-query";
import { API, createMutation, createQuery } from "@/shared/api";
import { cartKeys } from "@/features/cart";
import { Order, OrderRes, OrdersAdmin, OrderStatus } from "../model/order.types";

export const orderKeys = {
  all: ["order"] as const,
  list: (status?: OrderStatus, page?: number) => page === undefined ? ["order-all", status ?? "all"] as const : ["order-all", status ?? "all", page] as const,
  single: (id: number) => ["order-single", id] as const,
  adminAll: (status: OrderStatus, storeId?: number | null, page?: number) =>
    page === undefined ? ["order-adminAll", status, storeId] as const : ["order-adminAll", status, storeId, page] as const,
};

export const useCreateOrder = () => {
  return createMutation<
    { data: number; message: string },
    { addressId: number; paymentType: "cash"; couponCode?: string | null }
  >("/order", "post", [
    cartKeys.get() as unknown as string[],
    cartKeys.count() as unknown as string[],
    cartKeys.checkout() as unknown as string[],
  ]);
};

export const useGetOrders = (status?: OrderStatus, page = 1) => {
  return createQuery<Order[]>(orderKeys.list(status, page), "/order", "data", {
    status, page, limit: ORDER_PAGE_SIZE,
  }, { placeholderData: keepPreviousData });
};

export const useGetOrder = (orderId: number) => {
  return createQuery<OrderRes>(
    orderKeys.single(orderId),
    `/order/${orderId}`,
    "data"
  );
};

export const useGetAdminOrders = (status: OrderStatus, storeId?: number | null, page = 1) => {
  return createQuery<OrdersAdmin[]>(
    orderKeys.adminAll(status, storeId, page),
    "/order/admin/all",
    "data",
    {
      status, page, limit: ORDER_PAGE_SIZE,
      ...(storeId ? { storeId } : {}),
    },
    { placeholderData: keepPreviousData }
  );
};

export const useOrderUpdateStatus = () => {
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
        queryKey: orderKeys.single(res.data),
      });
      client.invalidateQueries({
        queryKey: ["order-adminAll"],
      });
    },
  });
};
