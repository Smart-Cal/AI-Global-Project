// ==============================================
// PALM Backend Types
// ==============================================

// User types (전화번호 기반)
export interface User {
  id: string;
  phone: string;
  name: string;
  nickname?: string;
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

// Event types (PALM 아키텍처 기준)
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
  role: 'user' | 'assistant' | 'system';
  content: string;
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

export interface AuthRequest {
  phone: string;
  password: string;
  name?: string;
  nickname?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}
