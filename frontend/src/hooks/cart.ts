import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createMutation, createQuery, createSuspenseQuery } from "./useApi";
import { API, Cart, CartRes, QUERY_KEYS } from "@/lib";

const keys = QUERY_KEYS.cart;

const useGetCartCount = (enabled: boolean = true) => {
  return createQuery<number>(
    [keys.cartCount],
    "/cart/count",
    "data",
    undefined,
    { enabled }
  );
};

const useAddToCart = () => {
  return createMutation<{
    message: string;
  }>("/cart/add", "post", [[keys.cartCount]]);
};

const useGetCart = () => {
  return createSuspenseQuery<CartRes>([keys.getCart], "/cart", "data");
};

const useGetCartCheckout = () => {
  return createQuery<Cart>([keys.cartCheckout], "/cart/checkout", "data");
};

const useUpdateCartItemQuantity = () => {
  return createMutation<{ message: string }>("/cart/update", "patch", [
    [keys.getCart],
    [keys.cartCheckout],
  ]);
};

const useRemoveCartItem = () => {
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

export const CART_API_HOOKS = {
  useGetCartCount,
  useAddToCart,
  useGetCart,
  useGetCartCheckout,
  useUpdateCartItemQuantity,
  useRemoveCartItem,
};
