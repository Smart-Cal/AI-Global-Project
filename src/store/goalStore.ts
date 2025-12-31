import { create } from 'zustand';
import type { Goal } from '../types';
import {
  createGoal as createGoalApi,
  updateGoal as updateGoalApi,
  deleteGoal as deleteGoalApi,
  getGoalsByUser,
} from '../services/supabase';

interface GoalState {
  goals: Goal[];
  currentUserId: string | null;
  isLoading: boolean;
  setCurrentUser: (userId: string | null) => void;
  fetchGoals: () => Promise<void>;
  addGoal: (goal: Omit<Goal, 'id' | 'created_at' | 'updated_at'>) => Promise<Goal>;
  updateGoal: (id: string, updates: Partial<Goal>) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  getActiveGoals: () => Goal[];
  getGoalsByCategoryId: (categoryId: string) => Goal[];
  updateProgress: (id: string, progress: number) => Promise<void>;
  clearUserData: () => void;
}

export const useGoalStore = create<GoalState>()((set, get) => ({
  goals: [],
  currentUserId: null,
  isLoading: false,

  setCurrentUser: (userId) => {
    const state = get();
    if (state.currentUserId !== userId) {
      set({ currentUserId: userId, goals: [] });
      if (userId) {
        get().fetchGoals();
      }
    }
  },

  fetchGoals: async () => {
    const userId = get().currentUserId;
    if (!userId) return;

    set({ isLoading: true });
    try {
      const goals = await getGoalsByUser(userId);
      set({ goals });
    } catch (error) {
      console.error('Failed to fetch goals:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  addGoal: async (goalData) => {
    const userId = get().currentUserId;
    if (!userId) throw new Error('로그인이 필요합니다.');

    const newGoal = await createGoalApi({ ...goalData, user_id: userId });
    if (newGoal) {
      set((state) => ({ goals: [newGoal, ...state.goals] }));
      return newGoal;
    }
    throw new Error('목표 생성에 실패했습니다.');
  },

  updateGoal: async (id, updates) => {
    const updated = await updateGoalApi(id, updates);
    if (updated) {
      set((state) => ({
        goals: state.goals.map((goal) => (goal.id === id ? updated : goal)),
      }));
    }
  },

  deleteGoal: async (id) => {
    const success = await deleteGoalApi(id);
    if (success) {
      set((state) => ({
        goals: state.goals.filter((goal) => goal.id !== id),
      }));
    }
  },

  getActiveGoals: () => {
    return get().goals.filter((goal) => goal.is_active);
  },

  getGoalsByCategoryId: (categoryId) => {
    return get().goals.filter((goal) => goal.category_id === categoryId && goal.is_active);
  },

  updateProgress: async (id, progress) => {
    const clampedProgress = Math.min(100, Math.max(0, progress));
    await get().updateGoal(id, { progress: clampedProgress });
  },

  clearUserData: () => {
    set({ goals: [], currentUserId: null });
  },
}));
