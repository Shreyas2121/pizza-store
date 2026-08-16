import { createMutation, createQuery } from "@/shared/api";
import { User } from "../model/auth.types";

export const authKeys = {
  all: ["user"] as const,
  getUser: () => ["get"] as const,
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
  return createQuery<User>(authKeys.getUser(), "/user", "data");
};
