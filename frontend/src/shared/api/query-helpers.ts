/* eslint-disable react-hooks/rules-of-hooks */
import { API } from "./api-client";
import {
  QueryKey,
  useMutation,
  useQuery,
  useQueryClient,
  UseQueryOptions,
  useSuspenseQuery,
  UseSuspenseQueryOptions,
} from "@tanstack/react-query";

export function createQuery<T>(
  key: QueryKey,
  url: string,
  dataKey?: string | number,
  params?: object,
  options?: Omit<UseQueryOptions<T>, "queryKey" | "queryFn">
) {
  return useQuery({
    queryKey: key,
    queryFn: async ({ signal }) => {
      const { data } = await API.get(url, { params, signal });
      const res = dataKey !== undefined ? data[dataKey] : (data as T);
      return res ?? null;
    },
    ...options,
  });
}

export function createSuspenseQuery<T>(
  key: QueryKey,
  url: string,
  dataKey?: string | number,
  params?: object,
  options?: Omit<UseSuspenseQueryOptions<T>, "queryKey" | "queryFn">
) {
  return useSuspenseQuery({
    queryKey: key,
    queryFn: async ({ signal }) => {
      const { data } = await API.get(url, { params, signal });
      const res = dataKey !== undefined ? data[dataKey] : (data as T);
      return res ?? null;
    },
    ...options,
  });
}

export function createMutation<TData = unknown, TVariables = unknown>(
  url: string,
  method: "put" | "patch" | "delete" | "post",
  invalidateQueries?: string[][],
  dataKey?: string | number
) {
  const client = useQueryClient();

  return useMutation<TData, Error, TVariables>({
    mutationFn: async (payload: TVariables) => {
      const { data } =
        method === "delete"
          ? await API.delete(url, { data: payload })
          : await API[method](url, payload as Record<string, unknown>);
      return dataKey !== undefined ? (data[dataKey] as TData) : (data as TData);
    },
    onSuccess: () => {
      if (invalidateQueries?.length) {
        invalidateQueries.forEach((query) => {
          client.invalidateQueries({
            queryKey: [...query],
          });
        });
      }
    },
  });
}

export const useCustomQuery = createQuery;
export const useCustomSuspenseQuery = createSuspenseQuery;
export const useCustomMutation = createMutation;
