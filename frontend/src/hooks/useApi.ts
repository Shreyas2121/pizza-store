import { API } from "@/lib";
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
  dataKey?: any,
  params?: object,
  options?: Omit<UseQueryOptions<T>, "queryKey" | "queryFn">
) {
  return useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data } = await API.get(url, { params });
      const res = dataKey ? data[dataKey] : (data as T);
      return res ?? null;
    },
    ...options,
  });
}

export function createSuspenseQuery<T>(
  key: QueryKey,
  url: string,
  dataKey?: any,
  params?: object,
  options?: Omit<UseSuspenseQueryOptions<T>, "queryKey" | "queryFn">
) {
  return useSuspenseQuery({
    queryKey: key,
    queryFn: async () => {
      const { data } = await API.get(url, { params });
      const res = dataKey ? data[dataKey] : (data as T);
      return res ?? null;
    },
    ...options,
  });
}

export function createMutation<T>(
  url: string,
  method: "put" | "patch" | "delete" | "post",
  invalidateQueries?: string[][],
  dataKey?: any
) {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await API[method](url, payload);
      return dataKey ? (data[dataKey] as T) : (data as T);
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

// React Hook compliant aliases
export const useCustomQuery = createQuery;
export const useCustomSuspenseQuery = createSuspenseQuery;
export const useCustomMutation = createMutation;
