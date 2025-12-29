import { createClient } from '@supabase/supabase-js';
import type { User, CalendarEvent } from '../types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || '';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Hash password (SHA256)
const hashPassword = async (password: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
};

// Auth functions
export const checkPhoneExists = async (phone: string): Promise<boolean> => {
  const { data } = await supabase.from('users').select('id').eq('phone', phone);
  return (data?.length || 0) > 0;
};

export const registerUser = async (
  phone: string, password: string, name: string, nickname: string
): Promise<User | null> => {
  const exists = await checkPhoneExists(phone);
  if (exists) throw new Error('이미 등록된 전화번호입니다.');

  const passwordHash = await hashPassword(password);
  const { data, error } = await supabase
    .from('users')
    .insert({ phone, password_hash: passwordHash, name, nickname, is_active: true })
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const loginUser = async (phone: string, password: string): Promise<User | null> => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('phone', phone)
    .eq('is_active', true)
    .single();

  if (error || !data) throw new Error('사용자를 찾을 수 없습니다.');

  const passwordHash = await hashPassword(password);
  if (passwordHash !== data.password_hash) {
    throw new Error('비밀번호가 올바르지 않습니다.');
  }

  await supabase.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', data.id);
  return data;
};

// Event functions
export const createEvent = async (event: Omit<CalendarEvent, 'id' | 'created_at'>): Promise<CalendarEvent | null> => {
  const { data, error } = await supabase.from('events').insert(event).select().single();
  if (error) throw error;
  return data;
};

export const updateEvent = async (eventId: string, updates: Partial<CalendarEvent>): Promise<CalendarEvent | null> => {
  const { data, error } = await supabase.from('events').update(updates).eq('id', eventId).select().single();
  if (error) throw error;
  return data;
};

export const deleteEvent = async (eventId: string): Promise<boolean> => {
  const { error } = await supabase.from('events').delete().eq('id', eventId);
  return !error;
};

export const getEventsByDateRange = async (
  userId: string, startDate: string, endDate: string
): Promise<CalendarEvent[]> => {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('user_id', userId)
    .gte('event_date', startDate)
    .lte('event_date', endDate)
    .order('event_date')
    .order('start_time');

  if (error) throw error;
  return data || [];
};

export const getMonthEvents = async (userId: string, year: number, month: number): Promise<CalendarEvent[]> => {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
  return getEventsByDateRange(userId, startDate, endDate);
};
