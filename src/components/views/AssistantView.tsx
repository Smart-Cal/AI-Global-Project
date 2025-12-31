import React, { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useGoalStore } from '../../store/goalStore';
import { useEventStore } from '../../store/eventStore';
import {
  sendChatMessage,
  getConversations,
  getConversation,
  deleteConversation,
  confirmEvents,
  type Conversation,
  type Message,
  type PendingEvent,
} from '../../services/api';
import type { Goal } from '../../types';

interface LocalMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  pending_events?: PendingEvent[];
  created_at: string;
}

const AssistantView: React.FC = () => {
  const { user } = useAuthStore();
  const { getActiveGoals } = useGoalStore();
  const { loadEvents, events } = useEventStore();

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

  // Event confirmation state
  const [pendingEvents, setPendingEvents] = useState<PendingEvent[]>([]);
  const [currentEventIndex, setCurrentEventIndex] = useState(0);
  const [editingEvent, setEditingEvent] = useState<PendingEvent | null>(null);
  const [confirmedEvents, setConfirmedEvents] = useState<PendingEvent[]>([]);
  const [processedIndexes, setProcessedIndexes] = useState<Set<number>>(new Set()); // 처리된 인덱스 추적
  const [isSaving, setIsSaving] = useState(false); // 저장 중 상태

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeGoals = getActiveGoals();

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, []);

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
        created_at: m.created_at,
      })));
      setPendingEvents([]);
      setCurrentEventIndex(0);
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  const handleNewConversation = () => {
    setCurrentConversationId(null);
    setMessages([]);
    setPendingEvents([]);
    setCurrentEventIndex(0);
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
  }, [messages]);

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

    try {
      const response = await sendChatMessage(messageContent, currentConversationId || undefined);

      // Update conversation ID if new
      if (!currentConversationId) {
        setCurrentConversationId(response.conversation_id);
        loadConversations(); // Refresh conversation list
      }

      // Add assistant message
      const assistantMessage: LocalMessage = {
        id: response.message_id,
        role: 'assistant',
        content: response.message,
        pending_events: response.pending_events,
        created_at: new Date().toISOString(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Set pending events for confirmation
      if (response.pending_events && response.pending_events.length > 0) {
        setPendingEvents(response.pending_events);
        setCurrentEventIndex(0);
        setConfirmedEvents([]);
        setProcessedIndexes(new Set()); // 새 일정 목록이면 처리 상태 초기화
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

  // 다음 미처리 일정으로 이동하는 헬퍼 함수
  const moveToNextUnprocessed = (processed: Set<number>) => {
    // 다음 미처리 일정 찾기
    for (let i = currentEventIndex + 1; i < pendingEvents.length; i++) {
      if (!processed.has(i)) {
        setCurrentEventIndex(i);
        return;
      }
    }
    // 이전에 미처리 일정이 있는지 확인
    for (let i = 0; i < currentEventIndex; i++) {
      if (!processed.has(i)) {
        setCurrentEventIndex(i);
        return;
      }
    }
    // 모든 일정 처리 완료
    setPendingEvents([]);
    setCurrentEventIndex(0);
    setConfirmedEvents([]);
    setProcessedIndexes(new Set());
  };

  // Event confirmation handlers - 각 일정을 바로 저장
  const handleConfirmEvent = async () => {
    // 이미 처리된 일정이거나 저장 중이면 무시
    if (processedIndexes.has(currentEventIndex) || isSaving) return;

    const event = editingEvent || pendingEvents[currentEventIndex];
    setIsSaving(true);

    try {
      await confirmEvents([event]);
      loadEvents();
      setConfirmedEvents(prev => [...prev, event]);

      // 현재 인덱스를 처리됨으로 표시
      const newProcessed = new Set(processedIndexes);
      newProcessed.add(currentEventIndex);
      setProcessedIndexes(newProcessed);

      // 다음 미처리 일정으로 이동 또는 종료
      setEditingEvent(null);
      moveToNextUnprocessed(newProcessed);
    } catch (error) {
      console.error('Failed to save event:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRejectEvent = () => {
    // 이미 처리된 일정이면 무시
    if (processedIndexes.has(currentEventIndex)) return;

    // 현재 인덱스를 처리됨으로 표시
    const newProcessed = new Set(processedIndexes);
    newProcessed.add(currentEventIndex);
    setProcessedIndexes(newProcessed);

    setEditingEvent(null);
    moveToNextUnprocessed(newProcessed);
  };

  const handleEditEvent = (field: keyof PendingEvent, value: string) => {
    const currentEvent = editingEvent || pendingEvents[currentEventIndex];
    setEditingEvent({
      ...currentEvent,
      [field]: value,
    });
  };

  const formatEventDateTime = (datetime: string) => {
    const date = new Date(datetime);
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekday = weekdays[date.getDay()];
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${month}월 ${day}일 (${weekday}) ${hours}:${minutes}`;
  };

  // 시간 충돌 검사 함수
  const checkTimeConflict = (pendingEvent: PendingEvent) => {
    const eventDate = pendingEvent.datetime.split('T')[0];
    const eventStartTime = pendingEvent.datetime.split('T')[1]?.slice(0, 5) || '09:00';
    const duration = typeof pendingEvent.duration === 'string'
      ? parseInt(pendingEvent.duration)
      : pendingEvent.duration || 60;

    // pending event의 시작/종료 시간 (분 단위)
    const [startH, startM] = eventStartTime.split(':').map(Number);
    const pendingStart = startH * 60 + startM;
    const pendingEnd = pendingStart + duration;

    // 같은 날짜의 기존 일정들과 비교
    const conflictingEvents = events.filter(existingEvent => {
      if (existingEvent.event_date !== eventDate) return false;
      if (!existingEvent.start_time || !existingEvent.end_time) return false;

      const [existH, existM] = existingEvent.start_time.split(':').map(Number);
      const [endH, endM] = existingEvent.end_time.split(':').map(Number);
      const existingStart = existH * 60 + existM;
      const existingEnd = endH * 60 + endM;

      // 시간 겹침 검사: 시작이 기존 종료 전이고, 종료가 기존 시작 후이면 충돌
      return pendingStart < existingEnd && pendingEnd > existingStart;
    });

    return conflictingEvents;
  };

  const currentEvent = editingEvent || pendingEvents[currentEventIndex];
  const conflictingEvents = currentEvent ? checkTimeConflict(currentEvent) : [];

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
              <div key={msg.id} className={`chat-message ${msg.role}`}>
                <div className="message-bubble">
                  {msg.content}
                </div>
              </div>
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

        {/* Event Confirmation Carousel */}
        {pendingEvents.length > 0 && currentEvent && (
          <div className="event-confirmation-panel">
            <div className="event-confirmation-header">
              <span>일정 확인</span>
              <span className="event-counter">
                {currentEventIndex + 1} / {pendingEvents.length}
              </span>
            </div>

            <div className="event-card">
              <div className="event-card-field">
                <label>제목</label>
                <input
                  type="text"
                  value={currentEvent.title}
                  onChange={(e) => handleEditEvent('title', e.target.value)}
                />
              </div>

              <div className="event-card-field">
                <label>일시</label>
                <input
                  type="datetime-local"
                  value={currentEvent.datetime.slice(0, 16)}
                  onChange={(e) => handleEditEvent('datetime', e.target.value + ':00')}
                />
              </div>

              <div className="event-card-field">
                <label>소요 시간 (분)</label>
                <input
                  type="number"
                  value={currentEvent.duration}
                  onChange={(e) => handleEditEvent('duration', e.target.value)}
                />
              </div>

              {currentEvent.location && (
                <div className="event-card-field">
                  <label>장소</label>
                  <input
                    type="text"
                    value={currentEvent.location}
                    onChange={(e) => handleEditEvent('location', e.target.value)}
                  />
                </div>
              )}

              <div className="event-card-preview">
                {formatEventDateTime(currentEvent.datetime)} ({currentEvent.duration}분)
              </div>

              {/* 시간 충돌 경고 */}
              {conflictingEvents.length > 0 && (
                <div className="event-conflict-warning">
                  ⚠️ 기존 일정과 시간이 겹칩니다:
                  <ul>
                    {conflictingEvents.map(conflict => (
                      <li key={conflict.id}>
                        {conflict.title} ({conflict.start_time} - {conflict.end_time})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="event-confirmation-actions">
              <button
                className="event-action-btn prev"
                onClick={() => setCurrentEventIndex(prev => Math.max(0, prev - 1))}
                disabled={currentEventIndex === 0}
              >
                ← 이전
              </button>
              <button
                className="event-action-btn reject"
                onClick={handleRejectEvent}
                disabled={processedIndexes.has(currentEventIndex) || isSaving}
              >
                {processedIndexes.has(currentEventIndex) ? '처리됨' : '거절'}
              </button>
              <button
                className="event-action-btn confirm"
                onClick={handleConfirmEvent}
                disabled={processedIndexes.has(currentEventIndex) || isSaving}
              >
                {isSaving ? '저장 중...' : processedIndexes.has(currentEventIndex) ? '추가됨' : '추가'}
              </button>
              <button
                className="event-action-btn next"
                onClick={() => setCurrentEventIndex(prev => Math.min(pendingEvents.length - 1, prev + 1))}
                disabled={currentEventIndex === pendingEvents.length - 1}
              >
                다음 →
              </button>
            </div>

            {confirmedEvents.length > 0 && (
              <div className="confirmed-count">
                {confirmedEvents.length}개 일정 추가 예정
              </div>
            )}
          </div>
        )}

        {/* Selected Goal Indicator */}
        {selectedGoal && (
          <div className="selected-goal-bar">
            <span className="selected-goal-tag">
              🎯 {selectedGoal.title}
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
              placeholder="무엇이든 물어보세요..."
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
                  <span>💬</span>
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
                    <span>🎯</span>
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
