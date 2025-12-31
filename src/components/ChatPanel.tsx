import React, { useState, useRef, useEffect } from 'react';
import { useEventStore } from '../store/eventStore';
import { useGoalStore } from '../store/goalStore';
import { useTodoStore } from '../store/todoStore';
import { useAuthStore } from '../store/authStore';
import { useCategoryStore } from '../store/categoryStore';
import { sendChatMessage, ChatResponse } from '../services/api';
import type { AgentMessage, SuggestedEvent } from '../types';
import { AGENT_CONFIGS, DEFAULT_CATEGORY_COLOR } from '../types';

interface ChatPanelProps {
  onClose: () => void;
}

// 수정 모달용 인터페이스
interface EditingEvent {
  messageId: string;
  eventIndex: number;
  event: SuggestedEvent;
}

// 슬라이더 인덱스 관리용
interface SliderState {
  [messageId: string]: number;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ onClose }) => {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EditingEvent | null>(null);
  const [sliderIndexes, setSliderIndexes] = useState<SliderState>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { user } = useAuthStore();
  const { events, addEvent, loadEvents } = useEventStore();
  const { goals } = useGoalStore();
  const { todos } = useTodoStore();
  const { categories, getCategoryByName, getDefaultCategory } = useCategoryStore();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
      // 백엔드 API를 통해 AI와 대화
      const apiResponse: ChatResponse = await sendChatMessage(userMessage.content);

      // API 응답을 AgentMessage로 변환
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
      // 새 메시지의 슬라이더 인덱스를 0으로 초기화
      setSliderIndexes((prev) => ({ ...prev, [response.id]: 0 }));

      // 이벤트가 생성되었으면 store 새로고침
      if (apiResponse.pending_events && apiResponse.pending_events.length > 0) {
        // 이벤트 목록 새로고침
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

  // 카테고리 이름으로 category_id 찾기
  const findCategoryId = (categoryName?: string): string | undefined => {
    if (!categoryName) {
      const defaultCat = getDefaultCategory();
      return defaultCat?.id;
    }

    // 정확히 매칭되는 카테고리 찾기
    const exactMatch = getCategoryByName(categoryName);
    if (exactMatch) return exactMatch.id;

    // 기본 카테고리 반환
    const defaultCat = getDefaultCategory();
    return defaultCat?.id;
  };

  const handleAddSuggestedEvent = async (event: SuggestedEvent, messageId: string, eventIndex: number) => {
    if (!user) {
      console.error('User not logged in');
      alert('로그인이 필요합니다.');
      return;
    }

    try {
      const categoryId = findCategoryId(event.category_name);

      const eventData = {
        user_id: user.id,
        title: event.title,
        event_date: event.date,
        start_time: event.start_time && event.start_time.trim() !== '' ? event.start_time : undefined,
        end_time: event.end_time && event.end_time.trim() !== '' ? event.end_time : undefined,
        location: event.location && event.location.trim() !== '' ? event.location : undefined,
        category_id: categoryId,
        description: event.description && event.description.trim() !== '' ? event.description : undefined,
        is_all_day: !event.start_time || event.start_time.trim() === '',
        is_completed: false,
      };

      console.log('Adding event:', eventData);
      const result = await addEvent(eventData);
      console.log('Add event result:', result);

      if (result) {
        // 해당 일정 카드를 '추가됨' 상태로 업데이트
        setMessages((prev) => prev.map((msg) => {
          if (msg.id === messageId && msg.metadata?.suggested_events) {
            const updatedEvents = [...msg.metadata.suggested_events];
            updatedEvents[eventIndex] = { ...updatedEvents[eventIndex], added: true };
            return {
              ...msg,
              metadata: { ...msg.metadata, suggested_events: updatedEvents }
            };
          }
          return msg;
        }));
      } else {
        alert('일정 추가에 실패했습니다. 다시 시도해주세요.');
      }
    } catch (error) {
      console.error('Failed to add event:', error);
      alert('일정 추가 중 오류가 발생했습니다.');
    }
  };

  const handleRejectEvent = (messageId: string, eventIndex: number) => {
    setMessages((prev) => prev.map((msg) => {
      if (msg.id === messageId && msg.metadata?.suggested_events) {
        const updatedEvents = [...msg.metadata.suggested_events];
        updatedEvents[eventIndex] = { ...updatedEvents[eventIndex], rejected: true };
        return {
          ...msg,
          metadata: { ...msg.metadata, suggested_events: updatedEvents }
        };
      }
      return msg;
    }));
  };

  const handleOpenEditModal = (event: SuggestedEvent, messageId: string, eventIndex: number) => {
    setEditingEvent({ messageId, eventIndex, event: { ...event } });
  };

  const handleSaveEditedEvent = async () => {
    if (!editingEvent || !user) return;

    try {
      const evt = editingEvent.event;
      const categoryId = findCategoryId(evt.category_name);

      const eventData = {
        user_id: user.id,
        title: evt.title,
        event_date: evt.date,
        start_time: evt.start_time && evt.start_time.trim() !== '' ? evt.start_time : undefined,
        end_time: evt.end_time && evt.end_time.trim() !== '' ? evt.end_time : undefined,
        location: evt.location && evt.location.trim() !== '' ? evt.location : undefined,
        category_id: categoryId,
        description: evt.description && evt.description.trim() !== '' ? evt.description : undefined,
        is_all_day: !evt.start_time || evt.start_time.trim() === '',
        is_completed: false,
      };

      console.log('Saving edited event:', eventData);
      const result = await addEvent(eventData);
      console.log('Save result:', result);

      if (result) {
        // 해당 일정 카드를 '추가됨' 상태로 업데이트
        setMessages((prev) => prev.map((msg) => {
          if (msg.id === editingEvent.messageId && msg.metadata?.suggested_events) {
            const updatedEvents = [...msg.metadata.suggested_events];
            updatedEvents[editingEvent.eventIndex] = {
              ...editingEvent.event,
              added: true
            };
            return {
              ...msg,
              metadata: { ...msg.metadata, suggested_events: updatedEvents }
            };
          }
          return msg;
        }));
        setEditingEvent(null);
      } else {
        alert('일정 추가에 실패했습니다. 다시 시도해주세요.');
      }
    } catch (error) {
      console.error('Failed to save edited event:', error);
      alert('일정 추가 중 오류가 발생했습니다.');
    }
  };

  // 슬라이더 네비게이션
  const handlePrevEvent = (messageId: string, totalEvents: number) => {
    setSliderIndexes((prev) => ({
      ...prev,
      [messageId]: Math.max(0, (prev[messageId] || 0) - 1)
    }));
  };

  const handleNextEvent = (messageId: string, totalEvents: number) => {
    setSliderIndexes((prev) => ({
      ...prev,
      [messageId]: Math.min(totalEvents - 1, (prev[messageId] || 0) + 1)
    }));
  };

  const formatTime = (time?: string) => {
    if (!time) return '';
    return time.slice(0, 5);
  };

  // 카테고리 이름 또는 ID로 카테고리 정보 가져오기
  const getCategoryInfo = (categoryName?: string) => {
    if (!categoryName) {
      const defaultCat = getDefaultCategory();
      return { name: defaultCat?.name || '기본', color: defaultCat?.color || DEFAULT_CATEGORY_COLOR };
    }
    const cat = getCategoryByName(categoryName);
    if (cat) {
      return { name: cat.name, color: cat.color };
    }
    const defaultCat = getDefaultCategory();
    return { name: categoryName, color: defaultCat?.color || DEFAULT_CATEGORY_COLOR };
  };

  const quickPrompts = [
    '이번 주 운동 계획 세워줘',
    '내일 저녁 약속 잡아줘',
    '토익 공부 일정 추천해줘',
    '주말 여행 계획 세워줘',
  ];

  const renderScheduleCards = (msg: AgentMessage) => {
    const suggestedEvents = msg.metadata?.suggested_events;
    if (!suggestedEvents || suggestedEvents.length === 0) return null;

    const currentIndex = sliderIndexes[msg.id] || 0;
    const totalEvents = suggestedEvents.length;
    const event = suggestedEvents[currentIndex];
    const isAdded = event.added;
    const isRejected = event.rejected;
    const categoryInfo = getCategoryInfo(event.category_name);

    return (
      <div className="schedule-slider">
        {/* 슬라이더 헤더 */}
        {totalEvents > 1 && (
          <div className="schedule-slider-nav">
            <button
              className="slider-nav-btn"
              onClick={() => handlePrevEvent(msg.id, totalEvents)}
              disabled={currentIndex === 0}
            >
              ←
            </button>
            <span className="slider-indicator">
              {currentIndex + 1} / {totalEvents}
            </span>
            <button
              className="slider-nav-btn"
              onClick={() => handleNextEvent(msg.id, totalEvents)}
              disabled={currentIndex === totalEvents - 1}
            >
              →
            </button>
          </div>
        )}

        {/* 현재 일정 카드 */}
        <div
          className={`schedule-card ${isAdded ? 'added' : ''} ${isRejected ? 'rejected' : ''}`}
        >
          <div className="schedule-card-header">
            <span
              className="schedule-card-category"
              style={{ backgroundColor: categoryInfo.color, color: '#fff', padding: '2px 8px', borderRadius: '4px' }}
            >
              {categoryInfo.name}
            </span>
            {isAdded && <span className="schedule-card-status added">추가됨</span>}
            {isRejected && <span className="schedule-card-status rejected">거절됨</span>}
          </div>

          <div className="schedule-card-title">{event.title}</div>

          <div className="schedule-card-info">
            <div className="schedule-card-row">
              <span className="schedule-card-icon">📅</span>
              <span>{event.date}</span>
            </div>
            {event.start_time && (
              <div className="schedule-card-row">
                <span className="schedule-card-icon">🕐</span>
                <span>{formatTime(event.start_time)}{event.end_time && ` ~ ${formatTime(event.end_time)}`}</span>
              </div>
            )}
            {event.location && (
              <div className="schedule-card-row">
                <span className="schedule-card-icon">📍</span>
                <span>{event.location}</span>
              </div>
            )}
            {event.description && (
              <div className="schedule-card-row description">
                <span className="schedule-card-icon">📝</span>
                <span>{event.description}</span>
              </div>
            )}
            {event.reason && (
              <div className="schedule-card-row reason">
                <span className="schedule-card-icon">💡</span>
                <span>{event.reason}</span>
              </div>
            )}
          </div>

          {!isAdded && !isRejected && (
            <div className="schedule-card-actions">
              <button
                className="btn btn-success btn-sm"
                onClick={() => handleAddSuggestedEvent(event, msg.id, currentIndex)}
              >
                ✓ 추가
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => handleOpenEditModal(event, msg.id, currentIndex)}
              >
                ✎ 수정
              </button>
              <button
                className="btn btn-danger-outline btn-sm"
                onClick={() => handleRejectEvent(msg.id, currentIndex)}
              >
                ✕ 거절
              </button>
            </div>
          )}
        </div>

        {/* 모든 일정 상태 표시 (도트) */}
        {totalEvents > 1 && (
          <div className="schedule-dots">
            {suggestedEvents.map((e, idx) => (
              <span
                key={idx}
                className={`schedule-dot ${idx === currentIndex ? 'active' : ''} ${e.added ? 'added' : ''} ${e.rejected ? 'rejected' : ''}`}
                onClick={() => setSliderIndexes((prev) => ({ ...prev, [msg.id]: idx }))}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="chat-panel">
      <div className="panel-header">
        <span className="panel-title">AI 스케줄러</span>
        <button className="panel-close" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">🤖</div>
            <div className="empty-state-title">AI 스케줄러</div>
            <div className="empty-state-text">
              일정을 추천받고 싶은 내용을 말씀해주세요.
              <br />
              예: "이번 주 운동 계획 세워줘"
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`chat-message ${msg.role}`}>
            {msg.role === 'assistant' && msg.agent_type && (
              <div className="message-agent-badge">
                <span>{AGENT_CONFIGS[msg.agent_type]?.icon}</span>
                <span>{AGENT_CONFIGS[msg.agent_type]?.name}</span>
              </div>
            )}
            <div className="message-bubble">
              {msg.content}
              {renderScheduleCards(msg)}

              {msg.metadata?.place_recommendations?.map((place, idx) => (
                <div key={idx} className="schedule-card">
                  <div className="schedule-card-header">
                    <span className="schedule-card-category">📍 장소 추천</span>
                  </div>
                  <div className="schedule-card-title">{place.name}</div>
                  <div className="schedule-card-info">
                    <div className="schedule-card-row">
                      <span className="schedule-card-icon">🏷️</span>
                      <span>{place.category}</span>
                    </div>
                    {place.address && (
                      <div className="schedule-card-row">
                        <span className="schedule-card-icon">📍</span>
                        <span>{place.address}</span>
                      </div>
                    )}
                    {place.reason && (
                      <div className="schedule-card-row reason">
                        <span className="schedule-card-icon">💡</span>
                        <span>{place.reason}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="chat-message assistant">
            <div className="typing-indicator">
              <div className="typing-dot" />
              <div className="typing-dot" />
              <div className="typing-dot" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {messages.length === 0 && (
        <div className="quick-prompts">
          {quickPrompts.map((prompt, idx) => (
            <button
              key={idx}
              className="quick-prompt"
              onClick={() => setInput(prompt)}
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      <div className="chat-input-area">
        <div className="chat-input-wrapper">
          <input
            type="text"
            className="chat-input"
            placeholder="일정을 추천받고 싶은 내용을 입력하세요..."
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
            className="chat-send-btn"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
          >
            ➤
          </button>
        </div>
      </div>

      {/* 수정 모달 */}
      {editingEvent && (
        <div className="modal-overlay" onClick={() => setEditingEvent(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">일정 수정</div>
              <button className="modal-close" onClick={() => setEditingEvent(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">일정 제목</label>
                <input
                  type="text"
                  className="form-input"
                  value={editingEvent.event.title}
                  onChange={(e) => setEditingEvent({
                    ...editingEvent,
                    event: { ...editingEvent.event, title: e.target.value }
                  })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">날짜</label>
                <input
                  type="date"
                  className="form-input"
                  value={editingEvent.event.date}
                  onChange={(e) => setEditingEvent({
                    ...editingEvent,
                    event: { ...editingEvent.event, date: e.target.value }
                  })}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">시작 시간</label>
                  <input
                    type="time"
                    className="form-input"
                    value={editingEvent.event.start_time || ''}
                    onChange={(e) => setEditingEvent({
                      ...editingEvent,
                      event: { ...editingEvent.event, start_time: e.target.value }
                    })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">종료 시간</label>
                  <input
                    type="time"
                    className="form-input"
                    value={editingEvent.event.end_time || ''}
                    onChange={(e) => setEditingEvent({
                      ...editingEvent,
                      event: { ...editingEvent.event, end_time: e.target.value }
                    })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">장소</label>
                <input
                  type="text"
                  className="form-input"
                  value={editingEvent.event.location || ''}
                  onChange={(e) => setEditingEvent({
                    ...editingEvent,
                    event: { ...editingEvent.event, location: e.target.value }
                  })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">카테고리</label>
                <select
                  className="form-input"
                  value={editingEvent.event.category_name || '기본'}
                  onChange={(e) => setEditingEvent({
                    ...editingEvent,
                    event: { ...editingEvent.event, category_name: e.target.value }
                  })}
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.name}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">메모</label>
                <textarea
                  className="form-input"
                  value={editingEvent.event.description || ''}
                  onChange={(e) => setEditingEvent({
                    ...editingEvent,
                    event: { ...editingEvent.event, description: e.target.value }
                  })}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setEditingEvent(null)}>
                취소
              </button>
              <button className="btn btn-primary" onClick={handleSaveEditedEvent}>
                저장 후 추가
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
