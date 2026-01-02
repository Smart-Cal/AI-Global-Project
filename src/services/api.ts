/**
 * PALM API Client
 * Backend API와 통신하는 서비스 레이어
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// 토큰 관리
let authToken: string | null = localStorage.getItem('palm_token');

export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) {
    localStorage.setItem('palm_token', token);
  } else {
    localStorage.removeItem('palm_token');
  }
}

export function getAuthToken(): string | null {
  return authToken;
}

// API 요청 헬퍼
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (authToken) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

// ==============================================
// Auth API (구글 로그인 전용)
// ==============================================

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string;
    nickname?: string;
    avatar_url?: string;
    created_at?: string;
  };
  token: string;
}

export interface SupabaseConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export async function logout(): Promise<void> {
  try {
    await apiRequest('/auth/logout', { method: 'POST' });
  } catch {
    // 로그아웃은 항상 성공으로 처리
  }
  setAuthToken(null);
}

// 구글 OAuth
export async function getSupabaseConfig(): Promise<SupabaseConfig> {
  return apiRequest<SupabaseConfig>('/auth/supabase-config');
}

export async function loginWithGoogle(accessToken: string): Promise<AuthResponse> {
  const response = await apiRequest<AuthResponse>('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ access_token: accessToken }),
  });
  setAuthToken(response.token);
  return response;
}

// ==============================================
// Chat API
// ==============================================

export interface PendingEvent {
  title: string;
  datetime: string;
  duration: number;
  location?: string;
  description?: string;
  type: 'fixed' | 'personal' | 'goal';
  category?: string; // AI가 추천한 카테고리 이름
}

export interface ChatResponse {
  conversation_id: string;
  message_id: string;
  message: string;
  pending_events?: PendingEvent[];
  todos?: any[];
  scheduled_items?: any[];
  needs_user_input?: boolean;
  suggestions?: string[];
}

export interface Conversation {
  id: string;
  user_id: string;
  title?: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  pending_events?: PendingEvent[];
  created_at: string;
}

export async function sendChatMessage(
  message: string,
  conversationId?: string
): Promise<ChatResponse> {
  return apiRequest<ChatResponse>('/chat', {
    method: 'POST',
    body: JSON.stringify({ message, conversation_id: conversationId }),
  });
}

export async function confirmEvents(events: PendingEvent[]): Promise<{ message: string; events: Event[] }> {
  return apiRequest('/chat/confirm-events', {
    method: 'POST',
    body: JSON.stringify({ events }),
  });
}

export async function saveResultMessage(
  conversationId: string,
  content: string
): Promise<{ message_id: string }> {
  return apiRequest('/chat/save-result', {
    method: 'POST',
    body: JSON.stringify({ conversation_id: conversationId, content }),
  });
}

export async function getConversations(): Promise<{ conversations: Conversation[] }> {
  return apiRequest<{ conversations: Conversation[] }>('/chat/conversations');
}

export async function getConversation(id: string): Promise<{ conversation: Conversation; messages: Message[] }> {
  return apiRequest<{ conversation: Conversation; messages: Message[] }>(`/chat/conversations/${id}`);
}

export async function createConversation(title?: string): Promise<{ conversation: Conversation }> {
  return apiRequest<{ conversation: Conversation }>('/chat/conversations', {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
}

export async function deleteConversation(id: string): Promise<void> {
  await apiRequest(`/chat/conversations/${id}`, { method: 'DELETE' });
}

// ==============================================
// Events API
// ==============================================

export interface Event {
  id: string;
  user_id: string;
  category_id?: string;
  title: string;
  description?: string;
  datetime: string;
  duration: number;
  type: 'fixed' | 'personal' | 'goal';
  location?: string;
  is_completed: boolean;
  completed_at?: string;
  created_at?: string;
}

export async function getEvents(
  startDate?: string,
  endDate?: string
): Promise<{ events: Event[] }> {
  let url = '/events';
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  if (params.toString()) url += `?${params.toString()}`;

  return apiRequest<{ events: Event[] }>(url);
}

export async function createEvent(event: Partial<Event>): Promise<{ event: Event }> {
  return apiRequest<{ event: Event }>('/events', {
    method: 'POST',
    body: JSON.stringify(event),
  });
}

export async function updateEvent(
  id: string,
  updates: Partial<Event>
): Promise<{ event: Event }> {
  return apiRequest<{ event: Event }>(`/events/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

export async function deleteEvent(id: string): Promise<void> {
  await apiRequest(`/events/${id}`, { method: 'DELETE' });
}

export async function completeEvent(
  id: string,
  isCompleted: boolean = true
): Promise<{ event: Event }> {
  return apiRequest<{ event: Event }>(`/events/${id}/complete`, {
    method: 'PATCH',
    body: JSON.stringify({ is_completed: isCompleted }),
  });
}

// ==============================================
// Todos API
// ==============================================

export interface Todo {
  id: string;
  user_id: string;
  event_id?: string;
  title: string;
  description?: string;
  timing: 'before' | 'during' | 'after';
  deadline?: string;
  scheduled_at?: string;
  duration: number;
  priority: 'high' | 'medium' | 'low';
  is_completed: boolean;
  completed_at?: string;
  created_at?: string;
}

export async function getTodos(): Promise<{ todos: Todo[] }> {
  return apiRequest<{ todos: Todo[] }>('/todos');
}

export async function createTodo(todo: Partial<Todo>): Promise<{ todo: Todo }> {
  return apiRequest<{ todo: Todo }>('/todos', {
    method: 'POST',
    body: JSON.stringify(todo),
  });
}

export async function updateTodo(
  id: string,
  updates: Partial<Todo>
): Promise<{ todo: Todo }> {
  return apiRequest<{ todo: Todo }>(`/todos/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

export async function deleteTodo(id: string): Promise<void> {
  await apiRequest(`/todos/${id}`, { method: 'DELETE' });
}

export async function completeTodo(
  id: string,
  isCompleted: boolean = true
): Promise<{ todo: Todo }> {
  return apiRequest<{ todo: Todo }>(`/todos/${id}/complete`, {
    method: 'PATCH',
    body: JSON.stringify({ is_completed: isCompleted }),
  });
}

// ==============================================
// Schedule API
// ==============================================

export interface ScheduleOptimizeResponse {
  message: string;
  scheduled_items: {
    title: string;
    scheduled_at: string;
    duration: number;
    reason: string;
    todo_id?: string;
  }[];
  conflicts: string[];
  suggestions: string[];
}

export async function optimizeSchedule(
  todoIds?: string[],
  preferences?: {
    work_hours_start?: number;
    work_hours_end?: number;
    preferred_focus_time?: 'morning' | 'afternoon' | 'evening';
  },
  autoApply: boolean = false
): Promise<ScheduleOptimizeResponse> {
  return apiRequest<ScheduleOptimizeResponse>('/schedule/optimize', {
    method: 'POST',
    body: JSON.stringify({
      todo_ids: todoIds,
      preferences,
      auto_apply: autoApply,
    }),
  });
}

export async function getAvailableSlots(
  days: number = 7,
  workStart: number = 9,
  workEnd: number = 18
): Promise<{
  slots: {
    date: string;
    slots: { start: string; end: string; duration: number }[];
  }[];
}> {
  const params = new URLSearchParams({
    days: days.toString(),
    work_start: workStart.toString(),
    work_end: workEnd.toString(),
  });

  return apiRequest(`/schedule/available-slots?${params.toString()}`);
}

export async function applySchedule(
  scheduledItems: { todo_id: string; scheduled_at: string }[]
): Promise<{ message: string; updated: Todo[] }> {
  return apiRequest('/schedule/apply', {
    method: 'POST',
    body: JSON.stringify({ scheduled_items: scheduledItems }),
  });
}

// ==============================================
// Categories API
// ==============================================

export interface Category {
  id: string;
  user_id: string;
  name: string;
  color: string;
  is_default: boolean;
  created_at?: string;
}

export async function getCategories(): Promise<{ categories: Category[] }> {
  return apiRequest<{ categories: Category[] }>('/categories');
}

export async function createCategory(
  name: string,
  color: string
): Promise<{ category: Category }> {
  return apiRequest<{ category: Category }>('/categories', {
    method: 'POST',
    body: JSON.stringify({ name, color }),
  });
}

export async function updateCategory(
  id: string,
  updates: Partial<Category>
): Promise<{ category: Category }> {
  return apiRequest<{ category: Category }>(`/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

export async function deleteCategory(id: string): Promise<void> {
  await apiRequest(`/categories/${id}`, { method: 'DELETE' });
}

// ==============================================
// Goals API
// ==============================================

export interface Goal {
  id: string;
  user_id: string;
  category_id?: string;
  title: string;
  description?: string;
  target_date?: string;
  priority: 'high' | 'medium' | 'low';
  progress: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export async function getGoals(): Promise<{ goals: Goal[] }> {
  return apiRequest<{ goals: Goal[] }>('/goals');
}

export async function createGoal(
  goal: Omit<Goal, 'id' | 'user_id' | 'created_at' | 'updated_at'>
): Promise<{ goal: Goal }> {
  return apiRequest<{ goal: Goal }>('/goals', {
    method: 'POST',
    body: JSON.stringify(goal),
  });
}

export async function updateGoal(
  id: string,
  updates: Partial<Goal>
): Promise<{ goal: Goal }> {
  return apiRequest<{ goal: Goal }>(`/goals/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

export async function updateGoalProgress(
  id: string,
  progress: number
): Promise<{ goal: Goal }> {
  return apiRequest<{ goal: Goal }>(`/goals/${id}/progress`, {
    method: 'PATCH',
    body: JSON.stringify({ progress }),
  });
}

export async function deleteGoal(id: string): Promise<void> {
  await apiRequest(`/goals/${id}`, { method: 'DELETE' });
}
