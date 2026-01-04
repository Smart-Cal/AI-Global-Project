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

export interface PendingTodo {
  title: string;
  duration: number;
  order: number;
  priority?: 'high' | 'medium' | 'low';
  deadline?: string;
  description?: string;
  category?: string; // AI가 추천한 카테고리 이름
}

export interface PendingGoal {
  title: string;
  description?: string;
  target_date?: string;
  priority?: 'high' | 'medium' | 'low';
  category?: string;
  decomposed_todos?: PendingTodo[];
}

// MCP 데이터 타입 ("행동하는 AI" 기능)
export interface MCPPlaceResult {
  id: string;
  name: string;
  address: string;
  rating?: number;
  reviewCount?: number;
  priceLevel?: string;
  distance?: string;
  duration?: string;
  photos?: string[];
  openNow?: boolean;
  types?: string[];
}

export interface MCPProductResult {
  id: string;
  title: string;
  price: number;
  originalPrice?: number;
  currency: string;
  rating?: number;
  reviewCount?: number;
  seller?: string;
  imageUrl?: string;
  productUrl?: string;
  isPrime?: boolean;
}

export interface MCPGroupScheduleResult {
  groupId: string;
  groupName: string;
  members: string[];
  availableSlots: {
    date: string;
    startTime: string;
    endTime: string;
    allAvailable: boolean;
    unavailableMembers?: string[];
  }[];
  recommendedSlot?: {
    date: string;
    time: string;
    reason: string;
  };
}

export interface MCPResponseData {
  places?: MCPPlaceResult[];
  restaurants?: MCPPlaceResult[];
  products?: MCPProductResult[];
  gifts?: MCPProductResult[];
  group_schedule?: MCPGroupScheduleResult;
  availableSlots?: {
    date: string;
    startTime: string;
    endTime: string;
    allAvailable: boolean;
    unavailableMembers?: string[];
  }[];
  actions_taken?: {
    action: string;
    success: boolean;
    result?: any;
    error?: string;
  }[];
}

export interface ChatResponse {
  conversation_id: string;
  message_id: string;
  message: string;
  pending_events?: PendingEvent[];
  pending_todos?: PendingTodo[];
  pending_goals?: PendingGoal[];
  scheduled_items?: any[];
  needs_user_input?: boolean;
  suggestions?: string[];
  // MCP 데이터 ("행동하는 AI" 기능)
  mcp_data?: MCPResponseData;
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
  pending_todos?: PendingTodo[];
  pending_goals?: PendingGoal[];
  created_at: string;
}

export type ChatMode = 'auto' | 'event' | 'todo' | 'goal' | 'briefing';

export async function sendChatMessage(
  message: string,
  conversationId?: string,
  mode: ChatMode = 'auto'
): Promise<ChatResponse> {
  return apiRequest<ChatResponse>('/chat', {
    method: 'POST',
    body: JSON.stringify({ message, conversation_id: conversationId, mode }),
  });
}

export async function confirmEvents(events: PendingEvent[]): Promise<{ message: string; events: Event[] }> {
  return apiRequest('/chat/confirm-events', {
    method: 'POST',
    body: JSON.stringify({ events }),
  });
}

export async function confirmTodos(todos: PendingTodo[]): Promise<{ message: string; todos: Todo[] }> {
  return apiRequest('/chat/confirm-todos', {
    method: 'POST',
    body: JSON.stringify({ todos }),
  });
}

export async function confirmGoals(goals: PendingGoal[]): Promise<{ message: string; goals: Goal[] }> {
  return apiRequest('/chat/confirm-goals', {
    method: 'POST',
    body: JSON.stringify({ goals }),
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

// DB 스키마와 일치하는 Event 인터페이스
export interface Event {
  id: string;
  user_id: string;
  category_id?: string;
  related_todo_id?: string;
  title: string;
  description?: string;
  event_date: string;           // 시작일 (YYYY-MM-DD)
  end_date?: string;            // 종료일 (기간 일정용, YYYY-MM-DD)
  start_time?: string;          // HH:MM
  end_time?: string;            // HH:MM
  is_all_day: boolean;
  location?: string;
  is_fixed: boolean;            // true: 고정, false: 유동
  priority: number;             // 1-5
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

// DB 스키마와 일치하는 Todo 인터페이스
export interface Todo {
  id: string;
  user_id: string;
  goal_id?: string;               // 연결된 Goal
  title: string;
  description?: string;
  deadline?: string;              // 마감 시각 (ISO datetime)
  is_hard_deadline: boolean;      // true면 절대 밀릴 수 없음
  estimated_time?: number;        // 예상 시간 (분)
  completed_time: number;         // 완료된 시간 (분)
  is_divisible: boolean;          // 분할 가능 여부
  priority: 'high' | 'medium' | 'low';
  is_completed: boolean;
  completed_at?: string;
  is_recurring?: boolean;
  recurrence_pattern?: string;
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

export type GoalStatus = 'planning' | 'scheduled' | 'in_progress' | 'completed' | 'failed';

// DB 스키마와 일치하는 Goal 인터페이스
export interface Goal {
  id: string;
  user_id: string;
  category_id?: string;
  title: string;
  description?: string;
  target_date: string;            // 마감일 (필수, YYYY-MM-DD)
  priority: 'high' | 'medium' | 'low';
  status: GoalStatus;             // 목표 상태
  total_estimated_time: number;   // 총 예상 시간 (분)
  completed_time: number;         // 완료된 시간 (분)
  created_at?: string;
  updated_at?: string;
}

// 진행률 계산 헬퍼
export function calculateGoalProgress(goal: Goal): number {
  if (goal.total_estimated_time === 0) return 0;
  return Math.round((goal.completed_time / goal.total_estimated_time) * 100);
}

export async function getGoals(): Promise<{ goals: Goal[] }> {
  return apiRequest<{ goals: Goal[] }>('/goals');
}

export async function createGoal(
  goal: Omit<Goal, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'status' | 'total_estimated_time' | 'completed_time'>
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

export async function updateGoalStatus(
  id: string,
  status: GoalStatus
): Promise<{ goal: Goal }> {
  return apiRequest<{ goal: Goal }>(`/goals/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function recalculateGoalProgress(
  id: string
): Promise<{ goal: Goal; progress: number }> {
  return apiRequest<{ goal: Goal; progress: number }>(`/goals/${id}/recalculate`, {
    method: 'POST',
  });
}

export async function deleteGoal(id: string): Promise<void> {
  await apiRequest(`/goals/${id}`, { method: 'DELETE' });
}

// ==============================================
// Briefing API
// ==============================================

export interface WeatherInfo {
  temperature: number;
  condition: string;
  icon: string;
  recommendation: string;
  city?: string;
}

export interface MorningBriefing {
  weather?: WeatherInfo;
  today_events: Event[];
  incomplete_todos: Todo[];
  message: string;
}

export interface EveningBriefing {
  completed_events: Event[];
  completed_todos: Todo[];
  completion_rate: number;
  tomorrow_first_event?: Event;
  tomorrow_weather?: WeatherInfo;
  message: string;
}

export interface WeeklyBriefing {
  week_range: { start: string; end: string };
  statistics: {
    total_events: number;
    completed_events: number;
    completed_todos: number;
    completed_goals: number;
    active_goals: number;
    completion_rate: number;
  };
  next_week: {
    range: { start: string; end: string };
    event_count: number;
    events: Event[];
  };
  message: string;
}

export async function getMorningBriefing(coords?: { lat: number; lon: number }): Promise<MorningBriefing> {
  const params = coords ? `?lat=${coords.lat}&lon=${coords.lon}` : '';
  return apiRequest<MorningBriefing>(`/briefing/morning${params}`);
}

export async function getEveningBriefing(coords?: { lat: number; lon: number }): Promise<EveningBriefing> {
  const params = coords ? `?lat=${coords.lat}&lon=${coords.lon}` : '';
  return apiRequest<EveningBriefing>(`/briefing/evening${params}`);
}

export async function getWeeklyBriefing(): Promise<WeeklyBriefing> {
  return apiRequest<WeeklyBriefing>('/briefing/weekly');
}

export async function getCurrentWeather(city?: string): Promise<WeatherInfo & { city: string; activity_recommendations: string[] }> {
  const params = city ? `?city=${encodeURIComponent(city)}` : '';
  return apiRequest(`/briefing/weather${params}`);
}

export async function getWeatherByCoords(lat: number, lon: number): Promise<WeatherInfo & { city: string; activity_recommendations: string[] }> {
  return apiRequest(`/briefing/weather/coords?lat=${lat}&lon=${lon}`);
}

export async function reverseGeocode(lat: number, lon: number): Promise<{ city: string; lat: number; lon: number }> {
  return apiRequest(`/briefing/geocode/reverse?lat=${lat}&lon=${lon}`);
}

// ==============================================
// Groups API (그룹 일정)
// ==============================================

export interface Group {
  id: string;
  name: string;
  invite_code: string;  // 디스코드 스타일 초대 코드
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface GroupMember {
  user_id: string;
  group_id: string;
  role: 'owner' | 'member';
  joined_at: string;
  user_name?: string;
  user_email?: string;
}

export interface GroupInvitation {
  id: string;
  group_id: string;
  group_name?: string;
  inviter_id: string;
  inviter_name?: string;
  invitee_email: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  created_at: string;
  responded_at?: string;
}

export interface AvailableSlot {
  date: string;
  start_time: string;
  end_time: string;
  type: 'available' | 'negotiable';
  available_members?: string[];
  conflicting_members?: string[];
}

export interface MeetingRecommendation {
  group: {
    id: string;
    name: string;
    member_count: number;
  };
  available_times: {
    best: {
      date: string;
      time: string;
      type: string;
      reason: string;
    }[];
    alternatives: {
      date: string;
      time: string;
      type: string;
      conflicting_members?: string[];
      reason: string;
    }[];
  };
  place_recommendations?: {
    restaurants?: MCPPlaceResult[];
  };
  suggested_plan?: {
    date: string;
    time: string;
    place: MCPPlaceResult;
    message: string;
  };
}

// 그룹 CRUD
export async function getGroups(): Promise<{ groups: Group[] }> {
  return apiRequest<{ groups: Group[] }>('/groups');
}

export async function getGroup(id: string): Promise<{ group: Group; members: GroupMember[]; is_owner: boolean }> {
  return apiRequest(`/groups/${id}`);
}

export async function createGroup(name: string): Promise<{ group: Group }> {
  return apiRequest<{ group: Group }>('/groups', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export async function updateGroup(id: string, name: string): Promise<{ group: Group }> {
  return apiRequest<{ group: Group }>(`/groups/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name }),
  });
}

export async function deleteGroup(id: string): Promise<void> {
  await apiRequest(`/groups/${id}`, { method: 'DELETE' });
}

// 그룹 멤버
export async function getGroupMembers(groupId: string): Promise<{ members: GroupMember[] }> {
  return apiRequest(`/groups/${groupId}/members`);
}

export async function removeGroupMember(groupId: string, memberId: string): Promise<void> {
  await apiRequest(`/groups/${groupId}/members/${memberId}`, { method: 'DELETE' });
}

export async function leaveGroup(groupId: string): Promise<void> {
  await apiRequest(`/groups/${groupId}/leave`, { method: 'POST' });
}

// 초대 코드 (디스코드 스타일)
export async function joinGroupByCode(inviteCode: string): Promise<{ message: string; group: Group }> {
  return apiRequest('/groups/join', {
    method: 'POST',
    body: JSON.stringify({ invite_code: inviteCode }),
  });
}

export async function getGroupByCode(inviteCode: string): Promise<{ group: { id: string; name: string; member_count: number } }> {
  return apiRequest(`/groups/code/${inviteCode}`);
}

export async function regenerateInviteCode(groupId: string): Promise<{ message: string; invite_code: string }> {
  return apiRequest(`/groups/${groupId}/regenerate-code`, { method: 'POST' });
}

// 그룹 초대 (이메일 - 레거시)
export async function getPendingInvitations(): Promise<{ invitations: GroupInvitation[] }> {
  return apiRequest('/groups/invitations/pending');
}

export async function getGroupInvitations(groupId: string): Promise<{ invitations: GroupInvitation[] }> {
  return apiRequest(`/groups/${groupId}/invitations`);
}

export async function inviteToGroup(groupId: string, email: string): Promise<{ invitation: GroupInvitation }> {
  return apiRequest(`/groups/${groupId}/invitations`, {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function respondToInvitation(invitationId: string, accept: boolean): Promise<{ invitation: GroupInvitation; message: string }> {
  return apiRequest(`/groups/invitations/${invitationId}/respond`, {
    method: 'POST',
    body: JSON.stringify({ accept }),
  });
}

export async function cancelInvitation(groupId: string, invitationId: string): Promise<void> {
  await apiRequest(`/groups/${groupId}/invitations/${invitationId}`, { method: 'DELETE' });
}

// 그룹 일정 매칭
export async function getGroupAvailableSlots(
  groupId: string,
  options?: {
    start_date?: string;
    end_date?: string;
    min_duration?: number;
    work_start?: number;
    work_end?: number;
  }
): Promise<{ slots: AvailableSlot[]; member_count: number; date_range: { start: string; end: string } }> {
  const params = new URLSearchParams();
  if (options?.start_date) params.append('start_date', options.start_date);
  if (options?.end_date) params.append('end_date', options.end_date);
  if (options?.min_duration) params.append('min_duration', options.min_duration.toString());
  if (options?.work_start) params.append('work_start', options.work_start.toString());
  if (options?.work_end) params.append('work_end', options.work_end.toString());

  const query = params.toString() ? `?${params.toString()}` : '';
  return apiRequest(`/groups/${groupId}/available-slots${query}`);
}

export async function findMeetingTime(
  groupId: string,
  options?: {
    duration?: number;
    preferred_dates?: string[];
    preferred_times?: string[];
  }
): Promise<{
  recommendations: {
    date: string;
    start_time: string;
    end_time: string;
    type: string;
    recommendation_type: 'best' | 'alternative';
    reason: string;
    conflicting_members?: string[];
  }[];
  total_available: number;
  total_negotiable: number;
}> {
  return apiRequest(`/groups/${groupId}/find-meeting-time`, {
    method: 'POST',
    body: JSON.stringify(options || {}),
  });
}

// MCP 기반 그룹 미팅 계획
export async function planGroupMeeting(
  groupId: string,
  options?: {
    title?: string;
    duration?: number;
    location_area?: string;
    place_type?: string;
    budget?: number;
    preferences?: string;
  }
): Promise<MeetingRecommendation> {
  return apiRequest(`/groups/${groupId}/plan-meeting`, {
    method: 'POST',
    body: JSON.stringify(options || {}),
  });
}

export async function createGroupMeeting(
  groupId: string,
  meeting: {
    title: string;
    date: string;
    start_time: string;
    end_time?: string;
    location?: string;
    description?: string;
  }
): Promise<{
  success: boolean;
  message: string;
  meeting: {
    title: string;
    date: string;
    time: string;
    location?: string;
  };
  created_for: number;
  failed_for: number;
}> {
  return apiRequest(`/groups/${groupId}/create-meeting`, {
    method: 'POST',
    body: JSON.stringify(meeting),
  });
}

export async function findGroupMidpoint(
  groupId: string,
  memberLocations: { user_id: string; location: { lat: number; lng: number } }[]
): Promise<{
  midpoint: { lat: number; lng: number };
  nearby_places: MCPPlaceResult[];
  member_distances: { user_id: string; distance: string }[];
}> {
  return apiRequest(`/groups/${groupId}/find-midpoint`, {
    method: 'POST',
    body: JSON.stringify({ member_locations: memberLocations }),
  });
}

// 그룹 AI 비서 채팅
export async function sendGroupChatMessage(
  groupId: string,
  message: string
): Promise<{
  message: string;
  available_slots: AvailableSlot[];
  member_count: number;
}> {
  return apiRequest(`/groups/${groupId}/chat`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}
