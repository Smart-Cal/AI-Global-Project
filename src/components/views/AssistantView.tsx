import React, { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useGoalStore } from '../../store/goalStore';
import { useEventStore } from '../../store/eventStore';
import { useCategoryStore } from '../../store/categoryStore';
import {
  sendChatMessage,
  getConversations,
  getConversation,
  deleteConversation,
  confirmEvents,
  confirmTodos,
  confirmGoals,
  saveResultMessage,
  type Conversation,
  type Message,
  type PendingEvent,
  type PendingTodo,
  type PendingGoal,
  type MCPResponseData,
  type MCPPlaceResult,
  type MCPProductResult,
  type MCPNewsResult,
} from '../../services/api';
import DatePicker from '../DatePicker';
import TimePicker from '../TimePicker';
import { useToast } from '../Toast';
import type { Goal } from '../../types';

interface LocalMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  pending_events?: PendingEvent[];
  pending_todos?: PendingTodo[];
  pending_goals?: PendingGoal[];
  mcp_data?: MCPResponseData;  // MCP 데이터 ("행동하는 AI" 기능)
  created_at: string;
}

// 각 항목의 선택 상태
type ItemDecision = 'pending' | 'confirmed' | 'rejected';

interface DecisionState {
  [index: number]: ItemDecision;
}

// 호환성을 위한 alias
type EventDecision = ItemDecision;
type EventDecisionState = DecisionState;

const AssistantView: React.FC = () => {
  const { user } = useAuthStore();
  const { getActiveGoals } = useGoalStore();
  const { loadEvents, events } = useEventStore();
  const { categories, fetchCategories, addCategory } = useCategoryStore();
  const { showToast } = useToast();

  // Conversations state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<LocalMessage[]>([]);

  // Chat state
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [showGoalSelector, setShowGoalSelector] = useState(false);
  const [showConversationList, setShowConversationList] = useState(true);

  // Event confirmation state - 메시지 ID별로 관리
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [activeItemType, setActiveItemType] = useState<'event' | 'todo' | 'goal' | null>(null);
  const [eventDecisions, setEventDecisions] = useState<EventDecisionState>({});
  const [editingEvents, setEditingEvents] = useState<{ [index: number]: PendingEvent }>({});
  // useRef로 editingEvents의 최신 값을 항상 참조
  const editingEventsRef = useRef<{ [index: number]: PendingEvent }>({});

  // TODO confirmation state
  const [todoDecisions, setTodoDecisions] = useState<DecisionState>({});
  const [editingTodos, setEditingTodos] = useState<{ [index: number]: PendingTodo }>({});

  // Goal confirmation state
  const [goalDecisions, setGoalDecisions] = useState<DecisionState>({});
  const [editingGoals, setEditingGoals] = useState<{ [index: number]: PendingGoal }>({});

  const [isSaving, setIsSaving] = useState(false);
  const [completedResults, setCompletedResults] = useState<{
    messageId: string;
    type: 'event' | 'todo' | 'goal';
    confirmedCount: number;
    rejectedCount: number;
    items?: any[];
  } | null>(null);

  // 새 카테고리 추가 상태
  const [showNewCategoryInput, setShowNewCategoryInput] = useState<{
    type: 'event' | 'todo' | 'goal';
    index: number;
  } | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#6366f1');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [showColorPalette, setShowColorPalette] = useState(false);

  // 색상 팔레트
  const colorPalette = [
    '#ef4444', // 빨강
    '#f97316', // 주황
    '#f59e0b', // 노랑
    '#22c55e', // 초록
    '#14b8a6', // 청록
    '#3b82f6', // 파랑
    '#6366f1', // 남색
    '#8b5cf6', // 보라
    '#ec4899', // 분홍
    '#6b7280', // 회색
  ];

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeGoals = getActiveGoals();

  // Load conversations and categories on mount
  useEffect(() => {
    loadConversations();
    fetchCategories();
  }, []);

  // 디버깅: 카테고리 상태 확인
  useEffect(() => {
    console.log('[AssistantView] Categories updated:', categories);
  }, [categories]);

  const loadConversations = async () => {
    try {
      const response = await getConversations();
      setConversations(response.conversations);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  };

  const loadConversation = async (id: string) => {
    try {
      const response = await getConversation(id);
      setCurrentConversationId(id);
      setMessages(response.messages.map((m: Message) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        pending_events: m.pending_events,
        pending_todos: m.pending_todos,
        pending_goals: m.pending_goals,
        created_at: m.created_at,
      })));
      resetConfirmationState();
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  const resetConfirmationState = () => {
    setActiveMessageId(null);
    setActiveItemType(null);
    setEventDecisions({});
    setEditingEvents({});
    editingEventsRef.current = {}; // ref도 초기화
    setTodoDecisions({});
    setEditingTodos({});
    setGoalDecisions({});
    setEditingGoals({});
    setCompletedResults(null);
  };

  const handleNewConversation = () => {
    setCurrentConversationId(null);
    setMessages([]);
    resetConfirmationState();
  };

  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('이 대화를 삭제하시겠습니까?')) return;

    try {
      await deleteConversation(id);
      setConversations(prev => prev.filter(c => c.id !== id));
      if (currentConversationId === id) {
        handleNewConversation();
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, activeMessageId, completedResults]);

  // Send message
  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    let messageContent = input.trim();
    if (selectedGoal) {
      messageContent = `[목표: ${selectedGoal.title}] ${messageContent}`;
    }

    // Add user message locally
    const userMessage: LocalMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setCompletedResults(null);

    try {
      const response = await sendChatMessage(messageContent, currentConversationId || undefined, 'auto');

      // 디버깅: API 응답 확인
      console.log('[AssistantView] API Response:', response);
      console.log('[AssistantView] pending_goals:', response.pending_goals);
      console.log('[AssistantView] pending_events:', response.pending_events);
      console.log('[AssistantView] pending_todos:', response.pending_todos);

      // Update conversation ID if new
      if (!currentConversationId) {
        setCurrentConversationId(response.conversation_id);
        loadConversations();
      }

      // Determine content message based on what's pending
      let contentMessage = response.message;
      if (response.pending_events && response.pending_events.length > 0) {
        contentMessage = '아래와 같은 일정은 어떠세요?';
      } else if (response.pending_todos && response.pending_todos.length > 0) {
        contentMessage = '아래와 같은 할 일은 어떠세요?';
      } else if (response.pending_goals && response.pending_goals.length > 0) {
        contentMessage = '아래와 같은 목표는 어떠세요?';
      }

      // Add assistant message
      const assistantMessage: LocalMessage = {
        id: response.message_id,
        role: 'assistant',
        content: contentMessage,
        pending_events: response.pending_events,
        pending_todos: response.pending_todos,
        pending_goals: response.pending_goals,
        mcp_data: response.mcp_data,  // MCP 데이터 추가
        created_at: new Date().toISOString(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Set up confirmation UI based on type
      resetConfirmationState();
      if (response.pending_events && response.pending_events.length > 0) {
        setActiveMessageId(response.message_id);
        setActiveItemType('event');
      } else if (response.pending_todos && response.pending_todos.length > 0) {
        setActiveMessageId(response.message_id);
        setActiveItemType('todo');
      } else if (response.pending_goals && response.pending_goals.length > 0) {
        setActiveMessageId(response.message_id);
        setActiveItemType('goal');
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: '죄송합니다. 오류가 발생했습니다. 다시 시도해주세요.',
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Event decision handlers
  const handleEventDecision = (index: number, decision: EventDecision) => {
    setEventDecisions(prev => ({ ...prev, [index]: decision }));
  };

  const handleEditEvent = (index: number, field: keyof PendingEvent, value: string | number) => {
    console.log('[handleEditEvent] Called with:', { index, field, value, activeMessageId });
    const currentEvents = messages.find(m => m.id === activeMessageId)?.pending_events || [];
    console.log('[handleEditEvent] currentEvents:', currentEvents);
    // editingEventsRef에서 최신 값을 가져옴
    const currentEvent = editingEventsRef.current[index] || currentEvents[index];
    console.log('[handleEditEvent] currentEvent:', currentEvent);
    if (!currentEvent) {
      console.error('[handleEditEvent] No currentEvent found!');
      return;
    }
    const updatedEvent = { ...currentEvent, [field]: value };
    console.log('[handleEditEvent] updatedEvent:', updatedEvent);

    // ref를 먼저 업데이트 (동기적)
    editingEventsRef.current = {
      ...editingEventsRef.current,
      [index]: updatedEvent
    };
    console.log('[handleEditEvent] Updated editingEventsRef:', editingEventsRef.current);

    // 상태도 업데이트 (UI 리렌더링용)
    setEditingEvents(prev => {
      const newState = {
        ...prev,
        [index]: updatedEvent
      };
      console.log('[handleEditEvent] New editingEvents state:', newState);
      return newState;
    });
  };

  // datetime에서 날짜 부분만 추출 (YYYY-MM-DD)
  const getDateFromDatetime = (datetime: string): string => {
    return datetime.split('T')[0];
  };

  // datetime에서 시간 부분만 추출 (HH:mm)
  const getTimeFromDatetime = (datetime: string): string => {
    const timePart = datetime.split('T')[1];
    return timePart ? timePart.slice(0, 5) : '';
  };

  // 날짜와 시간을 합쳐서 datetime 생성
  const combineDatetime = (date: string, time: string): string => {
    return `${date}T${time}:00`;
  };

  // duration을 시간과 분으로 분리
  const getDurationHours = (duration: number): number => {
    return Math.floor(duration / 60);
  };

  const getDurationMinutes = (duration: number): number => {
    return duration % 60;
  };

  // 시간과 분을 합쳐서 duration(분) 생성
  const combineDuration = (hours: number, minutes: number): number => {
    return hours * 60 + minutes;
  };

  const getEventWithEdits = (index: number, originalEvent: PendingEvent): PendingEvent => {
    // editingEventsRef에서 최신 값을 가져옴 (클로저 문제 방지)
    const edited = editingEventsRef.current[index];
    console.log('[getEventWithEdits] index:', index, 'edited:', edited, 'original:', originalEvent);
    return edited || originalEvent;
  };

  // 모든 일정이 처리되었는지 확인
  const allEventsProcessed = (pendingEvents: PendingEvent[]) => {
    return pendingEvents.every((_, index) =>
      eventDecisions[index] === 'confirmed' || eventDecisions[index] === 'rejected'
    );
  };

  // 최종 확정 처리 - Events
  const handleFinalConfirmEvents = async (pendingEvents: PendingEvent[]) => {
    setIsSaving(true);

    const confirmedEvents: PendingEvent[] = [];
    const rejectedCount = Object.values(eventDecisions).filter(d => d === 'rejected').length;

    console.log('[handleFinalConfirmEvents] editingEvents:', editingEvents);
    console.log('[handleFinalConfirmEvents] pendingEvents:', pendingEvents);

    for (let i = 0; i < pendingEvents.length; i++) {
      if (eventDecisions[i] === 'confirmed') {
        const eventWithEdits = getEventWithEdits(i, pendingEvents[i]);
        console.log(`[handleFinalConfirmEvents] Event ${i} with edits:`, eventWithEdits);
        confirmedEvents.push(eventWithEdits);
      }
    }

    console.log('[handleFinalConfirmEvents] confirmedEvents to save:', confirmedEvents);

    try {
      if (confirmedEvents.length > 0) {
        await confirmEvents(confirmedEvents);
        loadEvents();
      }

      // 결과 메시지 생성
      let resultContent = '';
      if (confirmedEvents.length > 0) {
        resultContent = `${confirmedEvents.length}개의 일정이 추가되었습니다.`;
        if (rejectedCount > 0) {
          resultContent += ` (${rejectedCount}개 거절)`;
        }
      } else {
        resultContent = '일정이 추가되지 않았습니다.';
        if (rejectedCount > 0) {
          resultContent += ` (${rejectedCount}개 거절)`;
        }
      }

      // 결과 메시지를 대화 기록에 저장
      if (currentConversationId) {
        const savedResult = await saveResultMessage(currentConversationId, resultContent);

        // 결과 메시지를 로컬 메시지 목록에 추가
        const resultMessage: LocalMessage = {
          id: savedResult.message_id,
          role: 'assistant',
          content: resultContent,
          created_at: new Date().toISOString(),
        };
        setMessages(prev => [...prev, resultMessage]);
      }

      // 결과 표시 (UI용)
      setCompletedResults({
        messageId: activeMessageId!,
        type: 'event',
        confirmedCount: confirmedEvents.length,
        rejectedCount,
        items: confirmedEvents,
      });

      // 상태 초기화
      resetConfirmationState();

      // 토스트 알림
      if (confirmedEvents.length > 0) {
        showToast(`${confirmedEvents.length}개의 일정이 추가되었습니다`, 'success');
      }
    } catch (error) {
      console.error('Failed to save events:', error);
      showToast('일정 저장에 실패했습니다', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // 최종 확정 처리 - TODOs
  const handleFinalConfirmTodos = async (pendingTodos: PendingTodo[]) => {
    setIsSaving(true);

    const confirmedTodos: PendingTodo[] = [];
    const rejectedCount = Object.values(todoDecisions).filter(d => d === 'rejected').length;

    for (let i = 0; i < pendingTodos.length; i++) {
      if (todoDecisions[i] === 'confirmed') {
        const todoWithEdits = editingTodos[i] || pendingTodos[i];
        confirmedTodos.push(todoWithEdits);
      }
    }

    try {
      if (confirmedTodos.length > 0) {
        await confirmTodos(confirmedTodos);
      }

      // 결과 메시지 생성
      let resultContent = '';
      if (confirmedTodos.length > 0) {
        resultContent = `${confirmedTodos.length}개의 할 일이 추가되었습니다.`;
        if (rejectedCount > 0) {
          resultContent += ` (${rejectedCount}개 거절)`;
        }
      } else {
        resultContent = '할 일이 추가되지 않았습니다.';
        if (rejectedCount > 0) {
          resultContent += ` (${rejectedCount}개 거절)`;
        }
      }

      // 결과 메시지를 대화 기록에 저장
      if (currentConversationId) {
        const savedResult = await saveResultMessage(currentConversationId, resultContent);
        const resultMessage: LocalMessage = {
          id: savedResult.message_id,
          role: 'assistant',
          content: resultContent,
          created_at: new Date().toISOString(),
        };
        setMessages(prev => [...prev, resultMessage]);
      }

      setCompletedResults({
        messageId: activeMessageId!,
        type: 'todo',
        confirmedCount: confirmedTodos.length,
        rejectedCount,
        items: confirmedTodos,
      });

      resetConfirmationState();

      // 토스트 알림
      if (confirmedTodos.length > 0) {
        showToast(`${confirmedTodos.length}개의 할 일이 추가되었습니다`, 'success');
      }
    } catch (error) {
      console.error('Failed to save todos:', error);
      showToast('할 일 저장에 실패했습니다', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // 최종 확정 처리 - Goals
  const handleFinalConfirmGoals = async (pendingGoals: PendingGoal[]) => {
    setIsSaving(true);

    const confirmedGoals: PendingGoal[] = [];
    const rejectedCount = Object.values(goalDecisions).filter(d => d === 'rejected').length;

    for (let i = 0; i < pendingGoals.length; i++) {
      if (goalDecisions[i] === 'confirmed') {
        const goalWithEdits = editingGoals[i] || pendingGoals[i];
        confirmedGoals.push(goalWithEdits);
      }
    }

    try {
      if (confirmedGoals.length > 0) {
        await confirmGoals(confirmedGoals);
      }

      // 결과 메시지 생성
      let resultContent = '';
      if (confirmedGoals.length > 0) {
        resultContent = `${confirmedGoals.length}개의 목표가 추가되었습니다.`;
        if (rejectedCount > 0) {
          resultContent += ` (${rejectedCount}개 거절)`;
        }
      } else {
        resultContent = '목표가 추가되지 않았습니다.';
        if (rejectedCount > 0) {
          resultContent += ` (${rejectedCount}개 거절)`;
        }
      }

      // 결과 메시지를 대화 기록에 저장
      if (currentConversationId) {
        const savedResult = await saveResultMessage(currentConversationId, resultContent);
        const resultMessage: LocalMessage = {
          id: savedResult.message_id,
          role: 'assistant',
          content: resultContent,
          created_at: new Date().toISOString(),
        };
        setMessages(prev => [...prev, resultMessage]);
      }

      setCompletedResults({
        messageId: activeMessageId!,
        type: 'goal',
        confirmedCount: confirmedGoals.length,
        rejectedCount,
        items: confirmedGoals,
      });

      resetConfirmationState();

      // 토스트 알림
      if (confirmedGoals.length > 0) {
        showToast(`${confirmedGoals.length}개의 목표가 추가되었습니다`, 'success');
      }
    } catch (error) {
      console.error('Failed to save goals:', error);
      showToast('목표 저장에 실패했습니다', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // TODO decision handlers
  const handleTodoDecision = (index: number, decision: ItemDecision) => {
    setTodoDecisions(prev => ({ ...prev, [index]: decision }));
  };

  const handleEditTodo = (index: number, field: keyof PendingTodo, value: any) => {
    const currentTodos = messages.find(m => m.id === activeMessageId)?.pending_todos || [];
    const currentTodo = editingTodos[index] || currentTodos[index];
    setEditingTodos(prev => ({
      ...prev,
      [index]: { ...currentTodo, [field]: value }
    }));
  };

  // Goal decision handlers
  const handleGoalDecision = (index: number, decision: ItemDecision) => {
    setGoalDecisions(prev => ({ ...prev, [index]: decision }));
  };

  const handleEditGoal = (index: number, field: keyof PendingGoal, value: any) => {
    const currentGoals = messages.find(m => m.id === activeMessageId)?.pending_goals || [];
    const currentGoal = editingGoals[index] || currentGoals[index];
    setEditingGoals(prev => ({
      ...prev,
      [index]: { ...currentGoal, [field]: value }
    }));
  };

  // 모든 TODO가 처리되었는지 확인
  const allTodosProcessed = (pendingTodos: PendingTodo[]) => {
    return pendingTodos.every((_, index) =>
      todoDecisions[index] === 'confirmed' || todoDecisions[index] === 'rejected'
    );
  };

  // 모든 Goal이 처리되었는지 확인
  const allGoalsProcessed = (pendingGoals: PendingGoal[]) => {
    return pendingGoals.every((_, index) =>
      goalDecisions[index] === 'confirmed' || goalDecisions[index] === 'rejected'
    );
  };

  const formatEventDateTime = (datetime: string) => {
    // datetime을 직접 파싱하여 타임존 문제 방지
    // 형식: "YYYY-MM-DDTHH:mm:ss" 또는 "YYYY-MM-DDTHH:mm"
    const [datePart, timePart] = datetime.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes] = (timePart || '00:00').split(':').map(Number);

    // 요일 계산을 위해 로컬 날짜 객체 생성
    const date = new Date(year, month - 1, day);
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    const weekday = weekdays[date.getDay()];

    const ampm = hours < 12 ? '오전' : '오후';
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    const displayMinutes = (minutes || 0).toString().padStart(2, '0');

    return `${month}월 ${day}일 (${weekday}) ${ampm} ${displayHours}:${displayMinutes}`;
  };

  const formatShortDateTime = (datetime: string) => {
    // datetime을 직접 파싱하여 타임존 문제 방지
    const [datePart, timePart] = datetime.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes] = (timePart || '00:00').split(':').map(Number);

    // 요일 계산을 위해 로컬 날짜 객체 생성
    const date = new Date(year, month - 1, day);
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    const weekday = weekdays[date.getDay()];

    const ampm = hours < 12 ? '오전' : '오후';
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    const displayMinutes = (minutes || 0).toString().padStart(2, '0');

    return `${month}/${day}(${weekday}) ${ampm}${displayHours}:${displayMinutes}`;
  };

  // 시간 충돌 검사 함수
  const checkTimeConflict = (pendingEvent: PendingEvent) => {
    const eventDate = pendingEvent.datetime.split('T')[0];
    const eventStartTime = pendingEvent.datetime.split('T')[1]?.slice(0, 5) || '09:00';
    const duration = typeof pendingEvent.duration === 'string'
      ? parseInt(pendingEvent.duration)
      : pendingEvent.duration || 60;

    const [startH, startM] = eventStartTime.split(':').map(Number);
    const pendingStart = startH * 60 + startM;
    const pendingEnd = pendingStart + duration;

    const conflictingEvents = events.filter(existingEvent => {
      if (existingEvent.event_date !== eventDate) return false;
      if (!existingEvent.start_time || !existingEvent.end_time) return false;

      const [existH, existM] = existingEvent.start_time.split(':').map(Number);
      const [endH, endM] = existingEvent.end_time.split(':').map(Number);
      const existingStart = existH * 60 + existM;
      const existingEnd = endH * 60 + endM;

      return pendingStart < existingEnd && pendingEnd > existingStart;
    });

    return conflictingEvents;
  };

  // 새 카테고리 생성 핸들러
  const handleCreateCategory = async (type: 'event' | 'todo' | 'goal', index: number) => {
    // 이미 생성 중이면 중복 호출 방지
    if (isCreatingCategory) {
      console.log('[handleCreateCategory] Already creating, skipping...');
      return;
    }

    const categoryName = newCategoryName.trim();
    if (!categoryName) {
      showToast('카테고리 이름을 입력해주세요', 'error');
      return;
    }

    // 이미 존재하는 카테고리인지 확인
    const existingCategory = categories.find(
      cat => cat.name.toLowerCase() === categoryName.toLowerCase()
    );
    if (existingCategory) {
      console.log('[handleCreateCategory] Category already exists:', existingCategory);
      // 기존 카테고리를 선택
      if (type === 'event') {
        handleEditEvent(index, 'category', existingCategory.name);
      } else if (type === 'todo') {
        handleEditTodo(index, 'category', existingCategory.name);
      } else if (type === 'goal') {
        handleEditGoal(index, 'category', existingCategory.name);
      }
      showToast(`"${existingCategory.name}" 카테고리를 선택했습니다`, 'info');
      setShowNewCategoryInput(null);
      setNewCategoryName('');
      setNewCategoryColor('#6366f1');
      setShowColorPalette(false);
      return;
    }

    console.log('[handleCreateCategory] Creating category:', { type, index, name: categoryName, color: newCategoryColor });
    console.log('[handleCreateCategory] activeMessageId:', activeMessageId);

    setIsCreatingCategory(true);
    try {
      const newCategory = await addCategory(categoryName, newCategoryColor);
      console.log('[handleCreateCategory] Created category:', newCategory);

      // 생성된 카테고리를 해당 항목에 설정
      if (type === 'event') {
        console.log('[handleCreateCategory] Calling handleEditEvent for index:', index);
        handleEditEvent(index, 'category', newCategory.name);
      } else if (type === 'todo') {
        console.log('[handleCreateCategory] Calling handleEditTodo for index:', index);
        handleEditTodo(index, 'category', newCategory.name);
      } else if (type === 'goal') {
        console.log('[handleCreateCategory] Calling handleEditGoal for index:', index);
        handleEditGoal(index, 'category', newCategory.name);
      }

      showToast(`"${newCategory.name}" 카테고리가 생성되었습니다`, 'success');
      setShowNewCategoryInput(null);
      setNewCategoryName('');
      setNewCategoryColor('#6366f1');
      setShowColorPalette(false);
    } catch (error) {
      console.error('Failed to create category:', error);
      showToast('카테고리 생성에 실패했습니다', 'error');
    } finally {
      setIsCreatingCategory(false);
    }
  };

  // 카테고리 선택 컴포넌트 렌더링
  const renderCategorySelect = (
    type: 'event' | 'todo' | 'goal',
    index: number,
    currentValue: string | undefined,
    onChange: (value: string) => void,
    disabled: boolean
  ) => {
    const isAddingNew = showNewCategoryInput?.type === type && showNewCategoryInput?.index === index;

    if (isAddingNew) {
      return (
        <div style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: '6px',
          width: '100%',
          flexWrap: 'nowrap',
          height: '36px'
        }}>
          <input
            type="text"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="카테고리명"
            style={{
              flex: '1 1 auto',
              minWidth: '80px',
              height: '36px',
              padding: '8px 12px',
              fontSize: '14px',
              border: '1px solid var(--primary)',
              borderRadius: '6px',
              outline: 'none',
              boxSizing: 'border-box'
            }}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleCreateCategory(type, index);
              } else if (e.key === 'Escape') {
                setShowNewCategoryInput(null);
                setNewCategoryName('');
                setNewCategoryColor('#6366f1');
                setShowColorPalette(false);
              }
            }}
            disabled={isCreatingCategory}
          />
          {/* 색상 선택 버튼 */}
          <button
            type="button"
            style={{
              width: '36px',
              height: '36px',
              minWidth: '36px',
              padding: '4px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              cursor: 'pointer',
              backgroundColor: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxSizing: 'border-box'
            }}
            onClick={() => setShowColorPalette(!showColorPalette)}
            disabled={isCreatingCategory}
            title="색상 선택"
          >
            <span style={{
              width: '22px',
              height: '22px',
              borderRadius: '4px',
              backgroundColor: newCategoryColor,
              display: 'block'
            }} />
          </button>
          {/* 확인 버튼 */}
          <button
            style={{
              width: '36px',
              height: '36px',
              minWidth: '36px',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              backgroundColor: '#10b981',
              color: 'white',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxSizing: 'border-box'
            }}
            onClick={() => handleCreateCategory(type, index)}
            disabled={isCreatingCategory || !newCategoryName.trim()}
          >
            {isCreatingCategory ? '·' : '✓'}
          </button>
          {/* 취소 버튼 */}
          <button
            style={{
              width: '36px',
              height: '36px',
              minWidth: '36px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              cursor: 'pointer',
              backgroundColor: '#f3f4f6',
              color: '#6b7280',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxSizing: 'border-box'
            }}
            onClick={() => {
              setShowNewCategoryInput(null);
              setNewCategoryName('');
              setNewCategoryColor('#6366f1');
              setShowColorPalette(false);
            }}
            disabled={isCreatingCategory}
          >
            ✕
          </button>
          {/* 색상 팔레트 드롭다운 */}
          {showColorPalette && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: '4px',
              padding: '8px',
              backgroundColor: 'white',
              border: '1px solid #ddd',
              borderRadius: '6px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              display: 'flex',
              gap: '6px',
              flexWrap: 'wrap',
              zIndex: 100,
              width: 'max-content'
            }}>
              {colorPalette.map((color) => (
                <button
                  key={color}
                  type="button"
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '4px',
                    backgroundColor: color,
                    border: newCategoryColor === color ? '2px solid #333' : '2px solid transparent',
                    cursor: 'pointer',
                    padding: 0,
                    outline: 'none',
                    boxShadow: newCategoryColor === color ? '0 0 0 2px white, 0 0 0 4px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.1)'
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setNewCategoryColor(color);
                    setShowColorPalette(false);
                  }}
                  disabled={isCreatingCategory}
                  title={color}
                />
              ))}
            </div>
          )}
        </div>
      );
    }

    const selectedCategory = categories.find(cat => cat.name === currentValue);

    return (
      <div className="category-select-wrapper">
        <div
          className="category-select-current"
          style={{ borderLeftColor: selectedCategory?.color || 'transparent' }}
        >
          {selectedCategory && (
            <span
              className="category-color-box"
              style={{ backgroundColor: selectedCategory.color }}
            />
          )}
          <select
            value={currentValue || ''}
            onChange={(e) => {
              console.log('[renderCategorySelect] onChange:', { type, index, value: e.target.value });
              if (e.target.value === '__new__') {
                setShowNewCategoryInput({ type, index });
                setNewCategoryName('');
              } else {
                console.log('[renderCategorySelect] Calling onChange callback with:', e.target.value);
                onChange(e.target.value);
              }
            }}
            disabled={disabled}
          >
            <option value="">선택</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.name}>{cat.name}</option>
            ))}
            <option value="__new__">+ 새 카테고리 추가</option>
          </select>
        </div>
      </div>
    );
  };

  // 일정 카드 렌더링 (인라인)
  const renderEventCard = (event: PendingEvent, index: number, isActive: boolean) => {
    const eventWithEdits = getEventWithEdits(index, event);
    const decision = eventDecisions[index];
    const conflicts = checkTimeConflict(eventWithEdits);

    if (!isActive) {
      // 비활성 상태 - 간단한 표시
      return (
        <div key={index} className={`event-card-inline ${decision || ''}`}>
          <div className="event-card-inline-info">
            <span className="event-card-inline-title">{eventWithEdits.title}</span>
            <span className="event-card-inline-datetime">{formatShortDateTime(eventWithEdits.datetime)}</span>
            {eventWithEdits.category && (
              <span className="event-card-inline-category">{eventWithEdits.category}</span>
            )}
            {eventWithEdits.location && (
              <span className="event-card-inline-location">{eventWithEdits.location}</span>
            )}
          </div>
          {decision && (
            <span className={`event-decision-badge ${decision}`}>
              {decision === 'confirmed' ? '✓ 추가' : '✗ 거절'}
            </span>
          )}
        </div>
      );
    }

    // 활성 상태 - 편집 가능
    return (
      <div key={index} className={`event-card-editable ${decision || ''}`}>
        <div className="event-card-header">
          <span className="event-card-number">{index + 1}</span>
          <div className="event-card-quick-actions">
            <button
              className={`quick-action-btn confirm ${decision === 'confirmed' ? 'active' : ''}`}
              onClick={() => handleEventDecision(index, 'confirmed')}
              disabled={isSaving}
            >
              ✓
            </button>
            <button
              className={`quick-action-btn reject ${decision === 'rejected' ? 'active' : ''}`}
              onClick={() => handleEventDecision(index, 'rejected')}
              disabled={isSaving}
            >
              ✗
            </button>
          </div>
        </div>

        <div className="event-card-body">
          <div className="event-card-row">
            <label>제목</label>
            <input
              type="text"
              value={eventWithEdits.title}
              onChange={(e) => handleEditEvent(index, 'title', e.target.value)}
              disabled={decision === 'rejected'}
            />
          </div>

          <div className="event-card-row-group datetime-group">
            <div className="event-card-row">
              <label>날짜</label>
              <DatePicker
                value={getDateFromDatetime(eventWithEdits.datetime)}
                onChange={(date) => {
                  const time = getTimeFromDatetime(eventWithEdits.datetime) || '15:00';
                  handleEditEvent(index, 'datetime', combineDatetime(date, time));
                }}
              />
            </div>
            <div className="event-card-row">
              <label>시간</label>
              <TimePicker
                value={getTimeFromDatetime(eventWithEdits.datetime)}
                onChange={(time) => {
                  const date = getDateFromDatetime(eventWithEdits.datetime);
                  handleEditEvent(index, 'datetime', combineDatetime(date, time));
                }}
              />
            </div>
          </div>

          <div className="event-card-row-group">
            <div className="event-card-row duration-row">
              <label>소요시간</label>
              <div className="duration-inputs">
                <select
                  value={getDurationHours(typeof eventWithEdits.duration === 'string' ? parseInt(eventWithEdits.duration) : eventWithEdits.duration)}
                  onChange={(e) => {
                    const hours = parseInt(e.target.value);
                    const minutes = getDurationMinutes(typeof eventWithEdits.duration === 'string' ? parseInt(eventWithEdits.duration) : eventWithEdits.duration);
                    handleEditEvent(index, 'duration', combineDuration(hours, minutes));
                  }}
                  disabled={decision === 'rejected'}
                >
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(h => (
                    <option key={h} value={h}>{h}시간</option>
                  ))}
                </select>
                <select
                  value={getDurationMinutes(typeof eventWithEdits.duration === 'string' ? parseInt(eventWithEdits.duration) : eventWithEdits.duration)}
                  onChange={(e) => {
                    const minutes = parseInt(e.target.value);
                    const hours = getDurationHours(typeof eventWithEdits.duration === 'string' ? parseInt(eventWithEdits.duration) : eventWithEdits.duration);
                    handleEditEvent(index, 'duration', combineDuration(hours, minutes));
                  }}
                  disabled={decision === 'rejected'}
                >
                  {[0, 10, 15, 20, 30, 40, 45, 50].map(m => (
                    <option key={m} value={m}>{m}분</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="event-card-row half">
              <label>카테고리</label>
              {renderCategorySelect(
                'event',
                index,
                eventWithEdits.category,
                (value) => handleEditEvent(index, 'category', value),
                decision === 'rejected'
              )}
            </div>
          </div>

          <div className="event-card-row">
            <label>장소</label>
            <input
              type="text"
              value={eventWithEdits.location || ''}
              onChange={(e) => handleEditEvent(index, 'location', e.target.value)}
              placeholder="장소 입력 (선택)"
              disabled={decision === 'rejected'}
            />
          </div>

          {conflicts.length > 0 && (
            <div className="event-conflict-warning-inline">
              ⚠️ 겹치는 일정: {conflicts.map(c => c.title).join(', ')}
            </div>
          )}
        </div>
      </div>
    );
  };

  // TODO 카드 렌더링
  const renderTodoCard = (todo: PendingTodo, index: number, isActive: boolean) => {
    const todoWithEdits = editingTodos[index] || todo;
    const decision = todoDecisions[index];

    if (!isActive) {
      return (
        <div key={index} className={`todo-card-inline ${decision || ''}`}>
          <div className="todo-card-inline-info">
            <span className="todo-card-inline-title">{todoWithEdits.title}</span>
            <span className="todo-card-inline-duration">{todoWithEdits.duration}분</span>
            {todoWithEdits.category && (
              <span className="todo-card-inline-category">{todoWithEdits.category}</span>
            )}
            {todoWithEdits.priority && (
              <span className={`todo-card-inline-priority ${todoWithEdits.priority}`}>
                {todoWithEdits.priority === 'high' ? '높음' : todoWithEdits.priority === 'medium' ? '보통' : '낮음'}
              </span>
            )}
          </div>
          {decision && (
            <span className={`item-decision-badge ${decision}`}>
              {decision === 'confirmed' ? '✓ 추가' : '✗ 거절'}
            </span>
          )}
        </div>
      );
    }

    return (
      <div key={index} className={`todo-card-editable ${decision || ''}`}>
        <div className="item-card-header">
          <span className="item-card-number">{index + 1}</span>
          <div className="item-card-quick-actions">
            <button
              className={`quick-action-btn confirm ${decision === 'confirmed' ? 'active' : ''}`}
              onClick={() => handleTodoDecision(index, 'confirmed')}
              disabled={isSaving}
            >
              ✓
            </button>
            <button
              className={`quick-action-btn reject ${decision === 'rejected' ? 'active' : ''}`}
              onClick={() => handleTodoDecision(index, 'rejected')}
              disabled={isSaving}
            >
              ✗
            </button>
          </div>
        </div>

        <div className="item-card-body">
          <div className="item-card-row">
            <label>제목</label>
            <input
              type="text"
              value={todoWithEdits.title}
              onChange={(e) => handleEditTodo(index, 'title', e.target.value)}
              disabled={decision === 'rejected'}
            />
          </div>

          <div className="item-card-row-group">
            <div className="item-card-row">
              <label>소요시간</label>
              <div className="duration-inputs">
                <select
                  value={getDurationHours(todoWithEdits.duration)}
                  onChange={(e) => {
                    const hours = parseInt(e.target.value);
                    const minutes = getDurationMinutes(todoWithEdits.duration);
                    handleEditTodo(index, 'duration', combineDuration(hours, minutes));
                  }}
                  disabled={decision === 'rejected'}
                >
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(h => (
                    <option key={h} value={h}>{h}시간</option>
                  ))}
                </select>
                <select
                  value={getDurationMinutes(todoWithEdits.duration)}
                  onChange={(e) => {
                    const minutes = parseInt(e.target.value);
                    const hours = getDurationHours(todoWithEdits.duration);
                    handleEditTodo(index, 'duration', combineDuration(hours, minutes));
                  }}
                  disabled={decision === 'rejected'}
                >
                  {[0, 10, 15, 20, 30, 40, 45, 50].map(m => (
                    <option key={m} value={m}>{m}분</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="item-card-row">
              <label>우선순위</label>
              <select
                value={todoWithEdits.priority || 'medium'}
                onChange={(e) => handleEditTodo(index, 'priority', e.target.value)}
                disabled={decision === 'rejected'}
              >
                <option value="high">높음</option>
                <option value="medium">보통</option>
                <option value="low">낮음</option>
              </select>
            </div>
          </div>

          <div className="item-card-row">
            <label>카테고리</label>
            {renderCategorySelect(
              'todo',
              index,
              todoWithEdits.category,
              (value) => handleEditTodo(index, 'category', value),
              decision === 'rejected'
            )}
          </div>

          <div className="item-card-row">
            <label>설명</label>
            <input
              type="text"
              value={todoWithEdits.description || ''}
              onChange={(e) => handleEditTodo(index, 'description', e.target.value)}
              placeholder="설명 입력 (선택)"
              disabled={decision === 'rejected'}
            />
          </div>
        </div>
      </div>
    );
  };

  // Goal 카드 렌더링
  const renderGoalCard = (goal: PendingGoal, index: number, isActive: boolean) => {
    const goalWithEdits = editingGoals[index] || goal;
    const decision = goalDecisions[index];

    if (!isActive) {
      return (
        <div key={index} className={`goal-card-inline ${decision || ''}`}>
          <div className="goal-card-inline-info">
            <span className="goal-card-inline-title">{goalWithEdits.title}</span>
            {goalWithEdits.target_date && (
              <span className="goal-card-inline-date">~{goalWithEdits.target_date}</span>
            )}
            {goalWithEdits.priority && (
              <span className={`goal-card-inline-priority ${goalWithEdits.priority}`}>
                {goalWithEdits.priority === 'high' ? '높음' : goalWithEdits.priority === 'medium' ? '보통' : '낮음'}
              </span>
            )}
          </div>
          {decision && (
            <span className={`item-decision-badge ${decision}`}>
              {decision === 'confirmed' ? '✓ 추가' : '✗ 거절'}
            </span>
          )}
        </div>
      );
    }

    return (
      <div key={index} className={`goal-card-editable ${decision || ''}`}>
        <div className="item-card-header">
          <span className="item-card-number">{index + 1}</span>
          <div className="item-card-quick-actions">
            <button
              className={`quick-action-btn confirm ${decision === 'confirmed' ? 'active' : ''}`}
              onClick={() => handleGoalDecision(index, 'confirmed')}
              disabled={isSaving}
            >
              ✓
            </button>
            <button
              className={`quick-action-btn reject ${decision === 'rejected' ? 'active' : ''}`}
              onClick={() => handleGoalDecision(index, 'rejected')}
              disabled={isSaving}
            >
              ✗
            </button>
          </div>
        </div>

        <div className="item-card-body">
          <div className="item-card-row">
            <label>목표</label>
            <input
              type="text"
              value={goalWithEdits.title}
              onChange={(e) => handleEditGoal(index, 'title', e.target.value)}
              disabled={decision === 'rejected'}
            />
          </div>

          <div className="item-card-row-group">
            <div className="item-card-row">
              <label>목표일</label>
              <DatePicker
                value={goalWithEdits.target_date || ''}
                onChange={(date) => handleEditGoal(index, 'target_date', date)}
              />
            </div>

            <div className="item-card-row">
              <label>우선순위</label>
              <select
                value={goalWithEdits.priority || 'medium'}
                onChange={(e) => handleEditGoal(index, 'priority', e.target.value)}
                disabled={decision === 'rejected'}
              >
                <option value="high">높음</option>
                <option value="medium">보통</option>
                <option value="low">낮음</option>
              </select>
            </div>
          </div>

          <div className="item-card-row">
            <label>카테고리</label>
            {renderCategorySelect(
              'goal',
              index,
              goalWithEdits.category,
              (value) => handleEditGoal(index, 'category', value),
              decision === 'rejected'
            )}
          </div>

          <div className="item-card-row">
            <label>설명</label>
            <input
              type="text"
              value={goalWithEdits.description || ''}
              onChange={(e) => handleEditGoal(index, 'description', e.target.value)}
              placeholder="목표 설명 (선택)"
              disabled={decision === 'rejected'}
            />
          </div>

          {/* 세부 작업 표시 */}
          {goalWithEdits.decomposed_todos && goalWithEdits.decomposed_todos.length > 0 && (
            <div className="goal-decomposed-todos">
              <label>세부 작업 ({goalWithEdits.decomposed_todos.length}개)</label>
              <div className="decomposed-todo-list">
                {goalWithEdits.decomposed_todos.map((todo, idx) => (
                  <div key={idx} className="decomposed-todo-item">
                    <span className="decomposed-todo-order">{idx + 1}</span>
                    <span className="decomposed-todo-title">{todo.title}</span>
                    <span className="decomposed-todo-duration">{todo.duration}분</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // MCP 데이터 렌더링 ("행동하는 AI" 결과)
  const renderMCPData = (mcpData: MCPResponseData) => {
    const hasRestaurants = mcpData.restaurants && mcpData.restaurants.length > 0;
    const hasPlaces = mcpData.places && mcpData.places.length > 0;
    const hasProducts = mcpData.products && mcpData.products.length > 0;
    const hasGifts = mcpData.gifts && mcpData.gifts.length > 0;
    const hasNews = mcpData.news && mcpData.news.length > 0;
    const hasAvailableSlots = mcpData.availableSlots && mcpData.availableSlots.length > 0;

    if (!hasRestaurants && !hasPlaces && !hasProducts && !hasGifts && !hasNews && !hasAvailableSlots) {
      return null;
    }

    return (
      <div className="mcp-data-container">
        {/* 맛집/장소 추천 */}
        {(hasRestaurants || hasPlaces) && (
          <div className="mcp-section places-section">
            <h4 className="mcp-section-title">
              {hasRestaurants ? '🍽️ 맛집 추천' : '📍 장소 추천'}
            </h4>
            <div className="mcp-cards-slider">
              {(mcpData.restaurants || mcpData.places || []).map((place: MCPPlaceResult, idx: number) => (
                <div key={place.id || idx} className="mcp-card mcp-place-card">
                  {place.photos && place.photos[0] && (
                    <div className="mcp-card-image">
                      <img src={place.photos[0]} alt={place.name} />
                    </div>
                  )}
                  <div className="mcp-card-content">
                    <div className="mcp-card-rank">{idx + 1}</div>
                    <div className="mcp-card-title">{place.name}</div>
                    <div className="mcp-card-details">
                      {place.rating && <span className="mcp-rating">⭐ {place.rating}</span>}
                      {place.reviewCount && <span className="mcp-reviews">({place.reviewCount})</span>}
                      {place.priceLevel && <span className="mcp-price-level">{place.priceLevel}</span>}
                    </div>
                    <div className="mcp-card-address">{place.address}</div>
                    {place.distance && (
                      <div className="mcp-card-distance">
                        📍 {place.distance} {place.duration && `(${place.duration})`}
                      </div>
                    )}
                    {place.openNow !== undefined && (
                      <span className={`mcp-status ${place.openNow ? 'open' : 'closed'}`}>
                        {place.openNow ? '영업 중' : '영업 종료'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 상품/선물 추천 - 이미지 카드 형식 */}
        {(hasProducts || hasGifts) && (
          <div className="mcp-section products-section">
            <h4 className="mcp-section-title">
              {hasGifts ? '🎁 선물 추천' : '🛒 상품 추천'}
            </h4>
            <div className="mcp-cards-slider">
              {(mcpData.gifts || mcpData.products || []).map((product: MCPProductResult, idx: number) => {
                const imageUrl = product.imageUrl || product.image;
                const productLink = product.productUrl || product.link;
                const sellerName = product.seller || product.mall;

                return (
                  <a
                    key={product.id || idx}
                    href={productLink || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mcp-card mcp-product-card"
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    {imageUrl && (
                      <div className="mcp-card-image">
                        <img src={imageUrl} alt={product.title} />
                        {product.discountRate && product.discountRate > 0 && (
                          <span className="mcp-discount-badge">-{product.discountRate}%</span>
                        )}
                      </div>
                    )}
                    <div className="mcp-card-content">
                      <div className="mcp-card-title" title={product.title}>
                        {product.title.length > 40 ? product.title.substring(0, 40) + '...' : product.title}
                      </div>
                      <div className="mcp-card-price">
                        <span className="mcp-current-price">
                          {product.price.toLocaleString()}원
                        </span>
                        {product.originalPrice && product.originalPrice > product.price && (
                          <span className="mcp-original-price">
                            {product.originalPrice.toLocaleString()}원
                          </span>
                        )}
                      </div>
                      {product.rating && (
                        <div className="mcp-card-rating">
                          ⭐ {product.rating}
                          {product.reviewCount && <span className="mcp-review-count">({product.reviewCount})</span>}
                        </div>
                      )}
                      {sellerName && (
                        <div className="mcp-card-seller">
                          🏪 {sellerName}
                          {product.isFreeShipping && <span className="mcp-free-shipping">무료배송</span>}
                        </div>
                      )}
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {/* 뉴스 */}
        {hasNews && (
          <div className="mcp-section news-section">
            <h4 className="mcp-section-title">📰 뉴스</h4>
            <div className="mcp-cards-slider mcp-news-slider">
              {mcpData.news!.map((article, idx) => (
                <a
                  key={article.id || idx}
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mcp-card mcp-news-card"
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  {article.imageUrl && (
                    <div className="mcp-card-image mcp-news-image">
                      <img src={article.imageUrl} alt={article.title} />
                    </div>
                  )}
                  <div className="mcp-card-content">
                    <div className="mcp-card-title mcp-news-title">
                      {article.title.length > 60 ? article.title.substring(0, 60) + '...' : article.title}
                    </div>
                    {article.description && (
                      <div className="mcp-news-description">
                        {article.description.length > 80 ? article.description.substring(0, 80) + '...' : article.description}
                      </div>
                    )}
                    <div className="mcp-news-meta">
                      <span className="mcp-news-source">{article.source}</span>
                      {article.publishedAt && (
                        <span className="mcp-news-date">
                          {new Date(article.publishedAt).toLocaleDateString('ko-KR')}
                        </span>
                      )}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* 그룹 가능 시간 */}
        {hasAvailableSlots && (
          <div className="mcp-section schedule-section">
            <h4 className="mcp-section-title">📅 가능한 시간</h4>
            <div className="mcp-slots-list">
              {mcpData.availableSlots!.slice(0, 5).map((slot, idx) => (
                <div
                  key={idx}
                  className={`mcp-slot-card ${slot.allAvailable ? 'all-available' : 'partial'}`}
                >
                  <div className="mcp-slot-date">{slot.date}</div>
                  <div className="mcp-slot-time">{slot.startTime} - {slot.endTime}</div>
                  {slot.allAvailable ? (
                    <span className="mcp-slot-status available">✓ 모두 가능</span>
                  ) : (
                    <span className="mcp-slot-status partial">
                      ⚠️ {slot.unavailableMembers?.length || 0}명 불가
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 실행된 액션 표시 */}
        {mcpData.actions_taken && mcpData.actions_taken.length > 0 && (
          <div className="mcp-section actions-section">
            <h4 className="mcp-section-title">✅ 실행 완료</h4>
            <div className="mcp-actions-list">
              {mcpData.actions_taken.map((action, idx) => (
                <div
                  key={idx}
                  className={`mcp-action-item ${action.success ? 'success' : 'failed'}`}
                >
                  <span className="mcp-action-icon">{action.success ? '✓' : '✗'}</span>
                  <span className="mcp-action-name">{action.action}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // 결과 메시지 렌더링
  const renderCompletedResults = () => {
    if (!completedResults) return null;

    const { type, confirmedCount, rejectedCount, items } = completedResults;
    const typeLabels = { event: '일정', todo: '할 일', goal: '목표' };
    const typeLabel = typeLabels[type];

    return (
      <div className="chat-message assistant">
        <div className="message-bubble result-message">
          {confirmedCount > 0 ? (
            <>
              <div className="result-title">{confirmedCount}개의 {typeLabel}이 추가되었습니다!</div>
              {type === 'event' && items && (
                <div className="result-list">
                  {items.map((event: PendingEvent, idx: number) => (
                    <div key={idx} className="result-item">
                      <span className="result-item-title">{event.title}</span>
                      <span className="result-item-datetime">{formatShortDateTime(event.datetime)}</span>
                      {event.category && <span className="result-item-category">{event.category}</span>}
                      {event.location && <span className="result-item-location">{event.location}</span>}
                    </div>
                  ))}
                </div>
              )}
              {type === 'todo' && items && (
                <div className="result-list">
                  {items.map((todo: PendingTodo, idx: number) => (
                    <div key={idx} className="result-item">
                      <span className="result-item-title">{todo.title}</span>
                      <span className="result-item-duration">{todo.duration}분</span>
                    </div>
                  ))}
                </div>
              )}
              {type === 'goal' && items && (
                <div className="result-list">
                  {items.map((goal: PendingGoal, idx: number) => (
                    <div key={idx} className="result-item">
                      <span className="result-item-title">{goal.title}</span>
                      {goal.target_date && <span className="result-item-date">~{goal.target_date}</span>}
                      {goal.decomposed_todos && goal.decomposed_todos.length > 0 && (
                        <span className="result-item-todos">{goal.decomposed_todos.length}개 작업</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="result-title">{typeLabel}이 추가되지 않았습니다.</div>
          )}
          {rejectedCount > 0 && (
            <div className="result-rejected">{rejectedCount}개의 {typeLabel}은 거절되었습니다.</div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="assistant-view-container">
      {/* Conversation Sidebar */}
      <div className={`conversation-sidebar ${showConversationList ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <h3>대화 목록</h3>
          <button className="new-chat-btn" onClick={handleNewConversation}>
            + 새 대화
          </button>
        </div>
        <div className="conversation-list">
          {conversations.map(conv => (
            <div
              key={conv.id}
              className={`conversation-item ${currentConversationId === conv.id ? 'active' : ''}`}
              onClick={() => loadConversation(conv.id)}
            >
              <div className="conversation-title">{conv.title || '새 대화'}</div>
              <div className="conversation-date">
                {new Date(conv.updated_at).toLocaleDateString('ko-KR')}
              </div>
              <button
                className="delete-conversation-btn"
                onClick={(e) => handleDeleteConversation(conv.id, e)}
              >
                ×
              </button>
            </div>
          ))}
          {conversations.length === 0 && (
            <div className="no-conversations">대화 기록이 없습니다</div>
          )}
        </div>
      </div>

      {/* Toggle sidebar button */}
      <button
        className="toggle-sidebar-btn"
        onClick={() => setShowConversationList(!showConversationList)}
      >
        {showConversationList ? '◀' : '▶'}
      </button>

      {/* Main Chat Area */}
      <div className="assistant-view">
        {/* Chat Messages */}
        <div className="chat-messages">
          {messages.length === 0 ? (
            <div className="chat-welcome">
              <p>일정을 추가하거나 관리하고 싶은 내용을 말씀해주세요.</p>
              <div className="chat-welcome-examples">
                <div className="chat-welcome-example">"이번 주 운동 계획 세워줘"</div>
                <div className="chat-welcome-example">"내일 오후 3시 팀 미팅"</div>
                <div className="chat-welcome-example">"다음 주 공부 일정 추천해줘"</div>
              </div>
            </div>
          ) : (
            messages.map(msg => (
              <React.Fragment key={msg.id}>
                <div className={`chat-message ${msg.role}`}>
                  <div className="message-bubble">
                    {msg.content}
                  </div>
                </div>

                {/* MCP 데이터 표시 ("행동하는 AI" 결과) */}
                {msg.mcp_data && renderMCPData(msg.mcp_data)}

                {/* 일정 확인 UI - 메시지 바로 아래에 표시 */}
                {msg.pending_events && msg.pending_events.length > 0 && msg.id === activeMessageId && activeItemType === 'event' && (
                  <div className="item-confirmation-inline">
                    <div className="item-cards-container">
                      {msg.pending_events.map((event, index) =>
                        renderEventCard(event, index, true)
                      )}
                    </div>

                    {allEventsProcessed(msg.pending_events) && (
                      <div className="item-final-actions">
                        <button
                          className="btn-final-confirm"
                          onClick={() => handleFinalConfirmEvents(msg.pending_events!)}
                          disabled={isSaving}
                        >
                          {isSaving ? '저장 중...' : '확정하기'}
                        </button>
                      </div>
                    )}

                    {!allEventsProcessed(msg.pending_events) && (
                      <div className="item-pending-hint">
                        각 일정에서 ✓(추가) 또는 ✗(거절)를 선택해주세요
                      </div>
                    )}
                  </div>
                )}

                {/* TODO 확인 UI */}
                {msg.pending_todos && msg.pending_todos.length > 0 && msg.id === activeMessageId && activeItemType === 'todo' && (
                  <div className="item-confirmation-inline">
                    <div className="item-cards-container">
                      {msg.pending_todos.map((todo, index) =>
                        renderTodoCard(todo, index, true)
                      )}
                    </div>

                    {allTodosProcessed(msg.pending_todos) && (
                      <div className="item-final-actions">
                        <button
                          className="btn-final-confirm"
                          onClick={() => handleFinalConfirmTodos(msg.pending_todos!)}
                          disabled={isSaving}
                        >
                          {isSaving ? '저장 중...' : '확정하기'}
                        </button>
                      </div>
                    )}

                    {!allTodosProcessed(msg.pending_todos) && (
                      <div className="item-pending-hint">
                        각 할 일에서 ✓(추가) 또는 ✗(거절)를 선택해주세요
                      </div>
                    )}
                  </div>
                )}

                {/* Goal 확인 UI */}
                {msg.pending_goals && msg.pending_goals.length > 0 && msg.id === activeMessageId && activeItemType === 'goal' && (
                  <div className="item-confirmation-inline">
                    <div className="item-cards-container">
                      {msg.pending_goals.map((goal, index) =>
                        renderGoalCard(goal, index, true)
                      )}
                    </div>

                    {allGoalsProcessed(msg.pending_goals) && (
                      <div className="item-final-actions">
                        <button
                          className="btn-final-confirm"
                          onClick={() => handleFinalConfirmGoals(msg.pending_goals!)}
                          disabled={isSaving}
                        >
                          {isSaving ? '저장 중...' : '확정하기'}
                        </button>
                      </div>
                    )}

                    {!allGoalsProcessed(msg.pending_goals) && (
                      <div className="item-pending-hint">
                        각 목표에서 ✓(추가) 또는 ✗(거절)를 선택해주세요
                      </div>
                    )}
                  </div>
                )}

                {/* 결과 메시지 - 해당 메시지 아래에 표시 */}
                {completedResults && completedResults.messageId === msg.id && renderCompletedResults()}
              </React.Fragment>
            ))
          )}

          {isLoading && (
            <div className="chat-message assistant">
              <div className="message-bubble">
                <div className="typing-indicator">
                  <span className="typing-dot"></span>
                  <span className="typing-dot"></span>
                  <span className="typing-dot"></span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Selected Goal Indicator */}
        {selectedGoal && (
          <div className="selected-goal-bar">
            <span className="selected-goal-tag">
              [Goal] {selectedGoal.title}
              <button onClick={() => setSelectedGoal(null)}>×</button>
            </span>
          </div>
        )}

        {/* Input Area */}
        <div className="chat-input-area">
          <div className="chat-input-wrapper">
            <button
              className="chat-attach-btn"
              onClick={() => setShowGoalSelector(!showGoalSelector)}
              title="Goal 선택"
            >
              +
            </button>
            <input
              type="text"
              className="chat-input"
              placeholder="무엇이든 물어보세요... (일정, 할 일, 목표, 브리핑 등)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
            />
            <button
              className="chat-send-btn"
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
            >
              ↑
            </button>
          </div>
        </div>

        {/* Goal Selector Modal */}
        {showGoalSelector && (
          <div className="modal-overlay" onClick={() => setShowGoalSelector(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3 className="modal-title">Goal 선택</h3>
                <button className="modal-close" onClick={() => setShowGoalSelector(false)}>×</button>
              </div>
              <div className="modal-body">
                <div
                  className={`goal-selector-item ${!selectedGoal ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedGoal(null);
                    setShowGoalSelector(false);
                  }}
                >
                  <span>일반 대화</span>
                </div>
                {activeGoals.map(goal => (
                  <div
                    key={goal.id}
                    className={`goal-selector-item ${selectedGoal?.id === goal.id ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedGoal(goal);
                      setShowGoalSelector(false);
                    }}
                  >
                    <span>{goal.title}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AssistantView;
