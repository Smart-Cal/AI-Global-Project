import React, { useState, useRef, useEffect } from 'react';
import { Modal } from './Modal';
import { useEventStore } from '../store/eventStore';
import { useAuthStore } from '../store/authStore';
import { useCategoryStore } from '../store/categoryStore';
import { chatWithAI } from '../services/openai';
import type { ChatMessage, ScheduleInfo } from '../types';
import { DEFAULT_CATEGORY_COLOR } from '../types';

interface AIChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AIChatModal: React.FC<AIChatModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuthStore();
  const { events, addEvent } = useEventStore();
  const { getCategoryByName, getDefaultCategory } = useCategoryStore();
  const messagesRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingSchedule, setPendingSchedule] = useState<ScheduleInfo | null>(null);

  useEffect(() => {
    if (isOpen) {
      setMessages([]);
      setPendingSchedule(null);
      setInput('');
    }
  }, [isOpen]);

  useEffect(() => {
    messagesRef.current?.scrollTo(0, messagesRef.current.scrollHeight);
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await chatWithAI(input.trim(), events, messages);
      setMessages((prev) => [...prev, { role: 'assistant', content: response.message }]);

      if (response.scheduleReady && response.scheduleInfo) {
        setPendingSchedule(response.scheduleInfo);
      }
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: '오류가 발생했습니다. 다시 시도해주세요.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!pendingSchedule || !user?.id) return;

    setIsLoading(true);
    try {
      // Find category by name or use default
      const category = pendingSchedule.category_name
        ? getCategoryByName(pendingSchedule.category_name)
        : getDefaultCategory();

      await addEvent({
        user_id: user.id,
        title: pendingSchedule.title,
        event_date: pendingSchedule.date,
        start_time: pendingSchedule.start_time,
        end_time: pendingSchedule.end_time,
        is_all_day: !pendingSchedule.start_time,
        category_id: category?.id,
        is_completed: false,
        location: pendingSchedule.location,
        description: pendingSchedule.description,
      });

      setMessages((prev) => [...prev, { role: 'assistant', content: `✅ '${pendingSchedule.title}' 일정이 추가되었습니다!` }]);
      setPendingSchedule(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = () => {
    setMessages((prev) => [...prev, { role: 'assistant', content: '알겠습니다. 다른 조건이 있으시면 말씀해주세요!' }]);
    setPendingSchedule(null);
  };

  const quickInputs = ['내일 점심 약속', '이번주 토요일 저녁', '다음주 회의'];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="💬 AI 일정 도우미">
      <div style={{ background: '#E3F2FD', padding: '12px', borderRadius: '12px', marginBottom: '16px', textAlign: 'center' }}>
        <span style={{ fontSize: '13px', color: '#1565C0' }}>
          자연어로 일정을 추가해보세요!<br />예: '내일 12시 강남역에서 점심약속'
        </span>
      </div>

      <div className="chat-messages" ref={messagesRef} style={{ height: '300px', overflowY: 'auto', marginBottom: '16px' }}>
        {messages.map((msg, i) => (
          <div key={i} className={`chat-bubble ${msg.role}`}>{msg.content}</div>
        ))}

        {pendingSchedule && (
          <div className="schedule-card">
            <div className="schedule-card-title">📅 이 일정을 추가할까요?</div>
            <div className="schedule-card-item">• 제목: {pendingSchedule.title}</div>
            <div className="schedule-card-item">• 날짜: {pendingSchedule.date}</div>
            <div className="schedule-card-item">• 시간: {pendingSchedule.start_time || '미정'}</div>
            <div className="schedule-card-item">• 장소: {pendingSchedule.location || '미정'}</div>
            <div className="schedule-card-item">• 카테고리: {pendingSchedule.category_name || '기본'}</div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button className="btn btn-primary" onClick={handleConfirm} disabled={isLoading} style={{ flex: 1 }}>
                예, 추가합니다
              </button>
              <button className="btn btn-secondary" onClick={handleReject} disabled={isLoading} style={{ flex: 1 }}>
                아니오
              </button>
            </div>
          </div>
        )}

        {isLoading && !pendingSchedule && (
          <div className="loading">
            <div className="spinner" />
            <span>AI가 분석 중...</span>
          </div>
        )}
      </div>

      <div className="quick-actions" style={{ marginBottom: '12px' }}>
        {quickInputs.map((text) => (
          <button key={text} className="quick-btn" onClick={() => setInput(text)}>{text}</button>
        ))}
      </div>

      <div className="chat-input-container">
        <input
          className="chat-input"
          placeholder="예: 다음주 금요일 저녁 7시 회식"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          disabled={isLoading}
        />
        <button className="chat-send" onClick={handleSend} disabled={isLoading || !input.trim()}>
          전송
        </button>
      </div>

      {messages.length > 0 && (
        <button
          className="btn btn-ghost"
          onClick={() => { setMessages([]); setPendingSchedule(null); }}
          style={{ marginTop: '12px' }}
        >
          대화 초기화
        </button>
      )}
    </Modal>
  );
};
