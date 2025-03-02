import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { API } from "../lib/axios";
import { QUERY_KEYS } from "../lib/constants";
import { Order, OrderRes, OrdersAdmin, OrderStatus } from "../lib/types";

export const useCreateOrder = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (order: any) => {
      const { data } = await API.post("/order", order);
      return data as {
        data: number;
        message: string;
      };
    },
    onSuccess: () => {
      client.invalidateQueries({
        queryKey: [
          QUERY_KEYS.cart.getCart,
          QUERY_KEYS.cart.cartCount,
          QUERY_KEYS.cart.cartCheckout,
        ],
      });
    },
  });
};

export const useGetOrders = (status: OrderStatus) => {
  return useQuery({
    queryKey: [QUERY_KEYS.order.all],
    queryFn: async () => {
      const { data } = await API.get("/order", {
        params: {
          status,
        },
      });
      return data.data as Order[];
    },
  });
};

export const useGetOrder = (orderId: number) => {
  return useQuery({
    queryKey: [QUERY_KEYS.order.single, orderId],
    queryFn: async () => {
      const { data } = await API.get(`/order/${orderId}`);
      return data.data as OrderRes;
    },
  });
};

export const useGetAdminOrders = (status: OrderStatus) => {
  return useQuery({
    queryKey: [QUERY_KEYS.order.adminAll, status],
    queryFn: async () => {
      const { data } = await API.get(`/order/admin/all`, {
        params: {
          status,
        },
      });
      return data.data as OrdersAdmin[];
    },
  });
};

export const useOrderUpdateStatus = () => {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async (orderData: any) => {
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
