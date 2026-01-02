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
  saveResultMessage,
  type Conversation,
  type Message,
  type PendingEvent,
} from '../../services/api';
import DatePicker from '../DatePicker';
import TimePicker from '../TimePicker';
import type { Goal } from '../../types';

interface LocalMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  pending_events?: PendingEvent[];
  created_at: string;
}

// 각 이벤트의 선택 상태
type EventDecision = 'pending' | 'confirmed' | 'rejected';

interface EventDecisionState {
  [index: number]: EventDecision;
}

const AssistantView: React.FC = () => {
  const { user } = useAuthStore();
  const { getActiveGoals } = useGoalStore();
  const { loadEvents, events } = useEventStore();
  const { categories } = useCategoryStore();

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
  const [eventDecisions, setEventDecisions] = useState<EventDecisionState>({});
  const [editingEvents, setEditingEvents] = useState<{ [index: number]: PendingEvent }>({});
  const [isSaving, setIsSaving] = useState(false);
  const [completedResults, setCompletedResults] = useState<{
    messageId: string;
    confirmed: PendingEvent[];
    rejected: number;
  } | null>(null);

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
      setActiveMessageId(null);
      setEventDecisions({});
      setEditingEvents({});
      setCompletedResults(null);
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  const handleNewConversation = () => {
    setCurrentConversationId(null);
    setMessages([]);
    setActiveMessageId(null);
    setEventDecisions({});
    setEditingEvents({});
    setCompletedResults(null);
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
      const response = await sendChatMessage(messageContent, currentConversationId || undefined);

      // Update conversation ID if new
      if (!currentConversationId) {
        setCurrentConversationId(response.conversation_id);
        loadConversations();
      }

      // Add assistant message
      const assistantMessage: LocalMessage = {
        id: response.message_id,
        role: 'assistant',
        content: response.pending_events && response.pending_events.length > 0
          ? '아래와 같은 일정은 어떠세요?'
          : response.message,
        pending_events: response.pending_events,
        created_at: new Date().toISOString(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Set up event confirmation UI
      if (response.pending_events && response.pending_events.length > 0) {
        setActiveMessageId(response.message_id);
        setEventDecisions({});
        setEditingEvents({});
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
    const currentEvents = messages.find(m => m.id === activeMessageId)?.pending_events || [];
    const currentEvent = editingEvents[index] || currentEvents[index];
    setEditingEvents(prev => ({
      ...prev,
      [index]: { ...currentEvent, [field]: value }
    }));
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
    return editingEvents[index] || originalEvent;
  };

  // 모든 일정이 처리되었는지 확인
  const allEventsProcessed = (pendingEvents: PendingEvent[]) => {
    return pendingEvents.every((_, index) =>
      eventDecisions[index] === 'confirmed' || eventDecisions[index] === 'rejected'
    );
  };

  // 최종 확정 처리
  const handleFinalConfirm = async (pendingEvents: PendingEvent[]) => {
    setIsSaving(true);

    const confirmedEvents: PendingEvent[] = [];
    const rejectedCount = Object.values(eventDecisions).filter(d => d === 'rejected').length;

    for (let i = 0; i < pendingEvents.length; i++) {
      if (eventDecisions[i] === 'confirmed') {
        const eventWithEdits = getEventWithEdits(i, pendingEvents[i]);
        confirmedEvents.push(eventWithEdits);
      }
    }

    try {
      if (confirmedEvents.length > 0) {
        await confirmEvents(confirmedEvents);
        loadEvents();
      }

      // 결과 메시지 생성
      let resultContent = '';
      if (confirmedEvents.length > 0) {
        resultContent = `✅ ${confirmedEvents.length}개의 일정이 추가되었습니다.`;
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
        confirmed: confirmedEvents,
        rejected: rejectedCount,
      });

      // 상태 초기화
      setActiveMessageId(null);
      setEventDecisions({});
      setEditingEvents({});
    } catch (error) {
      console.error('Failed to save events:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const formatEventDateTime = (datetime: string) => {
    const date = new Date(datetime);
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekday = weekdays[date.getDay()];
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours < 12 ? '오전' : '오후';
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    return `${month}월 ${day}일 (${weekday}) ${ampm} ${displayHours}:${minutes}`;
  };

  const formatShortDateTime = (datetime: string) => {
    const date = new Date(datetime);
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekday = weekdays[date.getDay()];
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours < 12 ? '오전' : '오후';
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    return `${month}/${day}(${weekday}) ${ampm}${displayHours}:${minutes}`;
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
              <span className="event-card-inline-location">📍 {eventWithEdits.location}</span>
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
              <select
                value={eventWithEdits.category || ''}
                onChange={(e) => handleEditEvent(index, 'category', e.target.value)}
                disabled={decision === 'rejected'}
              >
                <option value="">선택</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.name}>{cat.name}</option>
                ))}
              </select>
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

  // 결과 메시지 렌더링
  const renderCompletedResults = () => {
    if (!completedResults) return null;

    const { confirmed, rejected } = completedResults;

    return (
      <div className="chat-message assistant">
        <div className="message-bubble result-message">
          {confirmed.length > 0 ? (
            <>
              <div className="result-title">✅ {confirmed.length}개의 일정이 추가되었습니다!</div>
              <div className="result-list">
                {confirmed.map((event, idx) => (
                  <div key={idx} className="result-item">
                    <span className="result-item-title">{event.title}</span>
                    <span className="result-item-datetime">{formatShortDateTime(event.datetime)}</span>
                    {event.category && <span className="result-item-category">{event.category}</span>}
                    {event.location && <span className="result-item-location">📍 {event.location}</span>}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="result-title">일정이 추가되지 않았습니다.</div>
          )}
          {rejected > 0 && (
            <div className="result-rejected">{rejected}개의 일정은 거절되었습니다.</div>
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

                {/* 일정 확인 UI - 메시지 바로 아래에 표시 */}
                {msg.pending_events && msg.pending_events.length > 0 && msg.id === activeMessageId && (
                  <div className="event-confirmation-inline">
                    <div className="event-cards-container">
                      {msg.pending_events.map((event, index) =>
                        renderEventCard(event, index, true)
                      )}
                    </div>

                    {allEventsProcessed(msg.pending_events) && (
                      <div className="event-final-actions">
                        <button
                          className="btn-final-confirm"
                          onClick={() => handleFinalConfirm(msg.pending_events!)}
                          disabled={isSaving}
                        >
                          {isSaving ? '저장 중...' : '확정하기'}
                        </button>
                      </div>
                    )}

                    {!allEventsProcessed(msg.pending_events) && (
                      <div className="event-pending-hint">
                        각 일정에서 ✓(추가) 또는 ✗(거절)를 선택해주세요
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
