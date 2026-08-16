import { API, createMutation, createQuery } from "@/shared/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Address } from "../model/account.types";

export const addressKeys = {
  all: ["addressAll"] as const,
  lists: () => ["addressAll"] as const,
};

export const useGetAddresses = () => {
  return createQuery<Address[]>(
    addressKeys.lists(),
    "/user/address",
    "data"
  );
};

export const useCreateAddress = () => {
  return createMutation<{
    message: string;
    address: Address;
  }>("/user/address", "post", [addressKeys.all as unknown as string[]], "data");
};

export type AddressPayload = Pick<Address, "type" | "street" | "city" | "state" | "pincode" | "phone">;

export const useUpdateAddress = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: AddressPayload }) =>
      (await API.patch(`/user/address/${id}`, data)).data.data as { message: string; address: Address },
    onSuccess: () => client.invalidateQueries({ queryKey: addressKeys.all }),
  });
};

export const useDeleteAddress = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) =>
      (await API.delete(`/user/address/${id}`)).data.data as { message: string; id: number },
    onSuccess: () => client.invalidateQueries({ queryKey: addressKeys.all }),
  });
};
