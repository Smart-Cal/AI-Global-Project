import { createClient } from '@supabase/supabase-js';
import type { User, CalendarEvent, Goal, Todo, Category } from '../types';

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

// =============================================
// Auth functions
// =============================================
export const checkPhoneExists = async (phone: string): Promise<boolean> => {
  const { data } = await supabase.from('users').select('id').eq('phone', phone);
  return (data?.length || 0) > 0;
};

export const registerUser = async (
  phone: string, password: string, name: string, nickname: string
): Promise<User | null> => {
  try {
    const exists = await checkPhoneExists(phone);
    if (exists) throw new Error('이미 등록된 전화번호입니다.');

    const passwordHash = await hashPassword(password);
    const { data, error } = await supabase
      .from('users')
      .insert({ phone, password_hash: passwordHash, name, nickname, is_active: true })
      .select()
      .single();

    if (error) {
      console.error('Supabase register error:', error);
      if (error.code === '23505') {
        throw new Error('이미 등록된 전화번호입니다.');
      }
      throw new Error(error.message || '회원가입 중 오류가 발생했습니다.');
    }
    return data;
  } catch (err) {
    if (err instanceof Error) {
      throw err;
    }
    throw new Error('회원가입 중 오류가 발생했습니다.');
  }
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

// =============================================
// Event functions
// =============================================
export const createEvent = async (event: Omit<CalendarEvent, 'id' | 'created_at'>): Promise<CalendarEvent | null> => {
  const { data, error } = await supabase.from('events').insert(event).select().single();
  if (error) {
    console.error('Supabase createEvent error:', error);
    throw error;
  }
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

// =============================================
// Goal functions
// =============================================
export const createGoal = async (goal: Omit<Goal, 'id' | 'created_at' | 'updated_at'>): Promise<Goal | null> => {
  const { data, error } = await supabase.from('goals').insert(goal).select().single();
  if (error) {
    console.error('Supabase createGoal error:', error);
    throw error;
  }
  return data;
};

export const updateGoal = async (goalId: string, updates: Partial<Goal>): Promise<Goal | null> => {
  const { data, error } = await supabase
    .from('goals')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', goalId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deleteGoal = async (goalId: string): Promise<boolean> => {
  const { error } = await supabase.from('goals').delete().eq('id', goalId);
  return !error;
};

export const getGoalsByUser = async (userId: string): Promise<Goal[]> => {
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

// =============================================
// Todo functions
// =============================================
export const createTodo = async (todo: Omit<Todo, 'id' | 'created_at'>): Promise<Todo | null> => {
  const { data, error } = await supabase.from('todos').insert(todo).select().single();
  if (error) {
    console.error('Supabase createTodo error:', error);
    throw error;
  }
  return data;
};

export const updateTodo = async (todoId: string, updates: Partial<Todo>): Promise<Todo | null> => {
  const { data, error } = await supabase
    .from('todos')
    .update(updates)
    .eq('id', todoId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deleteTodo = async (todoId: string): Promise<boolean> => {
  const { error } = await supabase.from('todos').delete().eq('id', todoId);
  return !error;
};

export const getTodosByUser = async (userId: string): Promise<Todo[]> => {
  const { data, error } = await supabase
    .from('todos')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

// =============================================
// Category functions
// =============================================
export const createCategory = async (category: Omit<Category, 'id' | 'created_at'>): Promise<Category | null> => {
  const { data, error } = await supabase.from('categories').insert(category).select().single();
  if (error) {
    console.error('Supabase createCategory error:', error);
    throw error;
  }
  return data;
};

export const updateCategory = async (categoryId: string, updates: Partial<Category>): Promise<Category | null> => {
  const { data, error } = await supabase
    .from('categories')
    .update(updates)
    .eq('id', categoryId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deleteCategory = async (categoryId: string): Promise<boolean> => {
  const { error } = await supabase.from('categories').delete().eq('id', categoryId);
  return !error;
};

export const getCategoriesByUser = async (userId: string): Promise<Category[]> => {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('name');

  if (error) throw error;
  return data || [];
};

export const createDefaultCategory = async (userId: string): Promise<Category | null> => {
  // 기본 카테고리가 이미 존재하는지 확인
  const { data: existing } = await supabase
    .from('categories')
    .select('id')
    .eq('user_id', userId)
    .eq('is_default', true)
    .single();

  if (existing) return existing as Category;

  // 기본 카테고리 생성
  return createCategory({
    user_id: userId,
    name: '기본',
    color: '#9CA3AF',
    is_default: true,
  });
};
