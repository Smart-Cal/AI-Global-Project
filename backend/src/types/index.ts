// ==============================================
// PALM Backend Types v3.1
// Human-Centric Life Secretary
// ==============================================

// ==============================================
// Chronotype & Priority 상수
// ==============================================

export type Chronotype = 'early_morning' | 'morning' | 'afternoon' | 'evening' | 'night';

// 레거시 호환 Chronotype (3단계)
export type LegacyChronotype = 'morning' | 'evening' | 'neutral';

// Chronotype 시간대 정의
export const CHRONOTYPE_HOURS: Record<Chronotype, { start: number; end: number }> = {
  early_morning: { start: 5, end: 9 },
  morning: { start: 9, end: 12 },
  afternoon: { start: 12, end: 17 },
  evening: { start: 17, end: 21 },
  night: { start: 21, end: 2 }, // 다음날 2시까지
};

export type EventPriority = 1 | 2 | 3 | 4 | 5;

// Priority 정의
// 1: 낮음 (언제든 이동/취소 가능) - 청소, 넷플릭스
// 2: 보통-낮음 (가능하면 유지) - 개인 운동
// 3: 보통 (기본값) - 일반 약속
// 4: 높음 (웬만하면 변경 불가) - 중요 미팅
// 5: 절대 (절대 변경 불가) - 시험, 면접

export type GoalStatus = 'planning' | 'scheduled' | 'in_progress' | 'completed' | 'failed';

// ==============================================
// User types (구글 로그인 전용)
// ==============================================
export interface User {
  id: string;
  email: string;
  name: string;
  nickname?: string;
  avatar_url?: string;
  location?: string;              // 날씨 API용 도시명 (예: "Seoul")
  chronotype: Chronotype;         // 집중 시간대
  is_active?: boolean;
  last_login_at?: string;
  created_at?: string;
}

// ==============================================
// Category types
// ==============================================
export interface Category {
  id: string;
  user_id: string;
  name: string;
  color: string;
  is_default: boolean;
  created_at?: string;
}

// ==============================================
// Goal types (Deadline 기반 목표)
// ==============================================
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

// ==============================================
// Todo types (부분 완료 추적)
// ==============================================
export interface Todo {
  id: string;
  user_id: string;
  goal_id?: string;               // 연결된 Goal
  title: string;
  description?: string;

  // 마감 관련
  deadline?: string;              // 마감 시각 (ISO datetime)
  is_hard_deadline: boolean;      // true면 절대 밀릴 수 없음

  // 시간 관련
  estimated_time?: number;        // 예상 시간 (분)
  completed_time: number;         // 완료된 시간 (분)
  is_divisible: boolean;          // 분할 가능 여부

  // 상태
  priority: 'high' | 'medium' | 'low';
  is_completed: boolean;
  completed_at?: string;

  // 반복 (기존 호환)
  is_recurring?: boolean;
  recurrence_pattern?: string;

  created_at?: string;
}

// Todo 진행률 계산 헬퍼
export function calculateTodoProgress(todo: Todo): number {
  if (!todo.estimated_time || todo.estimated_time === 0) return todo.is_completed ? 100 : 0;
  return Math.round((todo.completed_time / todo.estimated_time) * 100);
}

// ==============================================
// Event types (Fixed/Flexible 구분)
// ==============================================
export interface Event {
  id: string;
  user_id: string;
  category_id?: string;
  related_todo_id?: string;       // 연결된 Todo
  title: string;
  description?: string;
  event_date: string;             // YYYY-MM-DD
  start_time?: string;            // HH:MM
  end_time?: string;              // HH:MM
  is_all_day: boolean;
  location?: string;

  // 유동성 관련
  is_fixed: boolean;              // true: 고정, false: 유동
  priority: EventPriority;        // 1~5

  is_completed: boolean;
  completed_at?: string;
  created_at?: string;
}

// Event duration 계산 헬퍼 (분 단위)
export function calculateEventDuration(event: Event): number {
  if (event.is_all_day || !event.start_time || !event.end_time) return 0;

  const [startHour, startMin] = event.start_time.split(':').map(Number);
  const [endHour, endMin] = event.end_time.split(':').map(Number);

  return (endHour * 60 + endMin) - (startHour * 60 + startMin);
}

// ==============================================
// 레거시 호환 타입 (DB 형식과의 호환성)
// ==============================================

// DB에서 직접 가져온 Event (event_date, start_time, end_time 형식)
export interface DBEvent {
  id: string;
  user_id: string;
  category_id?: string;
  related_todo_id?: string;
  title: string;
  description?: string;
  event_date: string;             // YYYY-MM-DD
  start_time?: string;            // HH:MM
  end_time?: string;              // HH:MM
  is_all_day: boolean;
  location?: string;
  is_fixed: boolean;
  priority: EventPriority;
  is_completed: boolean;
  completed_at?: string;
  created_at?: string;
}

// 레거시 Event (datetime, duration 형식 - orchestrator 등에서 사용)
export interface LegacyEvent {
  id: string;
  user_id: string;
  category_id?: string;
  title: string;
  description?: string;
  datetime: string;               // ISO datetime
  duration: number;               // 분 단위
  type: 'fixed' | 'personal' | 'goal';
  location?: string;
  is_completed: boolean;
  completed_at?: string;
  created_at?: string;
}

// DBEvent를 LegacyEvent로 변환
export function dbEventToLegacy(dbEvent: DBEvent): LegacyEvent {
  const datetime = `${dbEvent.event_date}T${dbEvent.start_time || '09:00'}:00`;
  let duration = 60;
  if (dbEvent.start_time && dbEvent.end_time) {
    const [startH, startM] = dbEvent.start_time.split(':').map(Number);
    const [endH, endM] = dbEvent.end_time.split(':').map(Number);
    duration = (endH * 60 + endM) - (startH * 60 + startM);
    if (duration <= 0) duration = 60;
  }

  return {
    id: dbEvent.id,
    user_id: dbEvent.user_id,
    category_id: dbEvent.category_id,
    title: dbEvent.title,
    description: dbEvent.description,
    datetime,
    duration,
    type: dbEvent.is_fixed ? 'fixed' : 'personal',
    location: dbEvent.location,
    is_completed: dbEvent.is_completed,
    completed_at: dbEvent.completed_at,
    created_at: dbEvent.created_at,
  };
}

// LegacyEvent를 DBEvent로 변환
export function legacyToDbEvent(event: Partial<LegacyEvent>): Partial<DBEvent> {
  const dbEvent: Partial<DBEvent> = {
    user_id: event.user_id,
    title: event.title,
    description: event.description,
    location: event.location,
    is_completed: event.is_completed ?? false,
    is_all_day: false,
    is_fixed: event.type === 'fixed',
    priority: 3, // 기본값
  };

  if (event.datetime) {
    const [datePart, timePart] = event.datetime.split('T');
    dbEvent.event_date = datePart;
    dbEvent.start_time = timePart ? timePart.slice(0, 5) : '09:00';

    const duration = event.duration || 60;
    const [hours, minutes] = (dbEvent.start_time).split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + duration;
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMinutes = totalMinutes % 60;
    dbEvent.end_time = `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
  }

  return dbEvent;
}

// ==============================================
// Life Log types (AI 일기)
// ==============================================
export interface LifeLog {
  id: string;
  user_id: string;
  log_date: string;               // YYYY-MM-DD
  summary?: string;               // 한 줄 요약
  content: string;                // AI 작성 일기 본문
  mood?: string;                  // 이모지 (😊, 😐, 😢 등)
  tags?: string[];                // 태그 배열
  created_at?: string;
  updated_at?: string;
}

// ==============================================
// Group types
// ==============================================
export interface Group {
  id: string;
  name: string;
  invite_code: string;           // 디스코드 스타일 초대 코드 (예: "ABC123")
  created_by: string;
  created_at?: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: 'owner' | 'member';
  joined_at?: string;
}

export interface GroupInvitation {
  id: string;
  group_id: string;
  inviter_id: string;
  invitee_email: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at?: string;
  responded_at?: string;
}

// Group 매칭 결과
export interface GroupMatchSlot {
  date: string;                   // YYYY-MM-DD
  start_time: string;             // HH:MM
  end_time: string;               // HH:MM
  type: 'available' | 'negotiable'; // 완전 빈 시간 vs 유동 일정만 있는 시간
  conflicting_members?: string[]; // negotiable인 경우, 유동 일정 있는 멤버들
}

export interface GroupMatchResult {
  group_id: string;
  available_slots: GroupMatchSlot[];
  member_count: number;
}

// ==============================================
// Conversation & Message types
// ==============================================
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
  pending_events?: any;           // JSON으로 저장
  created_at: string;
}

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at?: string;
  pending_events?: Partial<Event>[];
}

// ==============================================
// Briefing types
// ==============================================
export interface MorningBriefing {
  weather?: {
    temperature: number;
    condition: string;
    icon: string;
    recommendation: string;       // 옷차림 추천
    city: string;                 // 도시명
  };
  today_events: Event[];
  incomplete_todos: Todo[];
  message: string;                // AI 생성 브리핑 메시지
}

export interface EveningBriefing {
  completed_events: Event[];
  completed_todos: Todo[];
  completion_rate: number;        // 오늘 달성률 (%)
  tomorrow_first_event?: Event;
  tomorrow_weather?: {
    temperature: number;
    condition: string;
    icon: string;
    recommendation: string;
    city: string;                 // 도시명
  };
  message: string;                // AI 생성 브리핑 메시지
}

// ==============================================
// AI Agent Types
// ==============================================

// Parser Agent Output
export interface ParsedInput {
  type: 'goal' | 'todo' | 'event' | 'question' | 'unknown' | 'fixed' | 'personal';
  goal?: {
    title: string;
    target_date?: string;
    description?: string;
  };
  todos: ParsedTodo[];
  events: ParsedEvent[];
  intent: string;
  needs_clarification: boolean;
  clarification_question?: string;
}

export interface ParsedEvent {
  title: string;
  date?: string;
  start_time?: string;
  end_time?: string;
  duration?: number;              // 분 단위
  datetime?: string;              // ISO datetime (레거시 호환)
  type?: 'fixed' | 'personal' | 'goal';  // 레거시 호환
  location?: string;
  is_fixed?: boolean;
  priority?: EventPriority;
  description?: string;
  category?: string;              // AI가 추천한 카테고리 이름
}

export interface ParsedTodo {
  title: string;
  goal_title?: string;            // 연결할 Goal 제목
  deadline?: string;
  estimated_time?: number;        // 분 단위
  duration?: number;              // 레거시 호환 (estimated_time과 동일)
  is_divisible?: boolean;
  priority?: 'high' | 'medium' | 'low';
  timing?: 'before' | 'during' | 'after';  // 레거시 호환
}

// Scheduler Agent
export interface ScheduleRequest {
  todos: Todo[];
  existing_events: Event[];
  user_chronotype: Chronotype;
  date_range: {
    start: string;                // YYYY-MM-DD
    end: string;                  // YYYY-MM-DD
  };
}

export interface ScheduledItem {
  todo_id: string;
  title: string;
  scheduled_date: string;         // YYYY-MM-DD
  scheduled_time: string;         // HH:MM
  scheduled_at?: string;          // ISO datetime (레거시 호환)
  duration: number;               // 분 단위
  reason: string;                 // 왜 이 시간에 배치했는지
}

export interface ScheduleResult {
  scheduled_items: ScheduledItem[];
  unscheduled_todos: string[];    // 배치 못한 Todo IDs
  conflicts: string[];
  suggestions: string[];
}

// Planner Agent Types
export interface PlanItem {
  title: string;
  date: string;                   // YYYY-MM-DD
  duration: number;               // 분 단위
  order: number;
}

export interface PlanResult {
  goal_title: string;
  items: PlanItem[];
  total_duration: number;         // 분 단위
  strategy: string;
}

// Orchestrator Context
export interface OrchestratorContext {
  user_id: string;
  user?: User;
  events: LegacyEvent[];
  todos: Todo[];
  goals: Goal[];
  categories: Category[];
  conversation_history: ChatMessage[];
}

// Agent Response
export interface AgentResponse {
  message: string;
  events_to_create?: Partial<LegacyEvent>[];
  todos_to_create?: Partial<Todo>[];
  goals_to_create?: Partial<Goal>[];
  scheduled_items?: ScheduledItem[];
  todos_to_schedule?: ScheduledItem[];  // 레거시 호환
  needs_user_input?: boolean;
  suggestions?: string[];
  // MCP 데이터 ("행동하는 AI" 기능)
  mcp_data?: MCPResponseData;
}

// MCP 응답 데이터 (장소 추천, 쇼핑 검색, 뉴스 등)
export interface MCPResponseData {
  // 장소 추천 결과
  places?: MCPPlaceResult[];
  // 맛집 추천 결과
  restaurants?: MCPPlaceResult[];
  // 상품 검색 결과
  products?: MCPProductResult[];
  // 선물 추천 결과
  gifts?: MCPProductResult[];
  // 뉴스 검색 결과
  news?: MCPNewsResult[];
  // 그룹 일정 매칭 결과
  group_schedule?: MCPGroupScheduleResult;
  // 가능한 시간 슬롯 (그룹 약속용)
  availableSlots?: {
    date: string;
    startTime: string;
    endTime: string;
    allAvailable: boolean;
    unavailableMembers?: string[];
  }[];
  // 실행된 액션들
  actions_taken?: MCPActionResult[];
}

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
  currency?: string;
  rating?: number;
  reviewCount?: number;
  seller?: string;
  mall?: string;
  image?: string;
  imageUrl?: string;
  link?: string;
  productUrl?: string;
  isPrime?: boolean;
  discountRate?: number;
  isFreeShipping?: boolean;
}

export interface MCPNewsResult {
  id: string;
  title: string;
  description?: string;
  content?: string;
  url: string;
  imageUrl?: string;
  source: string;
  author?: string;
  publishedAt: string;
  category?: string;
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

export interface MCPActionResult {
  action: string;  // 'calendar_create', 'place_search', 'product_search' 등
  success: boolean;
  result?: any;
  error?: string;
}

// ==============================================
// API Request/Response Types
// ==============================================

// Auth
export interface GoogleAuthRequest {
  access_token: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

// Chat
export interface ChatRequest {
  message: string;
  conversation_id?: string;
}

export interface ChatResponse {
  conversation_id: string;
  message_id: string;
  message: string;
  pending_events?: Partial<Event>[];
  pending_todos?: Partial<Todo>[];
  pending_goals?: Partial<Goal>[];
}

// Goal API
export interface CreateGoalRequest {
  title: string;
  description?: string;
  target_date: string;
  priority?: 'high' | 'medium' | 'low';
  category_id?: string;
}

// Todo API
export interface CreateTodoRequest {
  title: string;
  description?: string;
  goal_id?: string;
  deadline?: string;
  is_hard_deadline?: boolean;
  estimated_time?: number;
  is_divisible?: boolean;
  priority?: 'high' | 'medium' | 'low';
}

// Event API
export interface CreateEventRequest {
  title: string;
  description?: string;
  event_date: string;
  start_time?: string;
  end_time?: string;
  is_all_day?: boolean;
  location?: string;
  is_fixed?: boolean;
  priority?: EventPriority;
  category_id?: string;
  related_todo_id?: string;
}

// Group API
export interface CreateGroupRequest {
  name: string;
}

export interface InviteMemberRequest {
  email: string;
}

export interface RespondInvitationRequest {
  accept: boolean;
}

// Life Log API
export interface GenerateLogRequest {
  date?: string;                  // YYYY-MM-DD, 기본값: 오늘
}

export interface UpdateLogRequest {
  summary?: string;
  content?: string;
  mood?: string;
  tags?: string[];
}
