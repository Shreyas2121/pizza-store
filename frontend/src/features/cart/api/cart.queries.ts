import { useMutation, useQueryClient } from "@tanstack/react-query";
import { API, createMutation, createQuery, createSuspenseQuery } from "@/shared/api";
import { CartRes } from "../model/cart.types";
import { useUser } from "@/features/auth";

export const cartKeys = {
  all: ["cart"] as const,
  count: (userId?: number | null) => ["cart-count", ...(userId === undefined ? [] : [userId])] as const,
  get: (userId?: number | null) => ["cart-get", ...(userId === undefined ? [] : [userId])] as const,
  checkout: (userId?: number | null) => ["cart-checkout", ...(userId === undefined ? [] : [userId])] as const,
};

export const useGetCartCount = (enabled: boolean = true) => {
  const { user, isLoggedIn } = useUser();
  return createQuery<number>(
    cartKeys.count(user?.id ?? null),
    "/cart/count",
    "data",
    undefined,
    { enabled: enabled && isLoggedIn && user?.id !== undefined }
  );
};

export const useAddToCart = () => {
  return createMutation<{
    message: string;
    data: { cartCleared: boolean; storeId: number };
  }>("/cart/add", "post", [
    cartKeys.get() as unknown as string[],
    cartKeys.count() as unknown as string[],
    cartKeys.checkout() as unknown as string[],
  ]);
};

export const useGetCart = () => {
  const { user } = useUser();
  return createSuspenseQuery<CartRes>(cartKeys.get(user?.id ?? null), "/cart", "data");
};

export const useGetCartOptional = (enabled: boolean = true) => {
  const { user, isLoggedIn } = useUser();
  return createQuery<CartRes | null>(cartKeys.get(user?.id ?? null), "/cart", "data", undefined, { enabled: enabled && isLoggedIn && user?.id !== undefined });
};

export const useGetCartCheckout = () => {
  const { user, isLoggedIn } = useUser();
  return createQuery<CartRes>(cartKeys.checkout(user?.id ?? null), "/cart/checkout", "data", undefined, { enabled: isLoggedIn && user?.id !== undefined });
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

export const useClearCart = () => {
  const client = useQueryClient();
  const { user } = useUser();
  return useMutation({
    mutationFn: async (itemIds: number[]) => {
      for (const itemId of itemIds) await API.delete(`/cart/${itemId}`);
    },
    onSuccess: () => {
      client.setQueryData(cartKeys.get(user?.id ?? null), null);
      client.invalidateQueries({ queryKey: cartKeys.get() });
      client.invalidateQueries({ queryKey: cartKeys.checkout() });
      client.invalidateQueries({ queryKey: cartKeys.count() });
    },
  });
};
