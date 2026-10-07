import { ORDER_PAGE_SIZE } from "../model/order.constants";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/features/auth";
import { API, createMutation, createQuery } from "@/shared/api";
import { cartKeys } from "@/features/cart";
import { Order, OrderRes, OrdersAdmin, OrderStatus } from "../model/order.types";

export const orderKeys = {
  all: ["order"] as const,
  list: (status?: OrderStatus, page?: number, userId?: number | null) =>
    ["order-all", status ?? "all", ...(userId === undefined ? [] : [userId]), ...(page === undefined ? [] : [page])] as const,
  single: (id: number, userId?: number | null) => ["order-single", id, ...(userId === undefined ? [] : [userId])] as const,
  adminAll: (status: OrderStatus, storeId?: number | null, page?: number, userId?: number | null) =>
    ["order-adminAll", status, storeId, ...(userId === undefined ? [] : [userId]), ...(page === undefined ? [] : [page])] as const,
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
  const { user, isLoggedIn } = useUser();
  return createQuery<Order[]>(orderKeys.list(status, page, user?.id ?? null), "/order", "data", {
    status, page, limit: ORDER_PAGE_SIZE,
  }, { enabled: isLoggedIn && user?.id !== undefined });
};

export const useGetOrder = (orderId: number) => {
  const { user, isLoggedIn } = useUser();
  return createQuery<OrderRes>(
    orderKeys.single(orderId, user?.id ?? null),
    `/order/${orderId}`,
    "data",
    undefined,
    { enabled: isLoggedIn && user?.id !== undefined && Number.isSafeInteger(orderId) && orderId > 0 }
  );
};

export const useGetAdminOrders = (status: OrderStatus, storeId?: number | null, page = 1) => {
  const { user, isLoggedIn } = useUser();
  return createQuery<OrdersAdmin[]>(
    orderKeys.adminAll(status, storeId, page, user?.id ?? null),
    "/order/admin/all",
    "data",
    {
      status, page, limit: ORDER_PAGE_SIZE,
      ...(storeId ? { storeId } : {}),
    },
    { enabled: isLoggedIn && user?.id !== undefined }
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
