import axios from "axios";
import { useAuthStore } from "@/stores/authStore";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !(value instanceof Date) &&
    !Array.isArray(value)
  );
}

function toCamelCase(value: string): string {
  return value.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
}

function camelizeObject<T>(obj: T): T {
  if (Array.isArray(obj)) {
    return obj.map((item) => camelizeObject(item)) as unknown as T;
  }

  if (isPlainObject(obj)) {
    return Object.entries(obj).reduce((acc, [key, val]) => {
      const camelKey = toCamelCase(key);
      acc[camelKey] = camelizeObject(val);
      return acc;
    }, {} as Record<string, unknown>) as T;
  }

  return obj;
}

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1",
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (res) => {
    if (res?.data && (Array.isArray(res.data) || isPlainObject(res.data))) {
      res.data = camelizeObject(res.data);
    }
    return res;
  },
  (err) => {
    if (err.response?.status === 401) useAuthStore.getState().clearAuth();
    return Promise.reject(err);
  }
);
