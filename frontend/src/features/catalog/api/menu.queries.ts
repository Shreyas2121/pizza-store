import { createMutation, createQuery } from "@/shared/api";
import { MenuItem } from "../model/catalog.types";
import { catalogKeys } from "../model/catalog.keys";

export const useGetMenuItems = () => {
  return createQuery<MenuItem[]>(catalogKeys.menu.all(), "/menu", "data");
};

export const useCreateMenuItem = () =>
  createMutation<{ data: MenuItem }>("/menu", "post", [
    catalogKeys.menu.all() as unknown as string[],
  ]);

export const useCreateMenuMapping = () =>
  createMutation<{ message: string }>("/menu/mapping", "post", [
    catalogKeys.menu.all() as unknown as string[],
  ]);
