// User types (구글 로그인 전용)
export interface User {
  id: string;
  email: string;
  name: string;
  nickname?: string;
  avatar_url?: string;
  is_active: boolean;
  last_login_at?: string;
  created_at?: string;
}

// Category types - 사용자 정의 카테고리
export interface Category {
  id: string;
  user_id: string;
  name: string;
  color: string;
  is_default: boolean;
  created_at?: string;
}

// 기본 카테고리 색상
export const DEFAULT_CATEGORY_COLOR = '#9CA3AF';

// 카테고리 색상 선택지
export const CATEGORY_COLORS = [
  '#FF6B6B', '#FF9F43', '#FECA57', '#48DBFB',
  '#1DD1A1', '#5F27CD', '#FF9FF3', '#54A0FF',
  '#9CA3AF', '#6366F1', '#EC4899', '#14B8A6',
];

// Goal types - 사용자의 장기 목표
export interface Goal {
  id?: string;
  user_id: string;
  title: string;
  description?: string;
  category_id?: string; // 카테고리 연결 (선택)
  target_date?: string;
  priority: 'high' | 'medium' | 'low';
  progress: number; // 0-100
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

// Todo types - 할 일 목록
export interface Todo {
  id?: string;
  user_id: string;
  goal_id?: string; // 연결된 목표 (선택)
  title: string;
  description?: string;
  due_date?: string;
  due_time?: string;
  priority: 'high' | 'medium' | 'low';
  is_completed: boolean;
  completed_at?: string;
  is_recurring: boolean;
  recurrence_pattern?: 'daily' | 'weekly' | 'monthly';
  created_at?: string;
}

// Event types
export interface CalendarEvent {
  id?: string;
  user_id: string;
  category_id?: string; // 카테고리 연결 (선택)
  title: string;
  description?: string;
  event_date: string;
  start_time?: string;
  end_time?: string;
  is_all_day: boolean;
  location?: string;
  is_completed: boolean; // 일정 완료 여부
  completed_at?: string;
  is_ai_suggested?: boolean; // AI가 추천한 일정인지 (UI용, DB에 저장 안함)
  is_confirmed?: boolean; // 사용자가 확인했는지 (UI용, DB에 저장 안함)
  created_at?: string;
}

// AI Agent types
export type AgentType = 'master' | 'health' | 'study' | 'career' | 'lifestyle' | 'scheduler';

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  agent_type?: AgentType;
  timestamp: Date;
  metadata?: {
    suggested_events?: SuggestedEvent[];
    suggested_todos?: SuggestedTodo[];
    place_recommendations?: PlaceRecommendation[];
  };
}

export interface SuggestedEvent {
  title: string;
  date: string;
  start_time?: string;
  end_time?: string;
  location?: string;
  category_name?: string; // AI가 추천하는 카테고리 이름 (매칭용)
  description?: string;
  reason: string; // AI가 추천하는 이유
  // UI 상태 (채팅에서만 사용)
  added?: boolean;
  rejected?: boolean;
}

export interface SuggestedTodo {
  title: string;
  description?: string;
  due_date?: string;
  priority: 'high' | 'medium' | 'low';
  reason: string;
}

export interface PlaceRecommendation {
  name: string;
  category: string;
  address?: string;
  rating?: number;
  price_range?: string;
  reason: string;
  url?: string;
}

// Agent Configuration
export interface AgentConfig {
  type: AgentType;
  name: string;
  icon: string;
  description: string;
  specialties: string[];
  color: string;
}

export const AGENT_CONFIGS: Record<AgentType, AgentConfig> = {
  master: {
    type: 'master',
    name: '통합 매니저',
    icon: '🤖',
    description: '모든 에이전트를 조율하고 최적의 일정을 제안합니다',
    specialties: ['일정 조율', '목표 관리', '우선순위 설정'],
    color: '#4A90D9',
  },
  health: {
    type: 'health',
    name: '건강 코치',
    icon: '💪',
    description: '운동, 식단, 건강 관리를 도와드립니다',
    specialties: ['운동 계획', '다이어트', '수면 관리', '건강 습관'],
    color: '#1DD1A1',
  },
  study: {
    type: 'study',
    name: '학습 멘토',
    icon: '📚',
    description: '공부 계획과 학습 목표를 관리합니다',
    specialties: ['학습 계획', '시험 준비', '자격증', '언어 학습'],
    color: '#FECA57',
  },
  career: {
    type: 'career',
    name: '커리어 어드바이저',
    icon: '💼',
    description: '직장/커리어 관련 일정과 목표를 관리합니다',
    specialties: ['업무 관리', '커리어 개발', '네트워킹', '자기계발'],
    color: '#54A0FF',
  },
  lifestyle: {
    type: 'lifestyle',
    name: '라이프 플래너',
    icon: '🌟',
    description: '일상생활과 여가, 관계를 관리합니다',
    specialties: ['약속 관리', '취미 활동', '여행 계획', '관계 관리'],
    color: '#FF9FF3',
  },
  scheduler: {
    type: 'scheduler',
    name: '스케줄 최적화',
    icon: '📅',
    description: '일정 충돌을 해결하고 최적의 시간을 찾습니다',
    specialties: ['시간 최적화', '충돌 해결', '여유시간 확보'],
    color: '#5F27CD',
  },
};

// Chat types
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ScheduleInfo {
  title: string;
  date: string;
  start_time?: string;
  end_time?: string;
  location?: string;
  category_name?: string; // 카테고리 이름 (매칭용)
  description?: string;
}

// AI Recommendation types
export interface AIRecommendation {
  id: string;
  type: 'event' | 'todo' | 'habit' | 'place';
  title: string;
  description: string;
  agent_type: AgentType;
  data: SuggestedEvent | SuggestedTodo | PlaceRecommendation;
  status: 'pending' | 'accepted' | 'rejected' | 'modified';
  created_at: Date;
}

// Notification types
export interface Notification {
  id: string;
  type: 'recommendation' | 'reminder' | 'achievement' | 'system';
  title: string;
  message: string;
  is_read: boolean;
  action_type?: 'accept_event' | 'view_goal' | 'open_chat';
  action_data?: Record<string, unknown>;
  created_at: Date;
}

// View types for UI
export type SidebarView = 'dashboard' | 'calendar' | 'goals' | 'todos' | 'chat' | 'settings';
export type CalendarView = 'month' | 'week' | 'day';
