import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { QUERY_KEYS } from "../lib/constants";
import { API } from "../lib/axios";
import { Cart, CartRes } from "../lib/types";

const keys = QUERY_KEYS.cart;

export const useGetCartCount = () => {
  return useQuery({
    queryKey: [keys.cartCount],
    queryFn: async () => {
      const { data } = await API.get("/cart/count");
      return data.data as number;
    },
  });
};

export const useAddToCart = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (cartData: any) => {
      const { data } = await API.post("/cart/add", cartData);
      return data as {
        message: string;
      };
    },
    onSuccess: () => {
      client.invalidateQueries({
        queryKey: [keys.cartCount],
      });
    },
  });
};

export const useGetCart = () => {
  return useSuspenseQuery({
    queryKey: [keys.getCart],
    queryFn: async () => {
      const { data } = await API.get("/cart");
      return data.data as CartRes;
    },
  });
};

export const useGetCartCheckout = () => {
  return useQuery({
    queryKey: [keys.cartCheckout],
    queryFn: async () => {
      const { data } = await API.get("/cart/checkout");
      return data.data as Cart;
    },
  });
};

export const useUpdateCartItemQuantity = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (cartItemData: any) => {
      const { data } = await API.patch(`/cart/update`, cartItemData);
      return data as {
        message: string;
      };
    },
    onSuccess: () => {
      client.invalidateQueries({
        queryKey: [keys.getCart],
      });
      client.invalidateQueries({
        queryKey: [keys.cartCheckout],
      });
    },
  });
};

export const useRemoveCartItem = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (cartItemId: number) => {
      const { data } = await API.delete(`/cart/${cartItemId}`);
      return data as {
        message: string;
      };
    },
    onSuccess: () => {
      client.invalidateQueries({
        queryKey: [keys.getCart],
      });
      client.invalidateQueries({
        queryKey: [keys.cartCheckout],
      });
      client.invalidateQueries({
        queryKey: [keys.cartCount],
      });
    },
  });
};
