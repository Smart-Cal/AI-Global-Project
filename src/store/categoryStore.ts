import { create } from 'zustand';
import type { Category } from '../types';
import {
  createCategory as createCategoryApi,
  updateCategory as updateCategoryApi,
  deleteCategory as deleteCategoryApi,
  getCategoriesByUser,
  createDefaultCategory,
} from '../services/supabase';

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
    const userId = get().currentUserId;
    if (!userId) return;

    set({ isLoading: true });
    try {
      // 먼저 기본 카테고리가 있는지 확인하고 없으면 생성
      await createDefaultCategory(userId);

      const categories = await getCategoriesByUser(userId);
      set({ categories });
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  addCategory: async (name, color) => {
    const userId = get().currentUserId;
    if (!userId) throw new Error('로그인이 필요합니다.');

    const newCategory = await createCategoryApi({
      user_id: userId,
      name,
      color,
      is_default: false,
    });

    if (newCategory) {
      set((state) => ({
        categories: [...state.categories, newCategory].sort((a, b) => {
          if (a.is_default !== b.is_default) return a.is_default ? -1 : 1;
          return a.name.localeCompare(b.name);
        }),
      }));
      return newCategory;
    }
    throw new Error('카테고리 생성에 실패했습니다.');
  },

  updateCategory: async (id, updates) => {
    const updated = await updateCategoryApi(id, updates);
    if (updated) {
      set((state) => ({
        categories: state.categories.map((cat) => (cat.id === id ? updated : cat)),
      }));
    }
  },

  deleteCategory: async (id) => {
    const category = get().categories.find((c) => c.id === id);
    if (category?.is_default) {
      throw new Error('기본 카테고리는 삭제할 수 없습니다.');
    }

    const success = await deleteCategoryApi(id);
    if (success) {
      set((state) => ({
        categories: state.categories.filter((cat) => cat.id !== id),
      }));
    }
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
