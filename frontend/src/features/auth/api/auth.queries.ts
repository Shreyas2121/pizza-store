import { createMutation, createQuery } from "@/shared/api";
import { User } from "../model/auth.types";
import { useUser } from "../model/auth.store";

export const authKeys = {
  all: ["user"] as const,
  getUser: (userId?: number | null) => ["get", ...(userId === undefined ? [] : [userId])] as const,
};

export const useLogin = () => {
  return createMutation<{
    token: string;
    user: User;
  }>("/user/login", "post", [], "data");
};

export const useRegister = () => {
  return createMutation<{
    token: string;
    user: User;
  }>("/user/register", "post", [], "data");
};

export const useGetUser = () => {
  const { user, isLoggedIn } = useUser();
  return createQuery<User>(authKeys.getUser(user?.id ?? null), "/user", "data", undefined, { enabled: isLoggedIn && user?.id !== undefined });
};
