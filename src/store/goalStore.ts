import { create } from 'zustand';
import type { Goal } from '../types';
import { calculateGoalProgress } from '../types';
import * as api from '../services/api';

interface GoalState {
  goals: Goal[];
  currentUserId: string | null;
  isLoading: boolean;
  setCurrentUser: (userId: string | null) => void;
  fetchGoals: () => Promise<void>;
  addGoal: (goal: Omit<Goal, 'id' | 'created_at' | 'updated_at' | 'user_id' | 'status' | 'total_estimated_time' | 'completed_time'>) => Promise<Goal>;
  updateGoal: (id: string, updates: Partial<Goal>) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  getActiveGoals: () => Goal[];
  getGoalsByCategoryId: (categoryId: string) => Goal[];
  recalculateProgress: (id: string) => Promise<void>;
  clearUserData: () => void;
}

// Goal이 활성 상태인지 확인 (completed, failed가 아닌 경우)
function isGoalActive(goal: Goal): boolean {
  return !['completed', 'failed'].includes(goal.status);
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
    set({ isLoading: true });
    try {
      const response = await api.getGoals();
      set({ goals: response.goals });
    } catch (error) {
      console.error('Failed to fetch goals:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  addGoal: async (goalData) => {
    const response = await api.createGoal(goalData);
    const newGoal = response.goal;
    set((state) => ({ goals: [newGoal, ...state.goals] }));
    return newGoal;
  },

  updateGoal: async (id, updates) => {
    const response = await api.updateGoal(id, updates);
    const updated = response.goal;
    set((state) => ({
      goals: state.goals.map((goal) => (goal.id === id ? updated : goal)),
    }));
  },

  deleteGoal: async (id) => {
    await api.deleteGoal(id);
    set((state) => ({
      goals: state.goals.filter((goal) => goal.id !== id),
    }));
  },

  getActiveGoals: () => {
    return get().goals.filter(isGoalActive);
  },

  getGoalsByCategoryId: (categoryId) => {
    return get().goals.filter((goal) => goal.category_id === categoryId && isGoalActive(goal));
  },

  recalculateProgress: async (id) => {
    const response = await api.recalculateGoalProgress(id);
    const updated = response.goal;
    set((state) => ({
      goals: state.goals.map((goal) => (goal.id === id ? updated : goal)),
    }));
  },

  clearUserData: () => {
    set({ goals: [], currentUserId: null });
  },
}));

// 진행률 헬퍼 함수 re-export
export { calculateGoalProgress };
