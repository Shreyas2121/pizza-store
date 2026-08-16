import { useLogin, useRegister, useGetUser } from "@/features/auth";
import {
  useGetAddresses,
  useCreateAddress,
  useUpdateAddress,
  useDeleteAddress,
} from "@/features/account";

export const USER_API_HOOKS = {
  useLogin,
  useRegister,
  useGetAddresses,
  useCreateAddress,
  useUpdateAddress,
  useDeleteAddress,
  useGetUser,
};
