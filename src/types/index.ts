// User types (Google Login only)
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

// Category types - User defined categories
export interface Category {
  id: string;
  user_id: string;
  name: string;
  color: string;
  is_default: boolean;
  created_at?: string;
}

// Default category color
export const DEFAULT_CATEGORY_COLOR = '#9CA3AF';

// Category color options
export const CATEGORY_COLORS = [
  '#FF6B6B', '#FF9F43', '#FECA57', '#48DBFB',
  '#1DD1A1', '#5F27CD', '#FF9FF3', '#54A0FF',
  '#9CA3AF', '#6366F1', '#EC4899', '#14B8A6',
];

// Goal Status type
export type GoalStatus = 'planning' | 'scheduled' | 'in_progress' | 'completed' | 'failed';

// Goal types - User's long-term goals (matches DB schema)
export interface Goal {
  id?: string;
  user_id: string;
  category_id?: string;
  title: string;
  description?: string;
  target_date: string;            // Due date (Required, YYYY-MM-DD)
  priority: 'high' | 'medium' | 'low';
  status: GoalStatus;             // Goal status
  total_estimated_time: number;   // Total estimated time (minutes)
  completed_time: number;         // Completed time (minutes)
  created_at?: string;
  updated_at?: string;
}

// Progress calculation helper
export function calculateGoalProgress(goal: Goal): number {
  const totalTime = goal.total_estimated_time ?? 0;
  const completedTime = goal.completed_time ?? 0;

  // Return 0% if total_estimated_time is 0 or missing
  if (totalTime === 0) return 0;

  const progress = Math.round((completedTime / totalTime) * 100);
  // Prevent NaN and limit to 0-100 range
  return isNaN(progress) ? 0 : Math.min(100, Math.max(0, progress));
}

// Todo types - To-do list (matches DB schema)
export interface Todo {
  id?: string;
  user_id: string;
  goal_id?: string;               // Linked Goal
  title: string;
  description?: string;
  deadline?: string;              // Deadline (ISO datetime)
  is_hard_deadline: boolean;      // If true, cannot be postponed
  estimated_time?: number;        // Estimated time (minutes)
  completed_time: number;         // Completed time (minutes)
  is_divisible: boolean;          // Whether it can be divided
  priority: 'high' | 'medium' | 'low';
  is_completed: boolean;
  completed_at?: string;
  is_recurring?: boolean;
  recurrence_pattern?: string;
  created_at?: string;
}

// Event Priority type (1-5 scale)
export type EventPriority = 1 | 2 | 3 | 4 | 5;

// Priority description
// 1: Low (Can be moved/cancelled anytime) - Cleaning, Netflix
// 2: Medium-Low (Keep if possible) - Personal workout
// 3: Medium (Default) - General appointments
// 4: High (Hard to change) - Important meetings
// 5: Absolute (Cannot be changed) - Exams, Interviews

// Event types (matches DB schema)
export interface CalendarEvent {
  id?: string;
  user_id: string;
  category_id?: string;         // Category link (optional)
  related_todo_id?: string;     // Linked Todo
  title: string;
  description?: string;
  event_date: string;           // Start date (YYYY-MM-DD)
  end_date?: string;            // End date (for multi-day events, YYYY-MM-DD)
  start_time?: string;          // Start time (HH:mm)
  end_time?: string;            // End time (HH:mm)
  is_all_day: boolean;
  location?: string;

  // Flexibility related
  is_fixed: boolean;            // true: Fixed event, false: Flexible event
  priority: EventPriority;      // 1-5 Priority

  is_completed: boolean;        // Event completion status
  completed_at?: string;
  created_at?: string;

  // UI only (not saved in DB)
  is_ai_suggested?: boolean;
  is_confirmed?: boolean;
}

// Helper to check if it's a multi-day event
export function isMultiDayEvent(event: CalendarEvent): boolean {
  return !!event.end_date && event.end_date !== event.event_date;
}

// Helper to calculate event duration (days)
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
  category_name?: string; // AI suggested category name (for matching)
  description?: string;
  reason: string; // Reason for AI suggestion
  // UI status (used in chat only)
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
    name: 'Master Manager',
    icon: '',
    description: 'Coordinates all agents and suggests optimal schedules.',
    specialties: ['Schedule Coordination', 'Goal Management', 'Priority Setting'],
    color: '#4A90D9',
  },
  health: {
    type: 'health',
    name: 'Health Coach',
    icon: '',
    description: 'Helps with exercise, diet, and health management.',
    specialties: ['Exercise Planning', 'Diet', 'Sleep Management', 'Health Habits'],
    color: '#1DD1A1',
  },
  study: {
    type: 'study',
    name: 'Study Mentor',
    icon: '',
    description: 'Manages study plans and learning goals.',
    specialties: ['Study Planning', 'Exam Prep', 'Certifications', 'Language Learning'],
    color: '#FECA57',
  },
  career: {
    type: 'career',
    name: 'Career Advisor',
    icon: '',
    description: 'Manages work/career-related schedules and goals.',
    specialties: ['Work Management', 'Career Development', 'Networking', 'Self Improvement'],
    color: '#54A0FF',
  },
  lifestyle: {
    type: 'lifestyle',
    name: 'Life Planner',
    icon: '',
    description: 'Manages daily life, leisure, and relationships.',
    specialties: ['Appointment Management', 'Hobbies', 'Travel Planning', 'Relationship Management'],
    color: '#FF9FF3',
  },
  scheduler: {
    type: 'scheduler',
    name: 'Schedule Optimizer',
    icon: '',
    description: 'Resolves schedule conflicts and finds optimal times.',
    specialties: ['Time Optimization', 'Conflict Resolution', 'Free Time Allocation'],
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
  category_name?: string; // Category name (for matching)
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
export type SidebarView = 'dashboard' | 'assistant' | 'calendar' | 'goals' | 'todos' | 'groups' | 'chat' | 'settings';
export type CalendarView = 'month' | 'week' | 'day';

// =============================================
// MCP Tool System Types (Phase 2)
// =============================================

// Risk level
export type RiskLevel = 'low' | 'medium' | 'high';

// Tool category
export type ToolCategory = 'internal' | 'external' | 'integration';

// Tool execution status
export type ToolExecutionStatus =
  | 'pending'     // Pending confirmation
  | 'confirmed'   // Confirmed
  | 'executing'   // Executing
  | 'completed'   // Completed
  | 'failed'      // Failed
  | 'cancelled'   // Cancelled
  | 'expired';    // Expired

// Tool execution info
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

// Confirmation type (Different UI based on risk)
export type ConfirmationType = 'immediate' | 'inline' | 'modal';

// Pending confirmation request
export interface PendingConfirmation {
  executionId: string;
  toolName: string;
  riskLevel: RiskLevel;
  confirmationType: ConfirmationType;
  preview: ToolPreviewData;
  warning?: string;
  expiresAt: Date;
}

// Tool preview data
export interface ToolPreviewData {
  title: string;
  description: string;
  details: Record<string, string | number | boolean>;
  icon?: string;
}

// =============================================
// External Service Types (Phase 3)
// =============================================

// External service type
export type ExternalServiceType =
  | 'weather'
  | 'shopping'
  | 'location'
  | 'google_calendar'
  | 'notion';

// External service config
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

// Weather data
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

// Place search result
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

// Route info
export interface DirectionsResult {
  duration: number;      // Minute unit
  distance: number;      // km unit
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

// Product search result
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
// Action Log Types (For Audit/Rollback)
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
