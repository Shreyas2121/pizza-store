
import { MenuItem, QUERY_KEYS } from "@/lib";
import { createMutation, createQuery } from "./useApi";

const useGetMenuItems = () => {
  return createQuery<MenuItem[]>([QUERY_KEYS.menu.all], "/menu", "data");
};

const useCreateMenuItem = () =>
  createMutation<{ data: MenuItem }>("/menu", "post", [
    [QUERY_KEYS.menu.all],
  ]);

const useCreateMenuMapping = () =>
  createMutation<{ message: string }>("/menu/mapping", "post", [
    [QUERY_KEYS.menu.all],
  ]);

export const MENU_API_HOOKS = {
  useGetMenuItems,
  useCreateMenuItem,
  useCreateMenuMapping,
};
