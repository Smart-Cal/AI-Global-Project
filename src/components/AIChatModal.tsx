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
      setMessages((prev) => [...prev, { role: 'assistant', content: 'An error occurred. Please try again.' }]);
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
        is_fixed: true,
        priority: 3,
        location: pendingSchedule.location,
        description: pendingSchedule.description,
      });

      setMessages((prev) => [...prev, { role: 'assistant', content: `'${pendingSchedule.title}' event added!` }]);
      setPendingSchedule(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = () => {
    setMessages((prev) => [...prev, { role: 'assistant', content: 'Understood. Please let me know if you have other conditions!' }]);
    setPendingSchedule(null);
  };

  const quickInputs = ['Lunch appointment tomorrow', 'Dinner this Saturday', 'Meeting next week'];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="AI Schedule Assistant">
      <div style={{ background: '#E3F2FD', padding: '12px', borderRadius: '12px', marginBottom: '16px', textAlign: 'center' }}>
        <span style={{ fontSize: '13px', color: '#1565C0' }}>
          Add events using natural language!<br />e.g., 'Lunch meeting at Gangnam Station tomorrow 12 PM'
        </span>
      </div>

      <div className="chat-messages" ref={messagesRef} style={{ height: '300px', overflowY: 'auto', marginBottom: '16px' }}>
        {messages.map((msg, i) => (
          <div key={i} className={`chat-bubble ${msg.role}`}>{msg.content}</div>
        ))}

        {pendingSchedule && (
          <div className="schedule-card">
            <div className="schedule-card-title">Add this event?</div>
            <div className="schedule-card-item">• Title: {pendingSchedule.title}</div>
            <div className="schedule-card-item">• Date: {pendingSchedule.date}</div>
            <div className="schedule-card-item">• Time: {pendingSchedule.start_time || 'TBD'}</div>
            <div className="schedule-card-item">• Location: {pendingSchedule.location || 'Not specified'}</div>
            <div className="schedule-card-item">• Category: {pendingSchedule.category_name || 'Default'}</div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button className="btn btn-primary" onClick={handleConfirm} disabled={isLoading} style={{ flex: 1 }}>
                Yes, Add
              </button>
              <button className="btn btn-secondary" onClick={handleReject} disabled={isLoading} style={{ flex: 1 }}>
                No
              </button>
            </div>
          </div>
        )}

        {isLoading && !pendingSchedule && (
          <div className="loading">
            <div className="spinner" />
            <span>AI is analyzing...</span>
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
          placeholder="e.g., Team dinner next Friday 7 PM"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          disabled={isLoading}
        />
        <button className="chat-send" onClick={handleSend} disabled={isLoading || !input.trim()}>
          Send
        </button>
      </div>

      {messages.length > 0 && (
        <button
          className="btn btn-ghost"
          onClick={() => { setMessages([]); setPendingSchedule(null); }}
          style={{ marginTop: '12px' }}
        >
          Reset Chat
        </button>
      )}
    </Modal>
  );
};
