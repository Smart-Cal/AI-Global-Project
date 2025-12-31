import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// ES module에서 __dirname 구하기
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .env 파일 경로를 명시적으로 지정
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { User, DBEvent, Todo, Goal, Category } from '../types/index.js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.warn('Warning: SUPABASE_URL or SUPABASE_SERVICE_KEY not set');
  console.warn('Attempted to load from:', path.resolve(__dirname, '../../.env'));
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

// ==============================================
// User Operations (구글 로그인 전용)
// ==============================================

export async function getUserById(id: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') throw new Error(`Failed to get user: ${error.message}`);
  return data;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

  if (error && error.code !== 'PGRST116') throw new Error(`Failed to get user: ${error.message}`);
  return data;
}

export async function updateUserLogin(userId: string): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) throw new Error(`Failed to update login: ${error.message}`);
}

export async function upsertGoogleUser(userData: {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
}): Promise<User> {
  const { data, error } = await supabase
    .from('users')
    .upsert({
      id: userData.id,
      email: userData.email,
      name: userData.name,
      nickname: userData.name,
      avatar_url: userData.avatar_url,
      is_active: true,
      last_login_at: new Date().toISOString()
    }, { onConflict: 'id' })
    .select()
    .single();

  if (error) throw new Error(`Failed to upsert google user: ${error.message}`);
  return data;
}

// ==============================================
// Event Operations
// ==============================================

export async function getEventsByUser(userId: string, startDate?: string, endDate?: string): Promise<DBEvent[]> {
  let query = supabase
    .from('events')
    .select('*')
    .eq('user_id', userId)
    .order('event_date', { ascending: true });

  if (startDate) {
    query = query.gte('event_date', startDate);
  }
  if (endDate) {
    query = query.lte('event_date', endDate);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to get events: ${error.message}`);
  return data || [];
}

export async function createEvent(event: Partial<DBEvent>): Promise<DBEvent> {
  const { data, error } = await supabase
    .from('events')
    .insert(event)
    .select()
    .single();

  if (error) throw new Error(`Failed to create event: ${error.message}`);
  return data;
}

export async function updateEvent(id: string, updates: Partial<DBEvent>): Promise<DBEvent> {
  const { data, error } = await supabase
    .from('events')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update event: ${error.message}`);
  return data;
}

export async function deleteEvent(id: string): Promise<void> {
  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', id);

  if (error) throw new Error(`Failed to delete event: ${error.message}`);
}

// ==============================================
// Todo Operations
// ==============================================

export async function getTodosByUser(userId: string): Promise<Todo[]> {
  const { data, error } = await supabase
    .from('todos')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to get todos: ${error.message}`);
  return data || [];
}

export async function createTodo(todo: Partial<Todo>): Promise<Todo> {
  const { data, error } = await supabase
    .from('todos')
    .insert(todo)
    .select()
    .single();

  if (error) throw new Error(`Failed to create todo: ${error.message}`);
  return data;
}

export async function updateTodo(id: string, updates: Partial<Todo>): Promise<Todo> {
  const { data, error } = await supabase
    .from('todos')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update todo: ${error.message}`);
  return data;
}

export async function deleteTodo(id: string): Promise<void> {
  const { error } = await supabase
    .from('todos')
    .delete()
    .eq('id', id);

  if (error) throw new Error(`Failed to delete todo: ${error.message}`);
}

export async function completeTodo(id: string): Promise<Todo> {
  return updateTodo(id, {
    is_completed: true,
    completed_at: new Date().toISOString()
  });
}

// ==============================================
// Goal Operations
// ==============================================

export async function getGoalsByUser(userId: string): Promise<Goal[]> {
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to get goals: ${error.message}`);
  return data || [];
}

export async function createGoal(goal: Partial<Goal>): Promise<Goal> {
  const { data, error } = await supabase
    .from('goals')
    .insert(goal)
    .select()
    .single();

  if (error) throw new Error(`Failed to create goal: ${error.message}`);
  return data;
}

export async function updateGoal(id: string, updates: Partial<Goal>): Promise<Goal> {
  const { data, error } = await supabase
    .from('goals')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update goal: ${error.message}`);
  return data;
}

export async function deleteGoal(id: string): Promise<void> {
  const { error } = await supabase
    .from('goals')
    .delete()
    .eq('id', id);

  if (error) throw new Error(`Failed to delete goal: ${error.message}`);
}

// ==============================================
// Category Operations
// ==============================================

export async function getCategoriesByUser(userId: string): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Failed to get categories: ${error.message}`);
  return data || [];
}

export async function createCategory(category: Partial<Category>): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .insert(category)
    .select()
    .single();

  if (error) throw new Error(`Failed to create category: ${error.message}`);
  return data;
}

export async function updateCategory(id: string, updates: Partial<Category>): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update category: ${error.message}`);
  return data;
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id);

  if (error) throw new Error(`Failed to delete category: ${error.message}`);
}

export async function getOrCreateDefaultCategory(userId: string): Promise<Category> {
  const { data } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId)
    .eq('is_default', true)
    .single();

  if (data) return data;

  return createCategory({
    user_id: userId,
    name: '기본',
    color: '#9CA3AF',
    is_default: true
  });
}
