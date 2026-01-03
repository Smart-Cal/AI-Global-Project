import React, { useState, useRef, useEffect } from 'react';
import { useEventStore } from '../store/eventStore';
import { useGoalStore, calculateGoalProgress } from '../store/goalStore';
import { useTodoStore } from '../store/todoStore';
import { useAuthStore } from '../store/authStore';
import { useCategoryStore } from '../store/categoryStore';
import { sendChatMessage, ChatResponse } from '../services/api';
import { DEFAULT_CATEGORY_COLOR, type CalendarEvent, type Goal, type AgentMessage, type SuggestedEvent } from '../types';

interface DashboardProps {
  onEventClick: (event: CalendarEvent) => void;
  onGoalClick: (goal: Goal) => void;
  onViewChange: (view: 'calendar' | 'goals' | 'todos') => void;
  onOpenChat: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onEventClick,
  onGoalClick,
  onViewChange,
}) => {
  const { user } = useAuthStore();
  const { addEvent, getEventsByDate, loadEvents } = useEventStore();
  const { goals, getActiveGoals } = useGoalStore();
  const { getTodayTodos, getOverdueTodos, toggleComplete } = useTodoStore();
  const { getCategoryById, getCategoryByName, getDefaultCategory } = useCategoryStore();

  // 채팅 상태
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const todayEvents = getEventsByDate(todayStr);
  const activeGoals = getActiveGoals();
  const todayTodos = getTodayTodos();
  const overdueTodos = getOverdueTodos();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const getGreeting = () => {
    const hour = today.getHours();
    if (hour < 12) return '좋은 아침이에요';
    if (hour < 18) return '좋은 오후예요';
    return '좋은 저녁이에요';
  };

  const formatDate = (date: Date) => {
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    return `${date.getMonth() + 1}월 ${date.getDate()}일 ${weekdays[date.getDay()]}요일`;
  };

  const findCategoryId = (categoryName?: string): string | undefined => {
    if (!categoryName) {
      const defaultCat = getDefaultCategory();
      return defaultCat?.id;
    }
    const exactMatch = getCategoryByName(categoryName);
    if (exactMatch) return exactMatch.id;
    const defaultCat = getDefaultCategory();
    return defaultCat?.id;
  };

  // 채팅 전송
  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: AgentMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const apiResponse: ChatResponse = await sendChatMessage(userMessage.content);

      const suggestedEvents: SuggestedEvent[] = (apiResponse.pending_events || []).map((evt: any) => ({
        title: evt.title || '',
        date: evt.datetime ? evt.datetime.split('T')[0] : new Date().toISOString().split('T')[0],
        start_time: evt.datetime ? evt.datetime.split('T')[1]?.slice(0, 5) : undefined,
        end_time: undefined,
        location: evt.location,
        category_name: '기본',
        description: evt.description,
        reason: '',
        added: false,
        rejected: false,
      }));

      const response: AgentMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: apiResponse.message,
        agent_type: 'master',
        timestamp: new Date(),
        metadata: {
          suggested_events: suggestedEvents.length > 0 ? suggestedEvents : undefined,
        },
      };

      setMessages((prev) => [...prev, response]);

      if (apiResponse.pending_events && apiResponse.pending_events.length > 0) {
        loadEvents();
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: '죄송합니다. 오류가 발생했습니다. 다시 시도해주세요.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // 일정 추가
  const handleAddSuggestedEvent = async (event: SuggestedEvent, messageId: string, eventIndex: number) => {
    if (!user) return;

    try {
      const categoryId = findCategoryId(event.category_name);
      const eventData = {
        user_id: user.id,
        title: event.title,
        event_date: event.date,
        start_time: event.start_time || undefined,
        end_time: event.end_time || undefined,
        location: event.location || undefined,
        category_id: categoryId,
        description: event.description || undefined,
        is_all_day: !event.start_time,
        is_completed: false,
        is_fixed: true,
        priority: 3 as const,
      };

      const result = await addEvent(eventData);
      if (result) {
        setMessages((prev) => prev.map((msg) => {
          if (msg.id === messageId && msg.metadata?.suggested_events) {
            const updatedEvents = [...msg.metadata.suggested_events];
            updatedEvents[eventIndex] = { ...updatedEvents[eventIndex], added: true };
            return { ...msg, metadata: { ...msg.metadata, suggested_events: updatedEvents } };
          }
          return msg;
        }));
      }
    } catch (error) {
      console.error('Failed to add event:', error);
    }
  };

  const handleRejectEvent = (messageId: string, eventIndex: number) => {
    setMessages((prev) => prev.map((msg) => {
      if (msg.id === messageId && msg.metadata?.suggested_events) {
        const updatedEvents = [...msg.metadata.suggested_events];
        updatedEvents[eventIndex] = { ...updatedEvents[eventIndex], rejected: true };
        return { ...msg, metadata: { ...msg.metadata, suggested_events: updatedEvents } };
      }
      return msg;
    }));
  };

  const quickPrompts = [
    '오늘 일정 정리해줘',
    '이번 주 운동 계획 세워줘',
    '내일 회의 일정 잡아줘',
    '주말 계획 추천해줘',
  ];

  const getCategoryInfo = (categoryName?: string) => {
    if (!categoryName) {
      const defaultCat = getDefaultCategory();
      return { name: defaultCat?.name || '기본', color: defaultCat?.color || DEFAULT_CATEGORY_COLOR };
    }
    const cat = getCategoryByName(categoryName);
    if (cat) return { name: cat.name, color: cat.color };
    return { name: categoryName, color: DEFAULT_CATEGORY_COLOR };
  };

  // 일정 카드 렌더링
  const renderScheduleCards = (msg: AgentMessage) => {
    const suggestedEvents = msg.metadata?.suggested_events;
    if (!suggestedEvents || suggestedEvents.length === 0) return null;

    return (
      <div className="suggested-events-list">
        {suggestedEvents.map((event, idx) => {
          const isAdded = event.added;
          const isRejected = event.rejected;
          const categoryInfo = getCategoryInfo(event.category_name);

          return (
            <div key={idx} className={`schedule-card compact ${isAdded ? 'added' : ''} ${isRejected ? 'rejected' : ''}`}>
              <div className="schedule-card-header">
                <span className="schedule-card-category" style={{ backgroundColor: categoryInfo.color }}>
                  {categoryInfo.name}
                </span>
                {isAdded && <span className="schedule-card-status added">✓ 추가됨</span>}
                {isRejected && <span className="schedule-card-status rejected">거절됨</span>}
              </div>
              <div className="schedule-card-title">{event.title}</div>
              <div className="schedule-card-info">
                <span>{event.date}</span>
                {event.start_time && <span>{event.start_time}</span>}
                {event.location && <span>{event.location}</span>}
              </div>
              {!isAdded && !isRejected && (
                <div className="schedule-card-actions">
                  <button className="btn btn-success btn-xs" onClick={() => handleAddSuggestedEvent(event, msg.id, idx)}>
                    추가
                  </button>
                  <button className="btn btn-danger-outline btn-xs" onClick={() => handleRejectEvent(msg.id, idx)}>
                    거절
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="dashboard-chat-layout">
      {/* 왼쪽: 오늘 요약 사이드바 */}
      <aside className="dashboard-sidebar">
        <div className="dashboard-greeting-compact">
          <h2>{getGreeting()}!</h2>
          <p>{formatDate(today)}</p>
        </div>

        {/* 오늘 일정 */}
        <div className="sidebar-section">
          <div className="sidebar-section-header">
            <span>오늘 일정</span>
            <span className="sidebar-count">{todayEvents.length}</span>
          </div>
          {todayEvents.length === 0 ? (
            <div className="sidebar-empty">일정이 없어요</div>
          ) : (
            <div className="sidebar-list">
              {todayEvents.slice(0, 5).map((event) => {
                const category = event.category_id ? getCategoryById(event.category_id) : null;
                return (
                  <div key={event.id} className="sidebar-item" onClick={() => onEventClick(event)}>
                    <div className="sidebar-item-color" style={{ backgroundColor: category?.color || DEFAULT_CATEGORY_COLOR }} />
                    <div className="sidebar-item-content">
                      <div className="sidebar-item-time">{event.is_all_day ? '종일' : event.start_time?.slice(0, 5)}</div>
                      <div className="sidebar-item-title">{event.title}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 오늘 할 일 */}
        <div className="sidebar-section">
          <div className="sidebar-section-header">
            <span>오늘 할 일</span>
            <span className="sidebar-count">{todayTodos.length + overdueTodos.length}</span>
          </div>
          {todayTodos.length + overdueTodos.length === 0 ? (
            <div className="sidebar-empty">할 일이 없어요</div>
          ) : (
            <div className="sidebar-list">
              {[...overdueTodos, ...todayTodos].slice(0, 5).map((todo) => (
                <div key={todo.id} className={`sidebar-todo-item ${todo.is_completed ? 'completed' : ''}`}>
                  <div
                    className={`sidebar-todo-checkbox ${todo.is_completed ? 'checked' : ''}`}
                    onClick={() => toggleComplete(todo.id!)}
                  />
                  <span className="sidebar-todo-title">{todo.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 진행 중인 목표 */}
        <div className="sidebar-section">
          <div className="sidebar-section-header">
            <span>목표</span>
            <span className="sidebar-count">{activeGoals.length}</span>
          </div>
          {activeGoals.length === 0 ? (
            <div className="sidebar-empty">목표가 없어요</div>
          ) : (
            <div className="sidebar-list">
              {activeGoals.slice(0, 3).map((goal) => {
                const category = goal.category_id ? getCategoryById(goal.category_id) : null;
                return (
                  <div key={goal.id} className="sidebar-goal-item" onClick={() => onGoalClick(goal)}>
                    <div className="sidebar-goal-title">{goal.title}</div>
                    <div className="sidebar-goal-progress">
                      <div className="sidebar-goal-bar">
                        <div
                          className="sidebar-goal-fill"
                          style={{
                            width: `${calculateGoalProgress(goal)}%`,
                            backgroundColor: category?.color || DEFAULT_CATEGORY_COLOR
                          }}
                        />
                      </div>
                      <span>{calculateGoalProgress(goal)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="sidebar-nav">
          <button className="sidebar-nav-btn" onClick={() => onViewChange('calendar')}>
            캘린더
          </button>
          <button className="sidebar-nav-btn" onClick={() => onViewChange('todos')}>
            할 일
          </button>
          <button className="sidebar-nav-btn" onClick={() => onViewChange('goals')}>
            목표
          </button>
        </div>
      </aside>

      {/* 오른쪽: 메인 채팅 영역 */}
      <main className="dashboard-chat-main">
        <div className="chat-container">
          <div className="chat-messages">
            {messages.length === 0 && (
              <div className="chat-welcome">
                <div className="chat-welcome-icon">🌴</div>
                <h2>안녕하세요, {user?.nickname || user?.name}님!</h2>
                <p>무엇을 도와드릴까요? 일정 추가, 계획 세우기, 할 일 관리 등을 도와드립니다.</p>
                <div className="quick-prompts-grid">
                  {quickPrompts.map((prompt, idx) => (
                    <button key={idx} className="quick-prompt-card" onClick={() => setInput(prompt)}>
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className={`chat-message ${msg.role}`}>
                {msg.role === 'assistant' && (
                  <div className="message-avatar">🌴</div>
                )}
                <div className="message-content">
                  {msg.role === 'assistant' && msg.agent_type && (
                    <div className="message-agent-name">PALM</div>
                  )}
                  <div className="message-bubble">
                    {msg.content}
                  </div>
                  {renderScheduleCards(msg)}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="chat-message assistant">
                <div className="message-avatar">🌴</div>
                <div className="message-content">
                  <div className="typing-indicator">
                    <div className="typing-dot" />
                    <div className="typing-dot" />
                    <div className="typing-dot" />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="chat-input-container">
            <div className="chat-input-box">
              <input
                type="text"
                className="chat-input-field"
                placeholder="메시지를 입력하세요... (예: 내일 3시에 팀 미팅 잡아줘)"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                disabled={isLoading}
              />
              <button
                className="chat-send-button"
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
