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
    console.log('[CategoryStore] fetchCategories called');
    set({ isLoading: true });
    try {
      // Fetch categories via backend API (Default category is also auto-created)
      const response = await api.getCategories();
      console.log('[CategoryStore] API response:', response);

      // Remove duplicates by id
      const uniqueCategories = response.categories.filter((cat, index, self) =>
        index === self.findIndex(c => c.id === cat.id)
      );

      const categories = uniqueCategories.sort((a, b) => {
        if (a.is_default !== b.is_default) return a.is_default ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      console.log('[CategoryStore] Sorted categories:', categories);
      set({ categories });
    } catch (error) {
      console.error('[CategoryStore] Failed to fetch categories:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  addCategory: async (name, color) => {
    console.log('[CategoryStore] addCategory called with:', { name, color });
    const response = await api.createCategory(name, color);
    const newCategory = response.category;
    console.log('[CategoryStore] addCategory response:', newCategory);

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
      throw new Error('Default category cannot be deleted.');
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
