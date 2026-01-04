import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// ES module에서 __dirname 구하기
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .env 파일 경로를 명시적으로 지정
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { User, Event, Todo, Goal, Category, Conversation, Message, LifeLog, Group, GroupMember, GroupInvitation } from '../types/index.js';

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

export async function getEventsByUser(userId: string, startDate?: string, endDate?: string): Promise<Event[]> {
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

export async function getEventById(id: string): Promise<Event | null> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') throw new Error(`Failed to get event: ${error.message}`);
  return data;
}

export async function getEventsByTodo(todoId: string): Promise<Event[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('related_todo_id', todoId)
    .order('event_date', { ascending: true });

  if (error) throw new Error(`Failed to get events by todo: ${error.message}`);
  return data || [];
}

export async function createEvent(event: Partial<Event>): Promise<Event> {
  const { data, error } = await supabase
    .from('events')
    .insert(event)
    .select()
    .single();

  if (error) throw new Error(`Failed to create event: ${error.message}`);

  // Todo와 연결된 경우, Goal의 total_estimated_time 업데이트
  if (event.related_todo_id) {
    await updateGoalEstimatedTimeFromTodo(event.related_todo_id);
  }

  return data;
}

export async function updateEvent(id: string, updates: Partial<Event>): Promise<Event> {
  const { data, error } = await supabase
    .from('events')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update event: ${error.message}`);
  return data;
}

/**
 * Event 완료 시 Todo와 Goal 진행률 업데이트
 */
export async function completeEvent(id: string): Promise<Event> {
  // 1. Event 완료 처리
  const event = await updateEvent(id, {
    is_completed: true,
    completed_at: new Date().toISOString()
  });

  // 2. 연결된 Todo가 있으면 completed_time 업데이트
  if (event.related_todo_id) {
    const duration = calculateEventDuration(event);
    await addTodoCompletedTime(event.related_todo_id, duration);
  }

  return event;
}

/**
 * Event duration 계산 (분 단위)
 */
function calculateEventDuration(event: Event): number {
  if (event.is_all_day || !event.start_time || !event.end_time) return 60; // 기본 1시간

  const [startHour, startMin] = event.start_time.split(':').map(Number);
  const [endHour, endMin] = event.end_time.split(':').map(Number);

  return (endHour * 60 + endMin) - (startHour * 60 + startMin);
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
  const todo = await updateTodo(id, {
    is_completed: true,
    completed_at: new Date().toISOString()
  });

  // Goal과 연결된 경우 진행률 업데이트
  if (todo.goal_id) {
    await recalculateGoalProgress(todo.goal_id);
  }

  return todo;
}

/**
 * Todo에 완료 시간 추가 (Event 완료 시 호출)
 */
export async function addTodoCompletedTime(todoId: string, minutes: number): Promise<Todo> {
  const todo = await getTodoById(todoId);
  if (!todo) throw new Error('Todo not found');

  const newCompletedTime = (todo.completed_time || 0) + minutes;
  const isNowCompleted = todo.estimated_time ? newCompletedTime >= todo.estimated_time : false;

  const updatedTodo = await updateTodo(todoId, {
    completed_time: newCompletedTime,
    is_completed: isNowCompleted,
    completed_at: isNowCompleted ? new Date().toISOString() : undefined
  });

  // Goal과 연결된 경우 진행률 업데이트
  if (updatedTodo.goal_id) {
    await recalculateGoalProgress(updatedTodo.goal_id);
  }

  return updatedTodo;
}

export async function getTodoById(id: string): Promise<Todo | null> {
  const { data, error } = await supabase
    .from('todos')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') throw new Error(`Failed to get todo: ${error.message}`);
  return data;
}

export async function getTodosByGoal(goalId: string): Promise<Todo[]> {
  const { data, error } = await supabase
    .from('todos')
    .select('*')
    .eq('goal_id', goalId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Failed to get todos by goal: ${error.message}`);
  return data || [];
}

// ==============================================
// Goal Operations
// ==============================================

export async function getGoalsByUser(userId: string): Promise<Goal[]> {
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .order('target_date', { ascending: true });

  if (error) throw new Error(`Failed to get goals: ${error.message}`);
  return data || [];
}

export async function getGoalById(id: string): Promise<Goal | null> {
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') throw new Error(`Failed to get goal: ${error.message}`);
  return data;
}

export async function createGoal(goal: Partial<Goal>): Promise<Goal> {
  const { data, error } = await supabase
    .from('goals')
    .insert({
      ...goal,
      status: goal.status || 'planning',
      total_estimated_time: goal.total_estimated_time || 0,
      completed_time: goal.completed_time || 0
    })
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

/**
 * Goal 진행률 재계산
 * - 연결된 모든 Todo의 completed_time 합산
 * - 연결된 모든 Todo의 estimated_time 합산
 * - 상태 자동 업데이트 (in_progress, completed)
 */
export async function recalculateGoalProgress(goalId: string): Promise<Goal> {
  const todos = await getTodosByGoal(goalId);

  const totalEstimatedTime = todos.reduce((sum, t) => sum + (t.estimated_time || 0), 0);
  const completedTime = todos.reduce((sum, t) => sum + (t.completed_time || 0), 0);

  // 상태 결정
  let status: Goal['status'] = 'planning';
  if (todos.length > 0) {
    const hasScheduledEvents = true; // TODO: Event 확인 로직 추가 가능
    if (completedTime > 0 && completedTime < totalEstimatedTime) {
      status = 'in_progress';
    } else if (totalEstimatedTime > 0 && completedTime >= totalEstimatedTime) {
      status = 'completed';
    } else if (hasScheduledEvents) {
      status = 'scheduled';
    }
  }

  return updateGoal(goalId, {
    total_estimated_time: totalEstimatedTime,
    completed_time: completedTime,
    status
  });
}

/**
 * Todo 생성/수정 시 Goal의 total_estimated_time 업데이트
 */
export async function updateGoalEstimatedTimeFromTodo(todoId: string): Promise<void> {
  const todo = await getTodoById(todoId);
  if (!todo?.goal_id) return;

  await recalculateGoalProgress(todo.goal_id);
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

// ==============================================
// Conversation Operations
// ==============================================

export async function getConversationsByUser(userId: string): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) throw new Error(`Failed to get conversations: ${error.message}`);
  return data || [];
}

export async function getConversationById(id: string): Promise<Conversation | null> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') throw new Error(`Failed to get conversation: ${error.message}`);
  return data;
}

export async function createConversation(userId: string, title?: string): Promise<Conversation> {
  const { data, error } = await supabase
    .from('conversations')
    .insert({
      user_id: userId,
      title: title || '새 대화',
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create conversation: ${error.message}`);
  return data;
}

export async function updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation> {
  const { data, error } = await supabase
    .from('conversations')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update conversation: ${error.message}`);
  return data;
}

export async function deleteConversation(id: string): Promise<void> {
  // 먼저 해당 대화의 메시지들 삭제
  await supabase.from('messages').delete().eq('conversation_id', id);

  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('id', id);

  if (error) throw new Error(`Failed to delete conversation: ${error.message}`);
}

// ==============================================
// Message Operations
// ==============================================

export async function getMessagesByConversation(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Failed to get messages: ${error.message}`);
  return data || [];
}

export async function createMessage(message: {
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  pending_events?: any;
  mcp_data?: any;
}): Promise<Message> {
  const { data, error } = await supabase
    .from('messages')
    .insert(message)
    .select()
    .single();

  if (error) throw new Error(`Failed to create message: ${error.message}`);

  // 대화 업데이트 시간 갱신
  await supabase
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', message.conversation_id);

  return data;
}

export async function updateMessagePendingEvents(messageId: string, pendingEvents: any): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .update({ pending_events: pendingEvents })
    .eq('id', messageId);

  if (error) throw new Error(`Failed to update message: ${error.message}`);
}

// ==============================================
// Group Operations
// ==============================================

export async function getGroupsByUser(userId: string): Promise<Group[]> {
  // 사용자가 멤버인 그룹 목록 조회
  const { data: memberships, error: memberError } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId);

  if (memberError) throw new Error(`Failed to get group memberships: ${memberError.message}`);

  if (!memberships || memberships.length === 0) return [];

  const groupIds = memberships.map(m => m.group_id);

  const { data, error } = await supabase
    .from('groups')
    .select('*')
    .in('id', groupIds)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to get groups: ${error.message}`);
  return data || [];
}

export async function getGroupById(id: string): Promise<Group | null> {
  const { data, error } = await supabase
    .from('groups')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') throw new Error(`Failed to get group: ${error.message}`);
  return data;
}

export async function createGroup(name: string, creatorId: string): Promise<Group> {
  // 1. 그룹 생성
  const { data: group, error: groupError } = await supabase
    .from('groups')
    .insert({ name, created_by: creatorId })
    .select()
    .single();

  if (groupError) throw new Error(`Failed to create group: ${groupError.message}`);

  // 2. 생성자를 owner로 추가
  const { error: memberError } = await supabase
    .from('group_members')
    .insert({
      group_id: group.id,
      user_id: creatorId,
      role: 'owner'
    });

  if (memberError) throw new Error(`Failed to add owner to group: ${memberError.message}`);

  return group;
}

export async function updateGroup(id: string, updates: Partial<Group>): Promise<Group> {
  const { data, error } = await supabase
    .from('groups')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update group: ${error.message}`);
  return data;
}

export async function deleteGroup(id: string): Promise<void> {
  // 관련 데이터 순차 삭제
  await supabase.from('group_invitations').delete().eq('group_id', id);
  await supabase.from('group_members').delete().eq('group_id', id);

  const { error } = await supabase
    .from('groups')
    .delete()
    .eq('id', id);

  if (error) throw new Error(`Failed to delete group: ${error.message}`);
}

// ==============================================
// Group Member Operations
// ==============================================

export async function getGroupMembers(groupId: string): Promise<(GroupMember & { user?: User })[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select(`
      *,
      user:users(id, email, name, nickname, avatar_url, chronotype)
    `)
    .eq('group_id', groupId)
    .order('joined_at', { ascending: true });

  if (error) throw new Error(`Failed to get group members: ${error.message}`);
  return data || [];
}

export async function getGroupMember(groupId: string, userId: string): Promise<GroupMember | null> {
  const { data, error } = await supabase
    .from('group_members')
    .select('*')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') throw new Error(`Failed to get group member: ${error.message}`);
  return data;
}

export async function addGroupMember(groupId: string, userId: string, role: 'owner' | 'member' = 'member'): Promise<GroupMember> {
  const { data, error } = await supabase
    .from('group_members')
    .insert({
      group_id: groupId,
      user_id: userId,
      role
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to add group member: ${error.message}`);
  return data;
}

export async function removeGroupMember(groupId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId);

  if (error) throw new Error(`Failed to remove group member: ${error.message}`);
}

export async function isGroupOwner(groupId: string, userId: string): Promise<boolean> {
  const member = await getGroupMember(groupId, userId);
  return member?.role === 'owner';
}

export async function isGroupMember(groupId: string, userId: string): Promise<boolean> {
  const member = await getGroupMember(groupId, userId);
  return member !== null;
}

// ==============================================
// Group Invitation Operations
// ==============================================

export async function getInvitationsByGroup(groupId: string): Promise<GroupInvitation[]> {
  const { data, error } = await supabase
    .from('group_invitations')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to get invitations: ${error.message}`);
  return data || [];
}

export async function getInvitationsByUser(email: string): Promise<(GroupInvitation & { group?: Group })[]> {
  const { data, error } = await supabase
    .from('group_invitations')
    .select(`
      *,
      group:groups(id, name, created_by)
    `)
    .eq('invitee_email', email)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to get user invitations: ${error.message}`);
  return data || [];
}

export async function getInvitationById(id: string): Promise<GroupInvitation | null> {
  const { data, error } = await supabase
    .from('group_invitations')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') throw new Error(`Failed to get invitation: ${error.message}`);
  return data;
}

export async function createInvitation(groupId: string, inviterId: string, inviteeEmail: string): Promise<GroupInvitation> {
  // 이미 보낸 초대가 있는지 확인
  const { data: existing } = await supabase
    .from('group_invitations')
    .select('*')
    .eq('group_id', groupId)
    .eq('invitee_email', inviteeEmail)
    .eq('status', 'pending')
    .single();

  if (existing) {
    throw new Error('Invitation already sent to this email');
  }

  // 이미 멤버인지 확인
  const user = await getUserByEmail(inviteeEmail);
  if (user) {
    const isMember = await isGroupMember(groupId, user.id);
    if (isMember) {
      throw new Error('User is already a member of this group');
    }
  }

  const { data, error } = await supabase
    .from('group_invitations')
    .insert({
      group_id: groupId,
      inviter_id: inviterId,
      invitee_email: inviteeEmail,
      status: 'pending'
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create invitation: ${error.message}`);
  return data;
}

export async function respondToInvitation(invitationId: string, accept: boolean, userId: string): Promise<GroupInvitation> {
  const invitation = await getInvitationById(invitationId);
  if (!invitation) throw new Error('Invitation not found');
  if (invitation.status !== 'pending') throw new Error('Invitation already responded');

  const status = accept ? 'accepted' : 'declined';

  const { data, error } = await supabase
    .from('group_invitations')
    .update({
      status,
      responded_at: new Date().toISOString()
    })
    .eq('id', invitationId)
    .select()
    .single();

  if (error) throw new Error(`Failed to respond to invitation: ${error.message}`);

  // 수락한 경우 멤버로 추가
  if (accept) {
    await addGroupMember(invitation.group_id, userId, 'member');
  }

  return data;
}

export async function cancelInvitation(invitationId: string): Promise<void> {
  const { error } = await supabase
    .from('group_invitations')
    .delete()
    .eq('id', invitationId);

  if (error) throw new Error(`Failed to cancel invitation: ${error.message}`);
}

// ==============================================
// Group Schedule Matching
// ==============================================

/**
 * 그룹 멤버들의 공통 빈 시간대 찾기
 * @param groupId 그룹 ID
 * @param startDate 시작 날짜 (YYYY-MM-DD)
 * @param endDate 종료 날짜 (YYYY-MM-DD)
 * @param minDuration 최소 시간 (분)
 * @param workStartHour 업무 시작 시간 (기본 9)
 * @param workEndHour 업무 종료 시간 (기본 21)
 */
export async function findGroupAvailableSlots(
  groupId: string,
  startDate: string,
  endDate: string,
  minDuration: number = 60,
  workStartHour: number = 9,
  workEndHour: number = 21
): Promise<import('../types/index.js').GroupMatchSlot[]> {
  // 1. 그룹 멤버 목록 가져오기
  const members = await getGroupMembers(groupId);
  if (members.length === 0) return [];

  const memberIds = members.map(m => m.user_id);

  // 2. 모든 멤버의 일정 가져오기
  const allEvents: (Event & { user_id: string })[] = [];
  for (const memberId of memberIds) {
    const events = await getEventsByUser(memberId, startDate, endDate);
    allEvents.push(...events.map(e => ({ ...e, user_id: memberId })));
  }

  // 3. 날짜별로 가용 슬롯 계산
  const slots: import('../types/index.js').GroupMatchSlot[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    const dayEvents = allEvents.filter(e => e.event_date === dateStr);

    // 시간대별 바쁜 멤버 추적 (분 단위)
    const busyMap: Map<number, { fixed: string[]; flexible: string[] }> = new Map();

    for (let minute = workStartHour * 60; minute < workEndHour * 60; minute++) {
      busyMap.set(minute, { fixed: [], flexible: [] });
    }

    // 각 이벤트에 대해 해당 시간대 표시
    for (const event of dayEvents) {
      if (!event.start_time || !event.end_time) continue;

      const [startH, startM] = event.start_time.split(':').map(Number);
      const [endH, endM] = event.end_time.split(':').map(Number);
      const eventStart = startH * 60 + startM;
      const eventEnd = endH * 60 + endM;

      for (let m = eventStart; m < eventEnd; m++) {
        const slot = busyMap.get(m);
        if (slot) {
          if (event.is_fixed) {
            slot.fixed.push(event.user_id);
          } else {
            slot.flexible.push(event.user_id);
          }
        }
      }
    }

    // 연속 가용 슬롯 찾기
    let slotStart: number | null = null;
    let slotType: 'available' | 'negotiable' | null = null;
    let conflictingMembers: Set<string> = new Set();

    const closeSlot = (endMinute: number) => {
      if (slotStart !== null && slotType !== null) {
        const duration = endMinute - slotStart;
        if (duration >= minDuration) {
          const startTimeStr = `${Math.floor(slotStart / 60).toString().padStart(2, '0')}:${(slotStart % 60).toString().padStart(2, '0')}`;
          const endTimeStr = `${Math.floor(endMinute / 60).toString().padStart(2, '0')}:${(endMinute % 60).toString().padStart(2, '0')}`;

          slots.push({
            date: dateStr,
            start_time: startTimeStr,
            end_time: endTimeStr,
            type: slotType,
            conflicting_members: slotType === 'negotiable' ? Array.from(conflictingMembers) : undefined
          });
        }
      }
      slotStart = null;
      slotType = null;
      conflictingMembers = new Set();
    };

    for (let m = workStartHour * 60; m < workEndHour * 60; m++) {
      const slot = busyMap.get(m)!;
      const fixedCount = slot.fixed.length;
      const flexibleCount = slot.flexible.length;

      let currentType: 'available' | 'negotiable' | 'blocked';

      if (fixedCount > 0) {
        // 고정 일정이 있으면 해당 시간은 불가
        currentType = 'blocked';
      } else if (flexibleCount > 0) {
        // 유동 일정만 있으면 협의 가능
        currentType = 'negotiable';
      } else {
        // 아무도 바쁘지 않으면 가용
        currentType = 'available';
      }

      if (currentType === 'blocked') {
        closeSlot(m);
      } else if (slotType === null) {
        slotStart = m;
        slotType = currentType;
        if (currentType === 'negotiable') {
          slot.flexible.forEach(id => conflictingMembers.add(id));
        }
      } else if (slotType !== currentType) {
        closeSlot(m);
        slotStart = m;
        slotType = currentType;
        if (currentType === 'negotiable') {
          slot.flexible.forEach(id => conflictingMembers.add(id));
        }
      } else if (currentType === 'negotiable') {
        slot.flexible.forEach(id => conflictingMembers.add(id));
      }
    }

    closeSlot(workEndHour * 60);
  }

  return slots;
}

// ==============================================
// Life Log Operations
// ==============================================

export async function getLifeLogsByUser(userId: string, limit: number = 30): Promise<LifeLog[]> {
  const { data, error } = await supabase
    .from('life_logs')
    .select('*')
    .eq('user_id', userId)
    .order('log_date', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to get life logs: ${error.message}`);
  return data || [];
}

export async function getLifeLogByDate(userId: string, date: string): Promise<LifeLog | null> {
  const { data, error } = await supabase
    .from('life_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('log_date', date)
    .single();

  if (error && error.code !== 'PGRST116') throw new Error(`Failed to get life log: ${error.message}`);
  return data;
}

export async function getLifeLogById(id: string): Promise<LifeLog | null> {
  const { data, error } = await supabase
    .from('life_logs')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') throw new Error(`Failed to get life log: ${error.message}`);
  return data;
}

export async function createLifeLog(log: Partial<LifeLog>): Promise<LifeLog> {
  const { data, error } = await supabase
    .from('life_logs')
    .insert(log)
    .select()
    .single();

  if (error) throw new Error(`Failed to create life log: ${error.message}`);
  return data;
}

export async function updateLifeLog(id: string, updates: Partial<LifeLog>): Promise<LifeLog> {
  const { data, error } = await supabase
    .from('life_logs')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update life log: ${error.message}`);
  return data;
}

export async function deleteLifeLog(id: string): Promise<void> {
  const { error } = await supabase
    .from('life_logs')
    .delete()
    .eq('id', id);

  if (error) throw new Error(`Failed to delete life log: ${error.message}`);
}

export async function upsertLifeLog(log: Partial<LifeLog>): Promise<LifeLog> {
  if (!log.user_id || !log.log_date) {
    throw new Error('user_id and log_date are required');
  }

  // 해당 날짜의 기존 로그 확인
  const existing = await getLifeLogByDate(log.user_id, log.log_date);

  if (existing) {
    // 기존 로그 업데이트
    return updateLifeLog(existing.id, log);
  } else {
    // 새 로그 생성
    return createLifeLog(log);
  }
}
