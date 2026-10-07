import { useQuery } from "@tanstack/react-query";
import { API } from "@/shared/api";
import { useUser } from "@/features/auth";
import type { UserAccessResponse } from "../model/access.types";
import { accessKeys } from "../model/access.keys";
export { accessKeys } from "../model/access.keys";

export const useAccessMe = () => {
  const { user, token, isLoggedIn } = useUser();
  return useQuery({
    queryKey: accessKeys.principal(user?.id),
    queryFn: async ({ signal }) => {
      const res = await API.get<{ data: UserAccessResponse }>("/access/me", {
        signal,
      });
      return res.data.data;
    },
    enabled: isLoggedIn && !!token && user !== null,
    staleTime: 1000 * 60,
  });
};
