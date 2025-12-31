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
  const { loadEvents } = useEventStore();

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

  // Event confirmation handlers
  const handleConfirmEvent = () => {
    const event = editingEvent || pendingEvents[currentEventIndex];
    setConfirmedEvents(prev => [...prev, event]);
    goToNextEvent();
  };

  const handleRejectEvent = () => {
    goToNextEvent();
  };

  const goToNextEvent = () => {
    setEditingEvent(null);
    if (currentEventIndex < pendingEvents.length - 1) {
      setCurrentEventIndex(prev => prev + 1);
    } else {
      // All events processed
      saveConfirmedEvents();
    }
  };

  const saveConfirmedEvents = async () => {
    if (confirmedEvents.length === 0) {
      setPendingEvents([]);
      return;
    }

    try {
      await confirmEvents(confirmedEvents);
      loadEvents();
      setPendingEvents([]);
      setConfirmedEvents([]);
    } catch (error) {
      console.error('Failed to save events:', error);
    }
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

  const currentEvent = editingEvent || pendingEvents[currentEventIndex];

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
            </div>

            <div className="event-confirmation-actions">
              <button
                className="event-action-btn prev"
                onClick={() => setCurrentEventIndex(prev => Math.max(0, prev - 1))}
                disabled={currentEventIndex === 0}
              >
                ← 이전
              </button>
              <button className="event-action-btn reject" onClick={handleRejectEvent}>
                거절
              </button>
              <button className="event-action-btn confirm" onClick={handleConfirmEvent}>
                추가
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
