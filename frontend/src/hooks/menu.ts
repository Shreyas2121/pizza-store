
import { MenuItem, QUERY_KEYS } from "@/lib";
import { createQuery } from "./useApi";

const useGetMenuItems = () => {
  return createQuery<MenuItem[]>([QUERY_KEYS.menu.all], "/menu", "data");
};

export const MENU_API_HOOKS = {
  useGetMenuItems,
};
