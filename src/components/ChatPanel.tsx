import React, { useState, useRef, useEffect } from 'react';
import { useEventStore } from '../store/eventStore';
import { useGoalStore } from '../store/goalStore';
import { useTodoStore } from '../store/todoStore';
import { useAuthStore } from '../store/authStore';
import { useCategoryStore } from '../store/categoryStore';
import { sendChatMessage, ChatResponse } from '../services/api';
import type { AgentMessage, SuggestedEvent } from '../types';
import { AGENT_CONFIGS, DEFAULT_CATEGORY_COLOR, CATEGORY_COLORS } from '../types';

interface ChatPanelProps {
  onClose: () => void;
}

// Interface for editing modal
interface EditingEvent {
  messageId: string;
  eventIndex: number;
  event: SuggestedEvent;
}

// Interface for slider index management
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

  // States for adding new category
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState(CATEGORY_COLORS[0]);

  const { user } = useAuthStore();
  const { events, addEvent, loadEvents } = useEventStore();
  const { goals } = useGoalStore();
  const { todos } = useTodoStore();
  const { categories, getCategoryByName, getDefaultCategory, addCategory } = useCategoryStore();

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
      // Chat with AI via backend API
      const apiResponse: ChatResponse = await sendChatMessage(userMessage.content);

      // Convert API response to AgentMessage
      const suggestedEvents: SuggestedEvent[] = (apiResponse.pending_events || []).map((evt: any) => ({
        title: evt.title || '',
        date: evt.datetime ? evt.datetime.split('T')[0] : new Date().toISOString().split('T')[0],
        start_time: evt.datetime ? evt.datetime.split('T')[1]?.slice(0, 5) : undefined,
        end_time: undefined,
        location: evt.location,
        category_name: 'Default',
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
      // Initialize slider index for new message to 0
      setSliderIndexes((prev) => ({ ...prev, [response.id]: 0 }));

      // Refresh store if events were created
      if (apiResponse.pending_events && apiResponse.pending_events.length > 0) {
        // Refresh event list
        loadEvents();
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Sorry, an error occurred. Please try again.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handler for adding new category
  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      const newCat = await addCategory(newCategoryName.trim(), newCategoryColor);
      // Update category of event being edited to the new category
      if (editingEvent) {
        setEditingEvent({
          ...editingEvent,
          event: { ...editingEvent.event, category_name: newCat.name }
        });
      }
      setShowNewCategory(false);
      setNewCategoryName('');
      setNewCategoryColor(CATEGORY_COLORS[0]);
    } catch (error) {
      console.error('Failed to add category:', error);
      alert('Failed to add category.');
    }
  };

  // Find category_id by category name
  const findCategoryId = (categoryName?: string): string | undefined => {
    if (!categoryName) {
      const defaultCat = getDefaultCategory();
      return defaultCat?.id;
    }

    // Find exactly matching category
    const exactMatch = getCategoryByName(categoryName);
    if (exactMatch) return exactMatch.id;

    // Return default category
    const defaultCat = getDefaultCategory();
    return defaultCat?.id;
  };

  const handleAddSuggestedEvent = async (event: SuggestedEvent, messageId: string, eventIndex: number) => {
    if (!user) {
      console.error('User not logged in');
      alert('Login is required.');
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
        is_fixed: true,
        priority: 3 as const,
      };

      console.log('Adding event:', eventData);
      const result = await addEvent(eventData);
      console.log('Add event result:', result);

      if (result) {
        // Update schedule card to 'Added' status
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
        alert('Failed to add event. Please try again.');
      }
    } catch (error) {
      console.error('Failed to add event:', error);
      alert('An error occurred while adding the event.');
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
        is_fixed: true,
        priority: 3 as const,
      };

      console.log('Saving edited event:', eventData);
      const result = await addEvent(eventData);
      console.log('Save result:', result);

      if (result) {
        // Update schedule card to 'Added' status
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
        alert('Failed to add event. Please try again.');
      }
    } catch (error) {
      console.error('Failed to save edited event:', error);
      alert('An error occurred while adding the event.');
    }
  };

  // Slider navigation
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

  // Get category info by category name or ID
  const getCategoryInfo = (categoryName?: string) => {
    if (!categoryName) {
      const defaultCat = getDefaultCategory();
      return { name: defaultCat?.name || 'Default', color: defaultCat?.color || DEFAULT_CATEGORY_COLOR };
    }
    const cat = getCategoryByName(categoryName);
    if (cat) {
      return { name: cat.name, color: cat.color };
    }
    const defaultCat = getDefaultCategory();
    return { name: categoryName, color: defaultCat?.color || DEFAULT_CATEGORY_COLOR };
  };

  const quickPrompts = [
    'Plan exercise schedule for this week',
    'Schedule a dinner for tomorrow evening',
    'Recommend study plan for TOEIC',
    'Plan a weekend trip',
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
        {/* Slider Header */}
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

        {/* Current Schedule Card */}
        <div
          key={`${msg.id}-${currentIndex}`}
          className={`schedule-card ${isAdded ? 'added' : ''} ${isRejected ? 'rejected' : ''}`}
        >
          <div className="schedule-card-header">
            <span
              className="schedule-card-category"
              style={{ backgroundColor: categoryInfo.color, color: '#fff', padding: '2px 8px', borderRadius: '4px' }}
            >
              {categoryInfo.name}
            </span>
            {isAdded && <span className="schedule-card-status added">Added</span>}
            {isRejected && <span className="schedule-card-status rejected">Rejected</span>}
          </div>

          <div className="schedule-card-title">{event.title}</div>

          <div className="schedule-card-info">
            <div className="schedule-card-row">
              <span>{event.date}</span>
            </div>
            {event.start_time && (
              <div className="schedule-card-row">
                <span>{formatTime(event.start_time)}{event.end_time && ` ~ ${formatTime(event.end_time)}`}</span>
              </div>
            )}
            {event.location && (
              <div className="schedule-card-row">
                <span>{event.location}</span>
              </div>
            )}
            {event.description && (
              <div className="schedule-card-row description">
                <span>{event.description}</span>
              </div>
            )}
            {event.reason && (
              <div className="schedule-card-row reason">
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
                ✓ Add
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => handleOpenEditModal(event, msg.id, currentIndex)}
              >
                ✎ Edit
              </button>
              <button
                className="btn btn-danger-outline btn-sm"
                onClick={() => handleRejectEvent(msg.id, currentIndex)}
              >
                ✕ Reject
              </button>
            </div>
          )}
        </div>

        {/* All schedule status indicator (dots) */}
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
        <span className="panel-title">AI Scheduler</span>
        <button className="panel-close" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-title">AI Scheduler</div>
            <div className="empty-state-text">
              Tell me what you want to schedule.
              <br />
              Example: "Plan exercise schedule for this week"
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
                    <span className="schedule-card-category">Place Recommendation</span>
                  </div>
                  <div className="schedule-card-title">{place.name}</div>
                  <div className="schedule-card-info">
                    <div className="schedule-card-row">
                      <span>{place.category}</span>
                    </div>
                    {place.address && (
                      <div className="schedule-card-row">
                        <span>{place.address}</span>
                      </div>
                    )}
                    {place.reason && (
                      <div className="schedule-card-row reason">
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
            placeholder="Type your request here..."
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

      {/* Edit Modal */}
      {editingEvent && (
        <div className="modal-overlay" onClick={() => setEditingEvent(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Edit Event</div>
              <button className="modal-close" onClick={() => setEditingEvent(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Title</label>
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
                <label className="form-label">Date</label>
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
                  <label className="form-label">Start Time</label>
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
                  <label className="form-label">End Time</label>
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
                <label className="form-label">Location</label>
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
                <label className="form-label">Category</label>
                <div className="category-select" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {categories.map((cat) => (
                    <div
                      key={cat.id}
                      className={`category-option ${editingEvent.event.category_name === cat.name ? 'selected' : ''}`}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '16px',
                        border: `2px solid ${editingEvent.event.category_name === cat.name ? cat.color : '#E5E7EB'}`,
                        backgroundColor: editingEvent.event.category_name === cat.name ? `${cat.color}20` : 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '13px',
                        transition: 'all 0.2s',
                      }}
                      onClick={() => setEditingEvent({
                        ...editingEvent,
                        event: { ...editingEvent.event, category_name: cat.name }
                      })}
                    >
                      <span
                        style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          backgroundColor: cat.color,
                        }}
                      />
                      <span>{cat.name}</span>
                    </div>
                  ))}
                  <div
                    className="category-option add-new"
                    style={{
                      padding: '6px 12px',
                      borderRadius: '16px',
                      border: '2px dashed #D1D5DB',
                      backgroundColor: 'white',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '13px',
                      color: '#6B7280',
                    }}
                    onClick={() => setShowNewCategory(true)}
                  >
                    <span>+ New Category</span>
                  </div>
                </div>

                {showNewCategory && (
                  <div
                    className="new-category-form"
                    style={{
                      marginTop: '12px',
                      padding: '12px',
                      backgroundColor: '#F9FAFB',
                      borderRadius: '8px',
                      border: '1px solid #E5E7EB',
                    }}
                  >
                    <div className="form-group" style={{ marginBottom: '10px' }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="New category name"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        style={{ fontSize: '13px' }}
                      />
                    </div>
                    <div style={{ marginBottom: '10px' }}>
                      <label style={{ fontSize: '12px', color: '#6B7280', marginBottom: '6px', display: 'block' }}>
                        Select Color
                      </label>
                      <div className="color-picker" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {CATEGORY_COLORS.map((color) => (
                          <div
                            key={color}
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              backgroundColor: color,
                              cursor: 'pointer',
                              border: newCategoryColor === color ? '3px solid #374151' : '2px solid transparent',
                              boxSizing: 'border-box',
                            }}
                            onClick={() => setNewCategoryColor(color)}
                          />
                        ))}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        className="btn btn-primary"
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                        onClick={handleAddCategory}
                      >
                        Add
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                        onClick={() => {
                          setShowNewCategory(false);
                          setNewCategoryName('');
                          setNewCategoryColor(CATEGORY_COLORS[0]);
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Memo</label>
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
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSaveEditedEvent}>
                Save and Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
