import { useMutation, useQueryClient } from "@tanstack/react-query";
import { API, createMutation, createQuery, createSuspenseQuery } from "@/shared/api";
import { CartRes } from "../model/cart.types";

export const cartKeys = {
  all: ["cart"] as const,
  count: () => ["cart-count"] as const,
  get: () => ["cart-get"] as const,
  checkout: () => ["cart-checkout"] as const,
};

export const useGetCartCount = (enabled: boolean = true) => {
  return createQuery<number>(
    cartKeys.count(),
    "/cart/count",
    "data",
    undefined,
    { enabled }
  );
};

export const useAddToCart = () => {
  return createMutation<{
    message: string;
  }>("/cart/add", "post", [
    cartKeys.get() as unknown as string[],
    cartKeys.count() as unknown as string[],
    cartKeys.checkout() as unknown as string[],
  ]);
};

export const useGetCart = () => {
  return createSuspenseQuery<CartRes>(cartKeys.get(), "/cart", "data");
};

export const useGetCartCheckout = () => {
  return createQuery<CartRes>(cartKeys.checkout(), "/cart/checkout", "data");
};

export const useUpdateCartItemQuantity = () => {
  return createMutation<{ message: string }>("/cart/update", "patch", [
    cartKeys.get() as unknown as string[],
    cartKeys.count() as unknown as string[],
    cartKeys.checkout() as unknown as string[],
  ]);
};

export const useUpdateCartItemCustomizations = () =>
  createMutation<{ message: string }>("/cart/customize", "patch", [
    cartKeys.get() as unknown as string[],
    cartKeys.checkout() as unknown as string[],
  ]);

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
      client.invalidateQueries({ queryKey: cartKeys.get() });
      client.invalidateQueries({ queryKey: cartKeys.checkout() });
      client.invalidateQueries({ queryKey: cartKeys.count() });
    },
  });
};
