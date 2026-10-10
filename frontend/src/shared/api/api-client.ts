import axios from "axios";
import { BASE_URL } from "@/shared/config";

let getToken: (() => string | undefined | null) | null = null;
let handleUnauthorized: (() => void) | null = null;
let handleForbidden: (() => void) | null = null;

export const setAuthTokenGetter = (fn: () => string | undefined | null) => {
  getToken = fn;
};

export const setUnauthorizedHandler = (fn: () => void) => {
  handleUnauthorized = fn;
};

export const setForbiddenHandler = (fn: () => void) => {
  handleForbidden = fn;
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

  // Let Axios set the correct boundary for FormData uploads
  if (config.data instanceof FormData) {
    config.headers.setContentType("multipart/form-data");
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        handleUnauthorized?.();
      } else if (error.response?.status === 403) {
        handleForbidden?.();
      }
    }
    return Promise.reject(error);
  }
);

export const API = apiClient;
