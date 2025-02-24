import axios from "axios";
import { BASE_URL } from "./constants";
import { useUser } from "../store/user";

export const API = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
});

API.interceptors.request.use(
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
