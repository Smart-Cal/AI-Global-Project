import { create } from 'zustand';
import type { Todo } from '../types';
import * as api from '../services/api';

interface TodoState {
  todos: Todo[];
  currentUserId: string | null;
  isLoading: boolean;
  setCurrentUser: (userId: string | null) => void;
  fetchTodos: () => Promise<void>;
  addTodo: (todo: Omit<Todo, 'id' | 'created_at' | 'is_completed' | 'completed_at'>) => Promise<Todo>;
  updateTodo: (id: string, updates: Partial<Todo>) => Promise<void>;
  deleteTodo: (id: string) => Promise<void>;
  toggleComplete: (id: string) => Promise<void>;
  getTodosByGoal: (goalId: string) => Todo[];
  getTodayTodos: () => Todo[];
  getUpcomingTodos: (days?: number) => Todo[];
  getOverdueTodos: () => Todo[];
  getCompletedTodos: () => Todo[];
  getPendingTodos: () => Todo[];
  clearUserData: () => void;
}

// API Todo를 프론트엔드 Todo로 변환
function apiTodoToFrontendTodo(todo: api.Todo): Todo {
  return {
    id: todo.id,
    user_id: todo.user_id,
    goal_id: todo.event_id, // PALM에서는 event_id 사용
    title: todo.title,
    description: todo.description,
    due_date: todo.deadline ? todo.deadline.split('T')[0] : undefined,
    due_time: todo.deadline ? todo.deadline.split('T')[1]?.slice(0, 5) : undefined,
    priority: todo.priority,
    is_completed: todo.is_completed,
    completed_at: todo.completed_at,
    is_recurring: false,
    created_at: todo.created_at,
  };
}

// 프론트엔드 Todo를 API Todo로 변환
function frontendTodoToApiTodo(todo: Partial<Todo>): Partial<api.Todo> {
  let deadline: string | undefined;
  if (todo.due_date) {
    const time = todo.due_time || '23:59';
    deadline = `${todo.due_date}T${time}:00`;
  }

  return {
    user_id: todo.user_id,
    event_id: todo.goal_id,
    title: todo.title,
    description: todo.description,
    deadline,
    duration: 30,
    priority: todo.priority,
    timing: 'before',
  };
}

export const useTodoStore = create<TodoState>()((set, get) => ({
  todos: [],
  currentUserId: null,
  isLoading: false,

  setCurrentUser: (userId) => {
    const state = get();
    if (state.currentUserId !== userId) {
      set({ currentUserId: userId, todos: [] });
      if (userId) {
        get().fetchTodos();
      }
    }
  },

  fetchTodos: async () => {
    const userId = get().currentUserId;
    if (!userId) return;

    set({ isLoading: true });
    try {
      const response = await api.getTodos();
      const todos = response.todos.map(apiTodoToFrontendTodo);
      set({ todos });
    } catch (error) {
      console.error('Failed to fetch todos:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  addTodo: async (todoData) => {
    const userId = get().currentUserId;
    if (!userId) throw new Error('로그인이 필요합니다.');

    const apiTodo = frontendTodoToApiTodo({
      ...todoData,
      user_id: userId,
    });

    const response = await api.createTodo(apiTodo);
    const newTodo = apiTodoToFrontendTodo(response.todo);

    set((state) => ({
      todos: [newTodo, ...state.todos].sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        if (a.due_date && b.due_date) {
          return a.due_date.localeCompare(b.due_date);
        }
        return a.due_date ? -1 : 1;
      }),
    }));
    return newTodo;
  },

  updateTodo: async (id, updates) => {
    try {
      const apiUpdates = frontendTodoToApiTodo(updates);
      const response = await api.updateTodo(id, apiUpdates);
      const updated = apiTodoToFrontendTodo(response.todo);

      set((state) => ({
        todos: state.todos.map((todo) => (todo.id === id ? updated : todo)),
      }));
    } catch (error) {
      console.error('Failed to update todo:', error);
    }
  },

  deleteTodo: async (id) => {
    try {
      await api.deleteTodo(id);
      set((state) => ({
        todos: state.todos.filter((todo) => todo.id !== id),
      }));
    } catch (error) {
      console.error('Failed to delete todo:', error);
    }
  },

  toggleComplete: async (id) => {
    const todo = get().todos.find((t) => t.id === id);
    if (!todo) return;

    try {
      const response = await api.completeTodo(id, !todo.is_completed);
      const updated = apiTodoToFrontendTodo(response.todo);

      set((state) => ({
        todos: state.todos.map((t) => (t.id === id ? updated : t)),
      }));
    } catch (error) {
      console.error('Failed to toggle todo:', error);
    }
  },

  getTodosByGoal: (goalId) => {
    return get().todos.filter((todo) => todo.goal_id === goalId);
  },

  getTodayTodos: () => {
    const todayStr = new Date().toISOString().split('T')[0];
    return get().todos.filter(
      (todo) => todo.due_date === todayStr && !todo.is_completed
    );
  },

  getUpcomingTodos: (days = 7) => {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(now.getDate() + days);
    const nowStr = now.toISOString().split('T')[0];
    const futureStr = futureDate.toISOString().split('T')[0];

    return get().todos.filter(
      (todo) =>
        !todo.is_completed &&
        todo.due_date &&
        todo.due_date > nowStr &&
        todo.due_date <= futureStr
    );
  },

  getOverdueTodos: () => {
    const todayStr = new Date().toISOString().split('T')[0];
    return get().todos.filter(
      (todo) => !todo.is_completed && todo.due_date && todo.due_date < todayStr
    );
  },

  getCompletedTodos: () => {
    return get().todos.filter((todo) => todo.is_completed);
  },

  getPendingTodos: () => {
    return get().todos.filter((todo) => !todo.is_completed);
  },

  clearUserData: () => {
    set({ todos: [], currentUserId: null });
  },
}));
