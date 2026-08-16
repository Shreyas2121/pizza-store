import axios from "axios";
import { BASE_URL } from "@/shared/config";

let getToken: (() => string | undefined | null) | null = null;

export const setAuthTokenGetter = (fn: () => string | undefined | null) => {
  getToken = fn;
};

export const apiClient = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  const token = getToken ? getToken() : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const API = apiClient;
