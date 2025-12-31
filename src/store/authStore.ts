import { create } from 'zustand';
import type { User } from '../types';
import * as api from '../services/api';
import { useGoalStore } from './goalStore';
import { useTodoStore } from './todoStore';
import { useCategoryStore } from './categoryStore';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  login: (phone: string, password: string) => Promise<void>;
  register: (phone: string, password: string, name: string, nickname?: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User | null) => void;
  initFromToken: () => void;
}

// 다른 스토어에 사용자 ID 동기화
const syncUserToStores = (userId: string | null) => {
  useGoalStore.getState().setCurrentUser(userId);
  useTodoStore.getState().setCurrentUser(userId);
  useCategoryStore.getState().setCurrentUser(userId);
};

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isLoading: false,

  login: async (phone, password) => {
    set({ isLoading: true });
    try {
      const response = await api.login(phone, password);
      const user: User = {
        id: response.user.id,
        phone: response.user.phone,
        name: response.user.name,
        nickname: response.user.nickname || response.user.name,
        is_active: true,
        created_at: response.user.created_at,
      };
      set({ user });
      syncUserToStores(user.id);
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
    set({ isLoading: false });
  },

  register: async (phone, password, name, nickname) => {
    set({ isLoading: true });
    try {
      const response = await api.register(phone, password, name, nickname);
      const user: User = {
        id: response.user.id,
        phone: response.user.phone,
        name: response.user.name,
        nickname: response.user.nickname || response.user.name,
        is_active: true,
        created_at: response.user.created_at,
      };
      set({ user });
      syncUserToStores(user.id);
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
    set({ isLoading: false });
  },

  logout: () => {
    api.logout();
    set({ user: null });
    syncUserToStores(null);
  },

  setUser: (user) => {
    set({ user });
    if (user) {
      syncUserToStores(user.id);
    }
  },

  initFromToken: () => {
    const token = api.getAuthToken();
    if (token) {
      const savedUser = localStorage.getItem('palm_user');
      if (savedUser) {
        try {
          const user = JSON.parse(savedUser);
          set({ user });
          syncUserToStores(user.id);
        } catch {
          api.setAuthToken(null);
        }
      }
    }
  },
}));

// 사용자 정보 로컬 스토리지 동기화
useAuthStore.subscribe((state) => {
  if (state.user) {
    localStorage.setItem('palm_user', JSON.stringify(state.user));
  } else {
    localStorage.removeItem('palm_user');
  }
});
