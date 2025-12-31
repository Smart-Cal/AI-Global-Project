// ==============================================
// PALM Backend Types
// ==============================================

// User types (구글 로그인 전용)
export interface User {
  id: string;
  email: string;
  name: string;
  nickname?: string;
  avatar_url?: string;
  is_active?: boolean;
  last_login_at?: string;
  created_at?: string;
}

// Category types
export interface Category {
  id: string;
  user_id: string;
  name: string;
  color: string;
  is_default: boolean;
  created_at?: string;
}

// Event types (API 응답용)
export interface Event {
  id: string;
  user_id: string;
  category_id?: string;
  title: string;
  description?: string;
  datetime: string; // ISO datetime
  duration: number; // 분 단위
  type: 'fixed' | 'personal' | 'goal';
  location?: string;
  is_completed: boolean;
  completed_at?: string;
  created_at?: string;
}

// DB Event types (실제 DB 스키마와 일치)
export interface DBEvent {
  id: string;
  user_id: string;
  category_id?: string;
  title: string;
  description?: string;
  event_date: string; // YYYY-MM-DD
  start_time?: string; // HH:MM
  end_time?: string; // HH:MM
  is_all_day: boolean;
  location?: string;
  is_completed: boolean;
  completed_at?: string;
  created_at?: string;
}

// Todo types (PALM 아키텍처 기준)
export interface Todo {
  id: string;
  user_id: string;
  event_id?: string; // 연결된 Event (PALM 스펙)
  title: string;
  description?: string;
  timing: 'before' | 'during' | 'after';
  deadline: string;
  scheduled_at?: string; // AI가 배치한 시간
  duration: number; // 예상 소요 시간 (분)
  priority: 'high' | 'medium' | 'low';
  is_completed: boolean;
  completed_at?: string;
  created_at?: string;
}

// Goal types
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

// ==============================================
// AI Agent Types
// ==============================================

// Parser Agent Output
export interface ParsedInput {
  type: 'fixed' | 'personal' | 'goal' | 'todo' | 'unknown';
  events: ParsedEvent[];
  todos: ParsedTodo[];
  intent: string;
  needs_clarification: boolean;
  clarification_question?: string;
}

export interface ParsedEvent {
  title: string;
  datetime?: string;
  duration?: number;
  location?: string;
  type: 'fixed' | 'personal' | 'goal';
  description?: string;
  category?: string; // AI가 추천한 카테고리 이름
}

export interface ParsedTodo {
  title: string;
  related_event_title?: string;
  timing?: 'before' | 'during' | 'after';
  deadline?: string;
  duration?: number;
  priority?: 'high' | 'medium' | 'low';
}

// Scheduler Agent Output
export interface ScheduledItem {
  todo_id?: string;
  title: string;
  scheduled_at: string;
  duration: number;
  reason: string;
}

export interface ScheduleResult {
  scheduled_items: ScheduledItem[];
  conflicts: string[];
  suggestions: string[];
}

// Planner Agent Output
export interface PlanItem {
  title: string;
  date: string;
  duration: number;
  order: number;
}

export interface PlanResult {
  goal_title: string;
  items: PlanItem[];
  total_duration: number;
  strategy: string;
}

// Chat Message
export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at?: string;
  pending_events?: Partial<Event>[]; // 확인 대기 중인 일정들
}

// Conversation (대화 세션)
export interface Conversation {
  id: string;
  user_id: string;
  title?: string; // 첫 번째 메시지 기반 자동 생성
  created_at: string;
  updated_at: string;
}

// DB Message (실제 DB 저장용)
export interface DBMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  pending_events?: any; // JSON으로 저장
  created_at: string;
}

// Orchestrator Context
export interface OrchestratorContext {
  user_id: string;
  events: Event[];
  todos: Todo[];
  goals: Goal[];
  categories: Category[];
  conversation_history: ChatMessage[];
}

// Agent Response
export interface AgentResponse {
  message: string;
  events_to_create?: Partial<Event>[];
  todos_to_create?: Partial<Todo>[];
  todos_to_schedule?: ScheduledItem[];
  needs_user_input?: boolean;
  suggestions?: string[];
}

// ==============================================
// API Types
// ==============================================

export interface ChatRequest {
  message: string;
  conversation_history?: ChatMessage[];
}

export interface ChatResponse {
  message: string;
  events?: Partial<Event>[];
  todos?: Partial<Todo>[];
  scheduled_items?: ScheduledItem[];
}

export interface GoogleAuthRequest {
  access_token: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}
