import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { API } from "../lib/axios";
import { Address, User } from "../lib/types";
import { QUERY_KEYS } from "../lib/constants";

export const useLogin = () => {
  return useMutation({
    mutationFn: async (credentials: any) => {
      const { data } = await API.post("/user/login", credentials);
      return data.data as {
        token: string;
        user: User;
      };
    },
  });
};

export const useRegister = () => {
  return useMutation({
    mutationFn: async (credentials: any) => {
      const { data } = await API.post("/user/register", credentials);
      return data.data as {
        user: User;
        token: string;
      };
    },
  });
};

export const useGetAddresses = () => {
  return useQuery({
    queryKey: [QUERY_KEYS.user.addressAll],
    queryFn: async () => {
      const { data } = await API.get("/user/address");
      return data.data as Address[];
    },
  });
};

export const useCreateAddress = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (addressData: any) => {
      const { data } = await API.post("/user/address", addressData);
      return data.data as {
        message: string;
        address: Address;
      };
    },
    onSuccess: () => {
      client.invalidateQueries({
        queryKey: [QUERY_KEYS.user.addressAll],
      });
    },
  });
};

export const useGetUser = () => {
  return useQuery({
    queryKey: [QUERY_KEYS.user.get],
    queryFn: async () => {
      const { data } = await API.get("/user");
      return data.data as User;
    },
  });
};
