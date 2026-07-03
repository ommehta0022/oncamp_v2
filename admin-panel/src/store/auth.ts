import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useEffect } from "react";

interface AdminUser {
  id: string;
  email: string;
  role: "super_admin" | "moderator" | "admin";
  name?: string;
  createdAt: string;
}

interface AuthState {
  user: AdminUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: AdminUser | null) => void;
  setIsLoading: (loading: boolean) => void;
  logout: () => void;
  initialize: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      setUser: (user) =>
        set({
          user,
          isAuthenticated: !!user,
          isLoading: false,
        }),
      setIsLoading: (loading) => set({ isLoading: loading }),
      logout: () =>
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        }),
      initialize: () => {
        // Called on mount to set loading to false if no user
        set((state) => ({
          isLoading: false,
          isAuthenticated: !!state.user,
        }));
      },
    }),
    {
      name: "admin-auth-storage",
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        // After rehydrating from storage, set loading to false
        if (state) {
          state.isLoading = false;
        }
      },
    }
  )
);
