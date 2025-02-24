import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "../lib/constants";
import { API } from "../lib/axios";
import { MenuItem } from "../lib/types";

export const useGetMenuItems = () => {
  return useQuery({
    queryKey: [QUERY_KEYS.menu.all],
    queryFn: async () => {
      const { data } = await API.get("/menu");
      return data.data as MenuItem[];
    },
  });
};
