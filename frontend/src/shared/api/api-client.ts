import axios from "axios";
import { BASE_URL } from "@/shared/config";
import { useUser } from "@/features/auth/model/auth.store";


export const apiClient = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
});

export const API = apiClient;

apiClient.interceptors.request.use(
  (config) => {
    const token = useUser.getState().token;
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);
