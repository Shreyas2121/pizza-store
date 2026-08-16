
import { Address, API, QUERY_KEYS, User } from "@/lib";
import { createMutation, createQuery } from "./useApi";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const useLogin = () => {
  return createMutation<{
    token: string;
    user: User;
  }>("/user/login", "post", [], "data");
};

const useRegister = () => {
  return createMutation<{
    token: string;
    user: User;
  }>("/user/register", "post", [], "data");
};

const useGetAddresses = () => {
  return createQuery<Address[]>(
    [QUERY_KEYS.user.addressAll],
    "/user/address",
    "data"
  );
};

const useCreateAddress = () => {
  return createMutation<{
    message: string;
    address: Address;
  }>("/user/address", "post", [[QUERY_KEYS.user.addressAll]], "data");
};

type AddressPayload = Pick<Address, "type" | "street" | "city" | "state" | "pincode" | "phone">;

const useUpdateAddress = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: AddressPayload }) => (await API.patch(`/user/address/${id}`, data)).data.data as { message: string; address: Address },
    onSuccess: () => client.invalidateQueries({ queryKey: [QUERY_KEYS.user.addressAll] }),
  });
};

const useDeleteAddress = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => (await API.delete(`/user/address/${id}`)).data.data as { message: string; id: number },
    onSuccess: () => client.invalidateQueries({ queryKey: [QUERY_KEYS.user.addressAll] }),
  });
};

const useGetUser = () => {
  return createQuery<User>([QUERY_KEYS.user.get], "/user", "data");
};

export const USER_API_HOOKS = {
  useLogin,
  useRegister,
  useGetAddresses,
  useCreateAddress,
  useUpdateAddress,
  useDeleteAddress,
  useGetUser,
};
