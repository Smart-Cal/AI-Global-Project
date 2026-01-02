import React, { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useGoalStore } from '../../store/goalStore';
import { useEventStore } from '../../store/eventStore';
import { sendChatMessage, ChatResponse } from '../../services/api';
import type { AgentMessage, SuggestedEvent, Goal } from '../../types';

const AssistantTab: React.FC = () => {
  const { user } = useAuthStore();
  const { goals, getActiveGoals } = useGoalStore();
  const { addEvent, loadEvents } = useEventStore();

  // Chat state
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [showGoalSelector, setShowGoalSelector] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeGoals = getActiveGoals();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Send message
  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    // Build message with goal context if selected
    let messageContent = input.trim();
    if (selectedGoal) {
      messageContent = `[목표: ${selectedGoal.title}] ${messageContent}`;
    }

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
      const apiResponse: ChatResponse = await sendChatMessage(messageContent);

      const suggestedEvents: SuggestedEvent[] = (apiResponse.pending_events || []).map((evt: any) => ({
        title: evt.title || '',
        date: evt.datetime ? evt.datetime.split('T')[0] : new Date().toISOString().split('T')[0],
        start_time: evt.datetime ? evt.datetime.split('T')[1]?.slice(0, 5) : undefined,
        end_time: undefined,
        location: evt.location,
        category_name: selectedGoal?.title || '기본',
        description: evt.description,
        reason: '',
        added: true, // Auto-save enabled
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleGoalSelect = (goal: Goal | null) => {
    setSelectedGoal(goal);
    setShowGoalSelector(false);
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
    setShowAttachMenu(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      // TODO: Handle file upload
      console.log('Selected files:', files);
    }
  };

  return (
    <div className="assistant-tab">
      {/* Chat Messages Area */}
      <div className="assistant-messages">
        {messages.length === 0 ? (
          <div className="assistant-welcome">
            <div className="assistant-welcome-text">"내일 오후 3시 미팅"</div>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`assistant-message ${msg.role}`}>
              {msg.role === 'assistant' && (
                <div className="assistant-avatar">AI</div>
              )}
              <div className="assistant-message-content">
                <div className="assistant-message-bubble">{msg.content}</div>
                {msg.metadata?.suggested_events && msg.metadata.suggested_events.length > 0 && (
                  <div className="assistant-events">
                    {msg.metadata.suggested_events.map((event, idx) => (
                      <div key={idx} className="assistant-event-card">
                        <div className="assistant-event-title">{event.title}</div>
                        <div className="assistant-event-info">
                          <span>{event.date}</span>
                          {event.start_time && <span>{event.start_time}</span>}
                        </div>
                        {event.added && <span className="assistant-event-added">추가됨</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {isLoading && (
          <div className="assistant-message assistant">
            <div className="assistant-avatar">AI</div>
            <div className="assistant-message-content">
              <div className="assistant-typing">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Selected Goal Indicator */}
      {selectedGoal && (
        <div className="assistant-selected-goal">
          <span className="goal-tag">
            <span className="goal-icon">🎯</span>
            {selectedGoal.title}
            <button
              className="goal-remove"
              onClick={() => setSelectedGoal(null)}
            >
              ×
            </button>
          </span>
        </div>
      )}

      {/* Input Area */}
      <div className="assistant-input-area">
        <div className="assistant-input-container">
          {/* Plus Button */}
          <div className="assistant-attach-wrapper">
            <button
              className="assistant-attach-btn"
              onClick={() => setShowAttachMenu(!showAttachMenu)}
            >
              +
            </button>

            {showAttachMenu && (
              <div className="assistant-attach-menu">
                <button onClick={handleFileSelect}>
                  <span className="attach-icon">📎</span>
                  파일 첨부
                </button>
                <button onClick={() => { setShowGoalSelector(true); setShowAttachMenu(false); }}>
                  <span className="attach-icon">🎯</span>
                  Goal 선택
                </button>
              </div>
            )}
          </div>

          {/* Text Input */}
          <input
            type="text"
            className="assistant-input"
            placeholder="무엇이든 물어보세요"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
          />

          {/* Voice Button (placeholder) */}
          <button className="assistant-voice-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </button>

          {/* Send Button */}
          <button
            className="assistant-send-btn"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L12 22M12 2L5 9M12 2L19 9" stroke="currentColor" strokeWidth="2" fill="none" />
            </svg>
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={handleFileChange}
          multiple
          accept="image/*,.pdf,.doc,.docx"
        />
      </div>

      {/* Goal Selector Modal */}
      {showGoalSelector && (
        <div className="goal-selector-overlay" onClick={() => setShowGoalSelector(false)}>
          <div className="goal-selector-modal" onClick={(e) => e.stopPropagation()}>
            <div className="goal-selector-header">
              <h3>Goal 선택</h3>
              <button onClick={() => setShowGoalSelector(false)}>×</button>
            </div>
            <div className="goal-selector-list">
              <button
                className={`goal-selector-item ${!selectedGoal ? 'selected' : ''}`}
                onClick={() => handleGoalSelect(null)}
              >
                <span className="goal-selector-icon">💬</span>
                <span>일반 대화</span>
              </button>
              {activeGoals.map((goal) => (
                <button
                  key={goal.id}
                  className={`goal-selector-item ${selectedGoal?.id === goal.id ? 'selected' : ''}`}
                  onClick={() => handleGoalSelect(goal)}
                >
                  <span className="goal-selector-icon">🎯</span>
                  <span>{goal.title}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssistantTab;
