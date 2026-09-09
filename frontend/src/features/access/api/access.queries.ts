import { useQuery } from "@tanstack/react-query";
import { API } from "@/shared/api";
import { useUser } from "@/features/auth";
import type { UserAccessResponse } from "../model/access.types";

export const accessKeys = {
  all: ["access"] as const,
  me: () => ["access", "me"] as const,
};

export const useAccessMe = () => {
  const { token, isLoggedIn } = useUser();
  return useQuery({
    queryKey: accessKeys.me(),
    queryFn: async () => {
      const res = await API.get<{ data: UserAccessResponse }>("/access/me");
      return res.data.data;
    },
    enabled: isLoggedIn && !!token,
    staleTime: 1000 * 60,
  });
};
