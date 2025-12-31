import React, { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useGoalStore } from '../../store/goalStore';
import { useEventStore } from '../../store/eventStore';
import { useCategoryStore } from '../../store/categoryStore';
import { sendChatMessage, ChatResponse } from '../../services/api';
import type { AgentMessage, SuggestedEvent, Goal } from '../../types';

const AssistantView: React.FC = () => {
  const { user } = useAuthStore();
  const { goals, getActiveGoals } = useGoalStore();
  const { addEvent, loadEvents } = useEventStore();
  const { getDefaultCategory, getCategoryByName } = useCategoryStore();

  // Chat state
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [showGoalSelector, setShowGoalSelector] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeGoals = getActiveGoals();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
      const apiResponse: ChatResponse = await sendChatMessage(messageContent, true);

      const suggestedEvents: SuggestedEvent[] = (apiResponse.events || []).map((evt: any) => ({
        title: evt.title || '',
        date: evt.datetime ? evt.datetime.split('T')[0] : new Date().toISOString().split('T')[0],
        start_time: evt.datetime ? evt.datetime.split('T')[1]?.slice(0, 5) : undefined,
        end_time: undefined,
        location: evt.location,
        category_name: selectedGoal?.title || '기본',
        description: evt.description,
        reason: '',
        added: true,
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

      if (apiResponse.events && apiResponse.events.length > 0) {
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

  return (
    <div className="assistant-view">
      {/* Chat Messages Area */}
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-welcome">
            <p>일정을 추가하거나 관리하고 싶은 내용을 말씀해주세요.</p>
            <div className="chat-welcome-example">
              <span>"내일 오후 3시 미팅"</span>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`chat-message ${msg.role}`}>
              <div className="message-bubble">
                {msg.content}
              </div>
              {msg.metadata?.suggested_events && msg.metadata.suggested_events.length > 0 && (
                <div className="suggested-events">
                  {msg.metadata.suggested_events.map((event, idx) => (
                    <div key={idx} className="schedule-card compact">
                      <div className="schedule-card-title">{event.title}</div>
                      <div className="schedule-card-info">
                        <span>📅 {event.date}</span>
                        {event.start_time && <span>🕐 {event.start_time}</span>}
                      </div>
                      {event.added && <span className="schedule-card-status added">추가됨</span>}
                    </div>
                  ))}
                </div>
              )}
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
                onClick={() => handleGoalSelect(null)}
              >
                <span>💬</span>
                <span>일반 대화</span>
              </div>
              {activeGoals.map((goal) => (
                <div
                  key={goal.id}
                  className={`goal-selector-item ${selectedGoal?.id === goal.id ? 'selected' : ''}`}
                  onClick={() => handleGoalSelect(goal)}
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
  );
};

export default AssistantView;
