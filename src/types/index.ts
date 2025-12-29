// User types
export interface User {
  id: string;
  phone: string;
  name: string;
  nickname: string;
  is_active: boolean;
  last_login_at?: string;
  created_at?: string;
}

// Event types
export type EventCategory =
  | 'work'
  | 'personal'
  | 'social'
  | 'health'
  | 'study'
  | 'class'
  | 'task'
  | 'other';

export interface CalendarEvent {
  id?: string;
  user_id: string;
  title: string;
  description?: string;
  event_date: string;
  start_time?: string;
  end_time?: string;
  is_all_day: boolean;
  category: EventCategory;
  location?: string;
  color: string;
  created_at?: string;
}

export interface CategoryConfig {
  icon: string;
  label: string;
  color: string;
}

export const CATEGORIES: Record<EventCategory, CategoryConfig> = {
  social: { icon: '👥', label: '약속', color: '#FF9FF3' },
  work: { icon: '💼', label: '회의', color: '#54A0FF' },
  health: { icon: '💪', label: '운동', color: '#1DD1A1' },
  study: { icon: '📚', label: '공부', color: '#FECA57' },
  class: { icon: '🎓', label: '수업', color: '#5F27CD' },
  task: { icon: '📝', label: '과제', color: '#FF9F43' },
  personal: { icon: '👤', label: '개인', color: '#48DBFB' },
  other: { icon: '📌', label: '기타', color: '#CFD8DC' },
};

export const EVENT_COLORS = [
  '#FF6B6B', '#FF9F43', '#FECA57', '#48DBFB',
  '#1DD1A1', '#5F27CD', '#FF9FF3', '#54A0FF',
];

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
  category: EventCategory;
  description?: string;
  color?: string;
}
