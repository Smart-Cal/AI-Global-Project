import { create } from 'zustand';
import type { CalendarEvent } from '../types';
import * as api from '../services/api';

interface EventState {
  events: CalendarEvent[];
  selectedDate: string;
  selectedMonth: number;
  selectedYear: number;
  isLoading: boolean;
  setSelectedDate: (date: string) => void;
  setMonth: (month: number, year: number) => void;
  loadEvents: (startDate?: string, endDate?: string) => Promise<void>;
  loadMonthEvents: (userId: string, year: number, month: number) => Promise<void>;
  loadEventsRange: (userId: string, start: string, end: string) => Promise<void>;
  addEvent: (event: Omit<CalendarEvent, 'id' | 'created_at'>) => Promise<CalendarEvent | null>;
  editEvent: (id: string, updates: Partial<CalendarEvent>) => Promise<void>;
  removeEvent: (id: string) => Promise<void>;
  toggleComplete: (id: string) => Promise<void>;
  getEventsByDate: (date: string) => CalendarEvent[];
  getCompletedEvents: () => CalendarEvent[];
  getPendingEvents: () => CalendarEvent[];
  clearEvents: () => void;
}

const today = new Date();

// API Event를 CalendarEvent로 변환
function apiEventToCalendarEvent(event: api.Event): CalendarEvent {
  // datetime 문자열에서 직접 날짜와 시간 추출 (타임존 문제 방지)
  // datetime 형식: "2024-12-31T09:00:00" 또는 "2024-12-31T09:00"
  const eventDate = event.datetime.split('T')[0];
  const timePart = event.datetime.split('T')[1] || '09:00:00';
  const startTime = timePart.slice(0, 5);

  // duration을 기반으로 end_time 계산
  const [hours, minutes] = startTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + event.duration;
  const endHours = Math.floor(totalMinutes / 60) % 24;
  const endMinutes = totalMinutes % 60;
  const endTime = `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;

  return {
    id: event.id,
    user_id: event.user_id,
    category_id: event.category_id,
    title: event.title,
    description: event.description,
    event_date: eventDate,
    start_time: startTime,
    end_time: endTime,
    is_all_day: false,
    location: event.location,
    is_completed: event.is_completed,
    completed_at: event.completed_at,
    created_at: event.created_at,
  };
}

// CalendarEvent를 API Event로 변환
function calendarEventToApiEvent(event: Partial<CalendarEvent>): Partial<api.Event> {
  let datetime: string | undefined;
  let duration = 60;

  if (event.event_date) {
    const time = event.start_time || '09:00';
    datetime = `${event.event_date}T${time}:00`;

    // duration 계산
    if (event.start_time && event.end_time) {
      const start = new Date(`2000-01-01T${event.start_time}`);
      const end = new Date(`2000-01-01T${event.end_time}`);
      duration = Math.round((end.getTime() - start.getTime()) / 60000);
      if (duration <= 0) duration = 60;
    }
  }

  return {
    user_id: event.user_id,
    category_id: event.category_id,
    title: event.title,
    description: event.description,
    datetime,
    duration,
    type: 'personal',
    location: event.location,
    is_completed: event.is_completed,
  };
}

export const useEventStore = create<EventState>((set, get) => ({
  events: [],
  selectedDate: today.toISOString().split('T')[0],
  selectedMonth: today.getMonth() + 1,
  selectedYear: today.getFullYear(),
  isLoading: false,

  setSelectedDate: (date) => set({ selectedDate: date }),
  setMonth: (month, year) => set({ selectedMonth: month, selectedYear: year }),

  loadEvents: async (startDate, endDate) => {
    set({ isLoading: true });
    try {
      const response = await api.getEvents(startDate, endDate);
      const events = response.events.map(apiEventToCalendarEvent);
      set({ events });
    } finally {
      set({ isLoading: false });
    }
  },

  loadMonthEvents: async (_userId, year, month) => {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];
    await get().loadEvents(startDate, endDate);
  },

  loadEventsRange: async (_userId, start, end) => {
    await get().loadEvents(start, end);
  },

  addEvent: async (event) => {
    try {
      const apiEvent = calendarEventToApiEvent(event);
      const response = await api.createEvent(apiEvent);
      const newEvent = apiEventToCalendarEvent(response.event);

      set((s) => ({
        events: [...s.events, newEvent].sort((a, b) => {
          if (a.event_date !== b.event_date) return a.event_date.localeCompare(b.event_date);
          return (a.start_time || '').localeCompare(b.start_time || '');
        }),
      }));
      return newEvent;
    } catch (error) {
      console.error('Error in addEvent store:', error);
      throw error;
    }
  },

  editEvent: async (id, updates) => {
    try {
      const apiUpdates = calendarEventToApiEvent(updates);
      const response = await api.updateEvent(id, apiUpdates);
      const updated = apiEventToCalendarEvent(response.event);

      set((s) => ({
        events: s.events.map((e) => (e.id === id ? { ...e, ...updated } : e)),
      }));
    } catch (error) {
      console.error('Error in editEvent store:', error);
    }
  },

  removeEvent: async (id) => {
    try {
      await api.deleteEvent(id);
      set((s) => ({ events: s.events.filter((e) => e.id !== id) }));
    } catch (error) {
      console.error('Error in removeEvent store:', error);
    }
  },

  toggleComplete: async (id) => {
    const event = get().events.find((e) => e.id === id);
    if (!event) return;

    const newIsCompleted = !event.is_completed;

    // 낙관적 업데이트: API 호출 전에 먼저 UI 업데이트
    set((s) => ({
      events: s.events.map((e) =>
        e.id === id ? { ...e, is_completed: newIsCompleted } : e
      ),
    }));

    try {
      const response = await api.completeEvent(id, newIsCompleted);
      const updated = apiEventToCalendarEvent(response.event);

      // API 응답으로 정확한 데이터로 동기화
      set((s) => ({
        events: s.events.map((e) => (e.id === id ? updated : e)),
      }));
    } catch (error) {
      console.error('Error in toggleComplete store:', error);
      // 에러 발생 시 롤백
      set((s) => ({
        events: s.events.map((e) =>
          e.id === id ? { ...e, is_completed: !newIsCompleted } : e
        ),
      }));
    }
  },

  getEventsByDate: (date) => get().events.filter((e) => e.event_date === date),

  getCompletedEvents: () => get().events.filter((e) => e.is_completed),

  getPendingEvents: () => get().events.filter((e) => !e.is_completed),

  clearEvents: () => set({ events: [] }),
}));
