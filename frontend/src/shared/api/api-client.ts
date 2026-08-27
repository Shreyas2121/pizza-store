import axios from "axios";
import { BASE_URL } from "@/shared/config";

let getToken: (() => string | undefined | null) | null = null;
let handleUnauthorized: (() => void) | null = null;

export const setAuthTokenGetter = (fn: () => string | undefined | null) => {
  getToken = fn;
};

export const setUnauthorizedHandler = (fn: () => void) => {
  handleUnauthorized = fn;
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

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      handleUnauthorized?.();
    }
    return Promise.reject(error);
  }
);

export const API = apiClient;
