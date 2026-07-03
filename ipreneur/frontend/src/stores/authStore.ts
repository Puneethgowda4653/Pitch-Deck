import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import type { User } from "@/types";
import { apiClient } from "@/services/api/client";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  setUser: (user: User) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isLoading: false,

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const { data } = await apiClient.post("/auth/login", { email, password });
          set({
            user: data.data.user,
            accessToken: data.data.accessToken,
          });
        } finally {
          set({ isLoading: false });
        }
      },

      register: async (name, email, password) => {
        set({ isLoading: true });
        try {
          const { data } = await apiClient.post("/auth/register", {
            name,
            email,
            password,
          });
          set({
            user: data.data.user,
            accessToken: data.data.accessToken,
          });
        } finally {
          set({ isLoading: false });
        }
      },

      logout: async () => {
        try {
          await apiClient.post("/auth/logout");
        } catch {
          // Ignore logout errors — clear local state regardless
        }
        get().clearAuth();
      },

      refreshSession: async () => {
        try {
          const { data } = await apiClient.post("/auth/refresh");
          set({ accessToken: data.data.accessToken });
        } catch {
          get().clearAuth();
        }
      },

      setUser: (user) => set({ user }),

      clearAuth: () => set({ user: null, accessToken: null }),
    }),
    {
      name: "ipreneur_auth",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
      }),
    }
  )
);

// ── Selectors ─────────────────────────────────────────────────────────────────
export const useIsAuthenticated = () =>
  useAuthStore((s) => !!s.user && !!s.accessToken);
export const useCurrentUser = () => useAuthStore((s) => s.user);
