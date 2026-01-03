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

// API Todo는 이제 DB 스키마와 동일하므로 직접 사용
function apiTodoToFrontendTodo(todo: api.Todo): Todo {
  return {
    id: todo.id,
    user_id: todo.user_id,
    goal_id: todo.goal_id,
    title: todo.title,
    description: todo.description,
    deadline: todo.deadline,
    is_hard_deadline: todo.is_hard_deadline,
    estimated_time: todo.estimated_time,
    completed_time: todo.completed_time,
    is_divisible: todo.is_divisible,
    priority: todo.priority,
    is_completed: todo.is_completed,
    completed_at: todo.completed_at,
    is_recurring: todo.is_recurring,
    recurrence_pattern: todo.recurrence_pattern,
    created_at: todo.created_at,
  };
}

// 프론트엔드 Todo를 API Todo로 변환
function frontendTodoToApiTodo(todo: Partial<Todo>): Partial<api.Todo> {
  return {
    goal_id: todo.goal_id,
    title: todo.title,
    description: todo.description,
    deadline: todo.deadline,
    is_hard_deadline: todo.is_hard_deadline ?? false,
    estimated_time: todo.estimated_time ?? 60,
    is_divisible: todo.is_divisible ?? true,
    priority: todo.priority,
    is_recurring: todo.is_recurring,
    recurrence_pattern: todo.recurrence_pattern,
  };
}

// deadline에서 날짜 부분만 추출
function getDeadlineDate(deadline?: string): string | undefined {
  if (!deadline) return undefined;
  return deadline.split('T')[0];
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
    });

    const response = await api.createTodo(apiTodo);
    const newTodo = apiTodoToFrontendTodo(response.todo);

    set((state) => ({
      todos: [newTodo, ...state.todos].sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        const aDate = getDeadlineDate(a.deadline);
        const bDate = getDeadlineDate(b.deadline);
        if (aDate && bDate) {
          return aDate.localeCompare(bDate);
        }
        return aDate ? -1 : 1;
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
      (todo) => getDeadlineDate(todo.deadline) === todayStr && !todo.is_completed
    );
  },

  getUpcomingTodos: (days = 7) => {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(now.getDate() + days);
    const nowStr = now.toISOString().split('T')[0];
    const futureStr = futureDate.toISOString().split('T')[0];

    return get().todos.filter((todo) => {
      const deadlineDate = getDeadlineDate(todo.deadline);
      return (
        !todo.is_completed &&
        deadlineDate &&
        deadlineDate > nowStr &&
        deadlineDate <= futureStr
      );
    });
  },

  getOverdueTodos: () => {
    const todayStr = new Date().toISOString().split('T')[0];
    return get().todos.filter((todo) => {
      const deadlineDate = getDeadlineDate(todo.deadline);
      return !todo.is_completed && deadlineDate && deadlineDate < todayStr;
    });
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
