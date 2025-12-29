import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types';
import { loginUser, registerUser } from '../services/supabase';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  login: (phone: string, password: string) => Promise<void>;
  register: (phone: string, password: string, name: string, nickname: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isLoading: false,

      login: async (phone, password) => {
        set({ isLoading: true });
        try {
          const normalized = phone.replace(/[^0-9]/g, '');
          const user = await loginUser(normalized, password);
          if (user) set({ user });
        } finally {
          set({ isLoading: false });
        }
      },

      register: async (phone, password, name, nickname) => {
        set({ isLoading: true });
        try {
          const normalized = phone.replace(/[^0-9]/g, '');
          const user = await registerUser(normalized, password, name, nickname);
          if (user) set({ user });
        } finally {
          set({ isLoading: false });
        }
      },

      logout: () => set({ user: null }),

      checkAuth: () => {
        // With persist middleware, user is automatically loaded from localStorage
        // This function just triggers a re-render check
        set((state) => ({ isLoading: false, user: state.user }));
      },
    }),
    { name: 'ai-calendar-auth' }
  )
);
