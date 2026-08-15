
import { Address, QUERY_KEYS, User } from "@/lib";
import { createMutation, createQuery } from "./useApi";

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

const useGetUser = () => {
  return createQuery<User>([QUERY_KEYS.user.get], "/user", "data");
};

export const USER_API_HOOKS = {
  useLogin,
  useRegister,
  useGetAddresses,
  useCreateAddress,
  useGetUser,
};
