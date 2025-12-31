import { create } from 'zustand';
import type { Category } from '../types';
import * as api from '../services/api';

interface CategoryState {
  categories: Category[];
  currentUserId: string | null;
  isLoading: boolean;
  setCurrentUser: (userId: string | null) => void;
  fetchCategories: () => Promise<void>;
  addCategory: (name: string, color: string) => Promise<Category>;
  updateCategory: (id: string, updates: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  getCategoryById: (id: string) => Category | undefined;
  getCategoryByName: (name: string) => Category | undefined;
  getDefaultCategory: () => Category | undefined;
  clearUserData: () => void;
}

export const useCategoryStore = create<CategoryState>()((set, get) => ({
  categories: [],
  currentUserId: null,
  isLoading: false,

  setCurrentUser: (userId) => {
    const state = get();
    if (state.currentUserId !== userId) {
      set({ currentUserId: userId, categories: [] });
      if (userId) {
        get().fetchCategories();
      }
    }
  },

  fetchCategories: async () => {
    set({ isLoading: true });
    try {
      // 백엔드 API를 통해 카테고리 조회 (기본 카테고리도 자동 생성됨)
      const response = await api.getCategories();
      const categories = response.categories.sort((a, b) => {
        if (a.is_default !== b.is_default) return a.is_default ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      set({ categories });
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  addCategory: async (name, color) => {
    const response = await api.createCategory(name, color);
    const newCategory = response.category;

    set((state) => ({
      categories: [...state.categories, newCategory].sort((a, b) => {
        if (a.is_default !== b.is_default) return a.is_default ? -1 : 1;
        return a.name.localeCompare(b.name);
      }),
    }));
    return newCategory;
  },

  updateCategory: async (id, updates) => {
    const response = await api.updateCategory(id, updates);
    const updated = response.category;
    set((state) => ({
      categories: state.categories.map((cat) => (cat.id === id ? updated : cat)),
    }));
  },

  deleteCategory: async (id) => {
    const category = get().categories.find((c) => c.id === id);
    if (category?.is_default) {
      throw new Error('기본 카테고리는 삭제할 수 없습니다.');
    }

    await api.deleteCategory(id);
    set((state) => ({
      categories: state.categories.filter((cat) => cat.id !== id),
    }));
  },

  getCategoryById: (id) => {
    return get().categories.find((cat) => cat.id === id);
  },

  getCategoryByName: (name) => {
    return get().categories.find(
      (cat) => cat.name.toLowerCase() === name.toLowerCase()
    );
  },

  getDefaultCategory: () => {
    return get().categories.find((cat) => cat.is_default);
  },

  clearUserData: () => {
    set({ categories: [], currentUserId: null });
  },
}));
