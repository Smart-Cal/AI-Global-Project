import { create } from 'zustand';
import type { CalendarEvent } from '../types';
import { createEvent, updateEvent, deleteEvent, getEventsByDateRange, getMonthEvents } from '../services/supabase';

interface EventState {
  events: CalendarEvent[];
  selectedDate: string;
  selectedMonth: number;
  selectedYear: number;
  isLoading: boolean;
  setSelectedDate: (date: string) => void;
  setMonth: (month: number, year: number) => void;
  loadMonthEvents: (userId: string, year: number, month: number) => Promise<void>;
  loadEventsRange: (userId: string, start: string, end: string) => Promise<void>;
  addEvent: (event: Omit<CalendarEvent, 'id' | 'created_at'>) => Promise<CalendarEvent | null>;
  editEvent: (id: string, updates: Partial<CalendarEvent>) => Promise<void>;
  removeEvent: (id: string) => Promise<void>;
  getEventsByDate: (date: string) => CalendarEvent[];
}

const today = new Date();

export const useEventStore = create<EventState>((set, get) => ({
  events: [],
  selectedDate: today.toISOString().split('T')[0],
  selectedMonth: today.getMonth() + 1,
  selectedYear: today.getFullYear(),
  isLoading: false,

  setSelectedDate: (date) => set({ selectedDate: date }),
  setMonth: (month, year) => set({ selectedMonth: month, selectedYear: year }),

  loadMonthEvents: async (userId, year, month) => {
    set({ isLoading: true });
    try {
      const events = await getMonthEvents(userId, year, month);
      set({ events });
    } finally {
      set({ isLoading: false });
    }
  },

  loadEventsRange: async (userId, start, end) => {
    set({ isLoading: true });
    try {
      const events = await getEventsByDateRange(userId, start, end);
      set({ events });
    } finally {
      set({ isLoading: false });
    }
  },

  addEvent: async (event) => {
    const newEvent = await createEvent(event);
    if (newEvent) {
      set((s) => ({
        events: [...s.events, newEvent].sort((a, b) => {
          if (a.event_date !== b.event_date) return a.event_date.localeCompare(b.event_date);
          return (a.start_time || '').localeCompare(b.start_time || '');
        }),
      }));
    }
    return newEvent;
  },

  editEvent: async (id, updates) => {
    const updated = await updateEvent(id, updates);
    if (updated) {
      set((s) => ({
        events: s.events.map((e) => (e.id === id ? updated : e)),
      }));
    }
  },

  removeEvent: async (id) => {
    const success = await deleteEvent(id);
    if (success) {
      set((s) => ({ events: s.events.filter((e) => e.id !== id) }));
    }
  },

  getEventsByDate: (date) => get().events.filter((e) => e.event_date === date),
}));
