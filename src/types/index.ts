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

// Goal Status 타입
export type GoalStatus = 'planning' | 'scheduled' | 'in_progress' | 'completed' | 'failed';

// Goal types - 사용자의 장기 목표 (DB 스키마와 일치)
export interface Goal {
  id?: string;
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
  const totalTime = goal.total_estimated_time ?? 0;
  const completedTime = goal.completed_time ?? 0;

  // total_estimated_time이 0이거나 없으면 0% 반환
  if (totalTime === 0) return 0;

  const progress = Math.round((completedTime / totalTime) * 100);
  // NaN 방지 및 0-100 범위 제한
  return isNaN(progress) ? 0 : Math.min(100, Math.max(0, progress));
}

// Todo types - 할 일 목록 (DB 스키마와 일치)
export interface Todo {
  id?: string;
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

// Event Priority 타입 (1-5 스케일)
export type EventPriority = 1 | 2 | 3 | 4 | 5;

// Priority 설명
// 1: 낮음 (언제든 이동/취소 가능) - 청소, 넷플릭스
// 2: 보통-낮음 (가능하면 유지) - 개인 운동
// 3: 보통 (기본값) - 일반 약속
// 4: 높음 (웬만하면 변경 불가) - 중요 미팅
// 5: 절대 (절대 변경 불가) - 시험, 면접

// Event types (DB 스키마와 일치)
export interface CalendarEvent {
  id?: string;
  user_id: string;
  category_id?: string;         // 카테고리 연결 (선택)
  related_todo_id?: string;     // 연결된 Todo
  title: string;
  description?: string;
  event_date: string;           // 시작일 (YYYY-MM-DD)
  end_date?: string;            // 종료일 (기간 일정용, YYYY-MM-DD)
  start_time?: string;          // 시작 시간 (HH:mm)
  end_time?: string;            // 종료 시간 (HH:mm)
  is_all_day: boolean;
  location?: string;

  // 유동성 관련
  is_fixed: boolean;            // true: 고정 일정, false: 유동 일정
  priority: EventPriority;      // 1-5 우선순위

  is_completed: boolean;        // 일정 완료 여부
  completed_at?: string;
  created_at?: string;

  // UI 전용 (DB에 저장 안함)
  is_ai_suggested?: boolean;
  is_confirmed?: boolean;
}

// 기간 일정인지 확인하는 헬퍼
export function isMultiDayEvent(event: CalendarEvent): boolean {
  return !!event.end_date && event.end_date !== event.event_date;
}

// 일정 기간(일수) 계산 헬퍼
export function getEventDurationDays(event: CalendarEvent): number {
  if (!event.end_date) return 1;
  const start = new Date(event.event_date);
  const end = new Date(event.end_date);
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
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
    icon: '',
    description: '모든 에이전트를 조율하고 최적의 일정을 제안합니다',
    specialties: ['일정 조율', '목표 관리', '우선순위 설정'],
    color: '#4A90D9',
  },
  health: {
    type: 'health',
    name: '건강 코치',
    icon: '',
    description: '운동, 식단, 건강 관리를 도와드립니다',
    specialties: ['운동 계획', '다이어트', '수면 관리', '건강 습관'],
    color: '#1DD1A1',
  },
  study: {
    type: 'study',
    name: '학습 멘토',
    icon: '',
    description: '공부 계획과 학습 목표를 관리합니다',
    specialties: ['학습 계획', '시험 준비', '자격증', '언어 학습'],
    color: '#FECA57',
  },
  career: {
    type: 'career',
    name: '커리어 어드바이저',
    icon: '',
    description: '직장/커리어 관련 일정과 목표를 관리합니다',
    specialties: ['업무 관리', '커리어 개발', '네트워킹', '자기계발'],
    color: '#54A0FF',
  },
  lifestyle: {
    type: 'lifestyle',
    name: '라이프 플래너',
    icon: '',
    description: '일상생활과 여가, 관계를 관리합니다',
    specialties: ['약속 관리', '취미 활동', '여행 계획', '관계 관리'],
    color: '#FF9FF3',
  },
  scheduler: {
    type: 'scheduler',
    name: '스케줄 최적화',
    icon: '',
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
export type SidebarView = 'dashboard' | 'assistant' | 'calendar' | 'goals' | 'todos' | 'chat' | 'settings';
export type CalendarView = 'month' | 'week' | 'day';

// =============================================
// MCP Tool System Types (Phase 2)
// =============================================

// 위험도 레벨
export type RiskLevel = 'low' | 'medium' | 'high';

// 도구 카테고리
export type ToolCategory = 'internal' | 'external' | 'integration';

// 도구 실행 상태
export type ToolExecutionStatus =
  | 'pending'     // 확인 대기 중
  | 'confirmed'   // 확인됨
  | 'executing'   // 실행 중
  | 'completed'   // 완료
  | 'failed'      // 실패
  | 'cancelled'   // 취소됨
  | 'expired';    // 만료됨

// 도구 실행 정보
export interface ToolExecution {
  id: string;
  user_id: string;
  conversation_id?: string;
  tool_name: string;
  tool_category: ToolCategory;
  risk_level: RiskLevel;
  input_params: Record<string, unknown>;
  output_result?: Record<string, unknown>;
  preview_data?: Record<string, unknown>;
  status: ToolExecutionStatus;
  requires_confirmation: boolean;
  confirmed_at?: string;
  executed_at?: string;
  expires_at?: string;
  error_message?: string;
  created_at: string;
}

// 확인 타입 (위험도에 따라 다른 UI)
export type ConfirmationType = 'immediate' | 'inline' | 'modal';

// 대기 중인 확인 요청
export interface PendingConfirmation {
  executionId: string;
  toolName: string;
  riskLevel: RiskLevel;
  confirmationType: ConfirmationType;
  preview: ToolPreviewData;
  warning?: string;
  expiresAt: Date;
}

// 도구 미리보기 데이터
export interface ToolPreviewData {
  title: string;
  description: string;
  details: Record<string, string | number | boolean>;
  icon?: string;
}

// =============================================
// External Service Types (Phase 3)
// =============================================

// 외부 서비스 타입
export type ExternalServiceType =
  | 'weather'
  | 'shopping'
  | 'location'
  | 'google_calendar'
  | 'notion';

// 외부 서비스 설정
export interface ExternalService {
  id: string;
  user_id: string;
  service_type: ExternalServiceType;
  service_name: string;
  config: Record<string, unknown>;
  is_enabled: boolean;
  last_synced_at?: string;
  created_at: string;
  updated_at: string;
}

// 날씨 데이터
export interface WeatherData {
  location: string;
  temperature: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  icon: string;
  forecast?: DailyForecast[];
  recommendation?: string;
}

export interface DailyForecast {
  date: string;
  tempHigh: number;
  tempLow: number;
  condition: string;
  rainProbability: number;
  icon: string;
}

// 장소 검색 결과
export interface PlaceSearchResult {
  id: string;
  name: string;
  category: string;
  address: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  rating?: number;
  priceRange?: string;
  phone?: string;
  url?: string;
  distance?: number;
}

// 경로 정보
export interface DirectionsResult {
  duration: number;      // 분 단위
  distance: number;      // km 단위
  departureTime?: string;
  arrivalTime?: string;
  transportMode: 'transit' | 'driving' | 'walking';
  steps?: DirectionStep[];
}

export interface DirectionStep {
  instruction: string;
  distance: number;
  duration: number;
}

// 상품 검색 결과
export interface ProductSearchResult {
  id: string;
  title: string;
  price: number;
  originalPrice?: number;
  mall: string;
  image: string;
  url: string;
  category: string;
  rating?: number;
}

// =============================================
// Action Log Types (감사/롤백용)
// =============================================

export type ActionType = 'create' | 'update' | 'delete' | 'external_call' | 'sync';
export type EntityType = 'event' | 'todo' | 'goal' | 'category' | 'external_service';

export interface ActionLog {
  id: string;
  user_id: string;
  action_type: ActionType;
  entity_type: EntityType;
  entity_id?: string;
  previous_state?: Record<string, unknown>;
  new_state?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  risk_level: RiskLevel;
  is_reversible: boolean;
  reversed_at?: string;
  created_at: string;
}
