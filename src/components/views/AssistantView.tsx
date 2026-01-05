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
  confirmTodos,
  confirmGoals,
  saveResultMessage,
  type Conversation,
  type Message,
  type PendingEvent,
  type PendingTodo,
  type PendingGoal,
  type MCPResponseData,
  type MCPPlaceResult,
  type MCPProductResult,
  type MCPNewsResult,
} from '../../services/api';
import DatePicker from '../DatePicker';
import TimePicker from '../TimePicker';
import { useToast } from '../Toast';
import { useConfirm } from '../ConfirmModal';
import type { Goal } from '../../types';

interface LocalMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  pending_events?: PendingEvent[];
  pending_todos?: PendingTodo[];
  pending_goals?: PendingGoal[];
  mcp_data?: MCPResponseData;  // MCP data ("Acting AI" feature)
  created_at: string;
}

// Selection state for each item
type ItemDecision = 'pending' | 'confirmed' | 'rejected';

interface DecisionState {
  [index: number]: ItemDecision;
}

// Alias for compatibility
type EventDecision = ItemDecision;
type EventDecisionState = DecisionState;

interface AssistantViewProps {
  initialMessage?: string | null;
  onInitialMessageConsumed?: () => void;
}

const AssistantView: React.FC<AssistantViewProps> = ({ initialMessage, onInitialMessageConsumed }) => {
  const { user } = useAuthStore();
  const { getActiveGoals } = useGoalStore();
  const { loadEvents, events } = useEventStore();
  const { categories, fetchCategories, addCategory } = useCategoryStore();
  const { showToast } = useToast();
  const { confirm } = useConfirm();

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

  // Event confirmation state - managed by message ID
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [activeItemType, setActiveItemType] = useState<'event' | 'todo' | 'goal' | null>(null);
  const [eventDecisions, setEventDecisions] = useState<EventDecisionState>({});
  const [editingEvents, setEditingEvents] = useState<{ [index: number]: PendingEvent }>({});
  // useRef to always reference the latest value of editingEvents
  const editingEventsRef = useRef<{ [index: number]: PendingEvent }>({});

  // TODO confirmation state
  const [todoDecisions, setTodoDecisions] = useState<DecisionState>({});
  const [editingTodos, setEditingTodos] = useState<{ [index: number]: PendingTodo }>({});

  // Goal confirmation state
  const [goalDecisions, setGoalDecisions] = useState<DecisionState>({});
  const [editingGoals, setEditingGoals] = useState<{ [index: number]: PendingGoal }>({});

  const [isSaving, setIsSaving] = useState(false);
  const [completedResults, setCompletedResults] = useState<{
    messageId: string;
    type: 'event' | 'todo' | 'goal';
    confirmedCount: number;
    rejectedCount: number;
    items?: any[];
  } | null>(null);

  // New category addition state
  const [showNewCategoryInput, setShowNewCategoryInput] = useState<{
    type: 'event' | 'todo' | 'goal';
    index: number;
  } | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#6366f1');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [showColorPalette, setShowColorPalette] = useState(false);

  // Carousel state for MCP data
  const [carouselIndices, setCarouselIndices] = useState<{ [key: string]: number }>({});

  // Color palette
  const colorPalette = [
    '#ef4444', // Red
    '#f97316', // Orange
    '#f59e0b', // Yellow
    '#22c55e', // Green
    '#14b8a6', // Teal
    '#3b82f6', // Blue
    '#6366f1', // Indigo
    '#8b5cf6', // Purple
    '#ec4899', // Pink
    '#6b7280', // Gray
  ];

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeGoals = getActiveGoals();

  // Load conversations and categories on mount
  useEffect(() => {
    loadConversations();
    fetchCategories();
  }, []);

  // Reference for pending initial message to send
  const pendingInitialMessageRef = useRef<string | null>(null);

  // Handle initial message from dashboard
  useEffect(() => {
    if (initialMessage && !isLoading) {
      pendingInitialMessageRef.current = initialMessage;
      setInput(initialMessage);
      onInitialMessageConsumed?.();
    }
  }, [initialMessage]);

  // Auto-send when input is set from initial message
  useEffect(() => {
    if (pendingInitialMessageRef.current && input === pendingInitialMessageRef.current && !isLoading) {
      pendingInitialMessageRef.current = null;
      // Trigger send
      handleSendWithMessage(input);
    }
  }, [input]);

  // Debugging: Check category state
  useEffect(() => {
    console.log('[AssistantView] Categories updated:', categories);
  }, [categories]);

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
      setMessages(response.messages.map((m: any) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        pending_events: m.pending_events,
        pending_todos: m.pending_todos,
        pending_goals: m.pending_goals,
        mcp_data: m.mcp_data, // Include saved MCP data (products, places, etc.)
        created_at: m.created_at,
      })));
      resetConfirmationState();
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  const resetConfirmationState = () => {
    setActiveMessageId(null);
    setActiveItemType(null);
    setEventDecisions({});
    setEditingEvents({});
    editingEventsRef.current = {}; // also reset ref
    setTodoDecisions({});
    setEditingTodos({});
    setGoalDecisions({});
    setEditingGoals({});
    setCompletedResults(null);
  };

  const handleNewConversation = () => {
    setCurrentConversationId(null);
    setMessages([]);
    resetConfirmationState();
  };

  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = await confirm({
      title: 'Delete Conversation',
      message: 'Are you sure you want to delete this conversation?',
      confirmText: 'Delete',
      confirmVariant: 'danger'
    });
    if (!confirmed) return;

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

  // Send message with specific content (for initial message from dashboard)
  const handleSendWithMessage = async (messageToSend: string) => {
    if (!messageToSend.trim() || isLoading) return;

    let messageContent = messageToSend.trim();
    if (selectedGoal) {
      messageContent = `[Goal: ${selectedGoal.title}] ${messageContent}`;
    }

    // Add user message locally
    const userMessage: LocalMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: messageToSend.trim(),
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setCompletedResults(null);

    try {
      const response = await sendChatMessage(messageContent, currentConversationId || undefined, 'auto');

      console.log('[AssistantView] API Response:', response);

      if (!currentConversationId) {
        setCurrentConversationId(response.conversation_id);
        loadConversations();
      }

      let contentMessage = response.message;
      if (response.pending_events && response.pending_events.length > 0) {
        contentMessage = 'How about these events?';
      } else if (response.pending_todos && response.pending_todos.length > 0) {
        contentMessage = 'How about these todos?';
      } else if (response.pending_goals && response.pending_goals.length > 0) {
        contentMessage = 'How about these goals?';
      }

      const assistantMessage: LocalMessage = {
        id: response.message_id,
        role: 'assistant',
        content: contentMessage,
        pending_events: response.pending_events,
        pending_todos: response.pending_todos,
        pending_goals: response.pending_goals,
        mcp_data: response.mcp_data,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMessage]);

      if (response.pending_events && response.pending_events.length > 0) {
        loadEvents();
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'An error occurred. Please try again.',
        created_at: new Date().toISOString(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Send message
  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    let messageContent = input.trim();
    if (selectedGoal) {
      messageContent = `[Goal: ${selectedGoal.title}] ${messageContent}`;
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
      const response = await sendChatMessage(messageContent, currentConversationId || undefined, 'auto');

      // Debugging: Check API response
      console.log('[AssistantView] API Response:', response);
      console.log('[AssistantView] pending_goals:', response.pending_goals);
      console.log('[AssistantView] pending_events:', response.pending_events);
      console.log('[AssistantView] pending_todos:', response.pending_todos);

      // Update conversation ID if new
      if (!currentConversationId) {
        setCurrentConversationId(response.conversation_id);
        loadConversations();
      }

      // Determine content message based on what's pending
      let contentMessage = response.message;
      if (response.pending_events && response.pending_events.length > 0) {
        contentMessage = 'How about these events?';
      } else if (response.pending_todos && response.pending_todos.length > 0) {
        contentMessage = 'How about these todos?';
      } else if (response.pending_goals && response.pending_goals.length > 0) {
        contentMessage = 'How about these goals?';
      }

      // Add assistant message
      const assistantMessage: LocalMessage = {
        id: response.message_id,
        role: 'assistant',
        content: contentMessage,
        pending_events: response.pending_events,
        pending_todos: response.pending_todos,
        pending_goals: response.pending_goals,
        mcp_data: response.mcp_data,  // Add MCP data
        created_at: new Date().toISOString(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Set up confirmation UI based on type
      resetConfirmationState();
      if (response.pending_events && response.pending_events.length > 0) {
        setActiveMessageId(response.message_id);
        setActiveItemType('event');
      } else if (response.pending_todos && response.pending_todos.length > 0) {
        setActiveMessageId(response.message_id);
        setActiveItemType('todo');
      } else if (response.pending_goals && response.pending_goals.length > 0) {
        setActiveMessageId(response.message_id);
        setActiveItemType('goal');
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Sorry, an error occurred. Please try again.',
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
    console.log('[handleEditEvent] Called with:', { index, field, value, activeMessageId });
    const currentEvents = messages.find(m => m.id === activeMessageId)?.pending_events || [];
    console.log('[handleEditEvent] currentEvents:', currentEvents);
    // Get latest value from editingEventsRef
    const currentEvent = editingEventsRef.current[index] || currentEvents[index];
    console.log('[handleEditEvent] currentEvent:', currentEvent);
    if (!currentEvent) {
      console.error('[handleEditEvent] No currentEvent found!');
      return;
    }
    const updatedEvent = { ...currentEvent, [field]: value };
    console.log('[handleEditEvent] updatedEvent:', updatedEvent);

    // Update ref first (synchronous)
    editingEventsRef.current = {
      ...editingEventsRef.current,
      [index]: updatedEvent
    };
    console.log('[handleEditEvent] Updated editingEventsRef:', editingEventsRef.current);

    // Also update state (for UI re-rendering)
    setEditingEvents(prev => {
      const newState = {
        ...prev,
        [index]: updatedEvent
      };
      console.log('[handleEditEvent] New editingEvents state:', newState);
      return newState;
    });
  };

  // Extract date part from datetime (YYYY-MM-DD)
  const getDateFromDatetime = (datetime: string): string => {
    return datetime.split('T')[0];
  };

  // Extract time part from datetime (HH:mm)
  const getTimeFromDatetime = (datetime: string): string => {
    const timePart = datetime.split('T')[1];
    return timePart ? timePart.slice(0, 5) : '';
  };

  // Combine date and time to create datetime
  const combineDatetime = (date: string, time: string): string => {
    return `${date}T${time}:00`;
  };

  // Separate duration into hours and minutes
  const getDurationHours = (duration: number): number => {
    return Math.floor(duration / 60);
  };

  const getDurationMinutes = (duration: number): number => {
    return duration % 60;
  };

  // Combine hours and minutes to create duration (in minutes)
  const combineDuration = (hours: number, minutes: number): number => {
    return hours * 60 + minutes;
  };

  const getEventWithEdits = (index: number, originalEvent: PendingEvent): PendingEvent => {
    // Get latest value from editingEventsRef (prevents closure issues)
    const edited = editingEventsRef.current[index];
    console.log('[getEventWithEdits] index:', index, 'edited:', edited, 'original:', originalEvent);
    return edited || originalEvent;
  };

  // Check if all events have been processed
  const allEventsProcessed = (pendingEvents: PendingEvent[]) => {
    return pendingEvents.every((_, index) =>
      eventDecisions[index] === 'confirmed' || eventDecisions[index] === 'rejected'
    );
  };

  // Final confirmation handler - Events
  const handleFinalConfirmEvents = async (pendingEvents: PendingEvent[]) => {
    setIsSaving(true);

    const confirmedEvents: PendingEvent[] = [];
    const rejectedCount = Object.values(eventDecisions).filter(d => d === 'rejected').length;

    console.log('[handleFinalConfirmEvents] editingEvents:', editingEvents);
    console.log('[handleFinalConfirmEvents] pendingEvents:', pendingEvents);

    for (let i = 0; i < pendingEvents.length; i++) {
      if (eventDecisions[i] === 'confirmed') {
        const eventWithEdits = getEventWithEdits(i, pendingEvents[i]);
        console.log(`[handleFinalConfirmEvents] Event ${i} with edits:`, eventWithEdits);
        confirmedEvents.push(eventWithEdits);
      }
    }

    console.log('[handleFinalConfirmEvents] confirmedEvents to save:', confirmedEvents);

    try {
      let followUpMessage = '';
      let followUpMcpData: any = null;

      if (confirmedEvents.length > 0) {
        const result = await confirmEvents(confirmedEvents);
        loadEvents();

        // Check for follow-up recommendations from the API
        if (result.has_follow_up && result.message) {
          followUpMessage = result.message;
          followUpMcpData = result.mcp_data;
        }
      }

      // Generate result message
      let resultContent = '';
      if (followUpMessage) {
        // Use the AI-generated follow-up message
        resultContent = followUpMessage;
      } else if (confirmedEvents.length > 0) {
        resultContent = `✅ ${confirmedEvents.length} event${confirmedEvents.length > 1 ? 's' : ''} added`;
        if (rejectedCount > 0) {
          resultContent += ` (${rejectedCount} rejected)`;
        }
      } else {
        resultContent = 'No events added';
        if (rejectedCount > 0) {
          resultContent += ` (${rejectedCount} rejected)`;
        }
      }

      // Save result message to conversation history
      if (currentConversationId) {
        const savedResult = await saveResultMessage(currentConversationId, resultContent);

        // Add result message to local message list (with MCP data if available)
        const resultMessage: LocalMessage = {
          id: savedResult.message_id,
          role: 'assistant',
          content: resultContent,
          created_at: new Date().toISOString(),
          mcp_data: followUpMcpData,
        };
        setMessages(prev => [...prev, resultMessage]);
      }

      // Display results (for UI)
      setCompletedResults({
        messageId: activeMessageId!,
        type: 'event',
        confirmedCount: confirmedEvents.length,
        rejectedCount,
        items: confirmedEvents,
      });

      // Reset state
      resetConfirmationState();

      // Toast notification
      if (confirmedEvents.length > 0) {
        showToast(`${confirmedEvents.length} event${confirmedEvents.length > 1 ? 's' : ''} added`, 'success');
      }
    } catch (error) {
      console.error('Failed to save events:', error);
      showToast('Failed to save events', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Final confirmation handler - TODOs
  const handleFinalConfirmTodos = async (pendingTodos: PendingTodo[]) => {
    setIsSaving(true);

    const confirmedTodos: PendingTodo[] = [];
    const rejectedCount = Object.values(todoDecisions).filter(d => d === 'rejected').length;

    for (let i = 0; i < pendingTodos.length; i++) {
      if (todoDecisions[i] === 'confirmed') {
        const todoWithEdits = editingTodos[i] || pendingTodos[i];
        confirmedTodos.push(todoWithEdits);
      }
    }

    try {
      if (confirmedTodos.length > 0) {
        await confirmTodos(confirmedTodos);
      }

      // Generate result message
      let resultContent = '';
      if (confirmedTodos.length > 0) {
        resultContent = `${confirmedTodos.length} todo${confirmedTodos.length > 1 ? 's' : ''} added`;
        if (rejectedCount > 0) {
          resultContent += ` (${rejectedCount} rejected)`;
        }
      } else {
        resultContent = 'No todos added';
        if (rejectedCount > 0) {
          resultContent += ` (${rejectedCount} rejected)`;
        }
      }

      // Save result message to conversation history
      if (currentConversationId) {
        const savedResult = await saveResultMessage(currentConversationId, resultContent);
        const resultMessage: LocalMessage = {
          id: savedResult.message_id,
          role: 'assistant',
          content: resultContent,
          created_at: new Date().toISOString(),
        };
        setMessages(prev => [...prev, resultMessage]);
      }

      setCompletedResults({
        messageId: activeMessageId!,
        type: 'todo',
        confirmedCount: confirmedTodos.length,
        rejectedCount,
        items: confirmedTodos,
      });

      resetConfirmationState();

      // Toast notification
      if (confirmedTodos.length > 0) {
        showToast(`${confirmedTodos.length} todo${confirmedTodos.length > 1 ? 's' : ''} added`, 'success');
      }
    } catch (error) {
      console.error('Failed to save todos:', error);
      showToast('Failed to save todos', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Final confirmation handler - Goals
  const handleFinalConfirmGoals = async (pendingGoals: PendingGoal[]) => {
    setIsSaving(true);

    const confirmedGoals: PendingGoal[] = [];
    const rejectedCount = Object.values(goalDecisions).filter(d => d === 'rejected').length;

    for (let i = 0; i < pendingGoals.length; i++) {
      if (goalDecisions[i] === 'confirmed') {
        const goalWithEdits = editingGoals[i] || pendingGoals[i];
        confirmedGoals.push(goalWithEdits);
      }
    }

    try {
      if (confirmedGoals.length > 0) {
        await confirmGoals(confirmedGoals);
      }

      // Generate result message
      let resultContent = '';
      if (confirmedGoals.length > 0) {
        resultContent = `${confirmedGoals.length} goal${confirmedGoals.length > 1 ? 's' : ''} added`;
        if (rejectedCount > 0) {
          resultContent += ` (${rejectedCount} rejected)`;
        }
      } else {
        resultContent = 'No goals added';
        if (rejectedCount > 0) {
          resultContent += ` (${rejectedCount} rejected)`;
        }
      }

      // Save result message to conversation history
      if (currentConversationId) {
        const savedResult = await saveResultMessage(currentConversationId, resultContent);
        const resultMessage: LocalMessage = {
          id: savedResult.message_id,
          role: 'assistant',
          content: resultContent,
          created_at: new Date().toISOString(),
        };
        setMessages(prev => [...prev, resultMessage]);
      }

      setCompletedResults({
        messageId: activeMessageId!,
        type: 'goal',
        confirmedCount: confirmedGoals.length,
        rejectedCount,
        items: confirmedGoals,
      });

      resetConfirmationState();

      // Toast notification
      if (confirmedGoals.length > 0) {
        showToast(`${confirmedGoals.length} goal${confirmedGoals.length > 1 ? 's' : ''} added`, 'success');
      }
    } catch (error) {
      console.error('Failed to save goals:', error);
      showToast('Failed to save goals', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // TODO decision handlers
  const handleTodoDecision = (index: number, decision: ItemDecision) => {
    setTodoDecisions(prev => ({ ...prev, [index]: decision }));
  };

  const handleEditTodo = (index: number, field: keyof PendingTodo, value: any) => {
    const currentTodos = messages.find(m => m.id === activeMessageId)?.pending_todos || [];
    const currentTodo = editingTodos[index] || currentTodos[index];
    setEditingTodos(prev => ({
      ...prev,
      [index]: { ...currentTodo, [field]: value }
    }));
  };

  // Goal decision handlers
  const handleGoalDecision = (index: number, decision: ItemDecision) => {
    setGoalDecisions(prev => ({ ...prev, [index]: decision }));
  };

  const handleEditGoal = (index: number, field: keyof PendingGoal, value: any) => {
    const currentGoals = messages.find(m => m.id === activeMessageId)?.pending_goals || [];
    const currentGoal = editingGoals[index] || currentGoals[index];
    setEditingGoals(prev => ({
      ...prev,
      [index]: { ...currentGoal, [field]: value }
    }));
  };

  // Check if all TODOs have been processed
  const allTodosProcessed = (pendingTodos: PendingTodo[]) => {
    return pendingTodos.every((_, index) =>
      todoDecisions[index] === 'confirmed' || todoDecisions[index] === 'rejected'
    );
  };

  // Check if all Goals have been processed
  const allGoalsProcessed = (pendingGoals: PendingGoal[]) => {
    return pendingGoals.every((_, index) =>
      goalDecisions[index] === 'confirmed' || goalDecisions[index] === 'rejected'
    );
  };

  const formatEventDateTime = (datetime: string) => {
    // Parse datetime directly to prevent timezone issues
    // Format: "YYYY-MM-DDTHH:mm:ss" or "YYYY-MM-DDTHH:mm"
    const [datePart, timePart] = datetime.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes] = (timePart || '00:00').split(':').map(Number);

    // Create local date object for day of week calculation
    const date = new Date(year, month - 1, day);
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weekday = weekdays[date.getDay()];

    const ampm = hours < 12 ? 'AM' : 'PM';
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    const displayMinutes = (minutes || 0).toString().padStart(2, '0');

    return `${month}/${day} (${weekday}) ${ampm} ${displayHours}:${displayMinutes}`;
  };

  const formatShortDateTime = (datetime: string) => {
    // Parse datetime directly to prevent timezone issues
    const [datePart, timePart] = datetime.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes] = (timePart || '00:00').split(':').map(Number);

    // Create local date object for day of week calculation
    const date = new Date(year, month - 1, day);
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weekday = weekdays[date.getDay()];

    const ampm = hours < 12 ? 'AM' : 'PM';
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    const displayMinutes = (minutes || 0).toString().padStart(2, '0');

    return `${month}/${day}(${weekday}) ${ampm}${displayHours}:${displayMinutes}`;
  };

  // Time conflict check function
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

  // New category creation handler
  const handleCreateCategory = async (type: 'event' | 'todo' | 'goal', index: number) => {
    // Prevent duplicate calls if already creating
    if (isCreatingCategory) {
      console.log('[handleCreateCategory] Already creating, skipping...');
      return;
    }

    const categoryName = newCategoryName.trim();
    if (!categoryName) {
      showToast('Please enter a category name', 'error');
      return;
    }

    // Check if category already exists
    const existingCategory = categories.find(
      cat => cat.name.toLowerCase() === categoryName.toLowerCase()
    );
    if (existingCategory) {
      console.log('[handleCreateCategory] Category already exists:', existingCategory);
      // Select existing category
      if (type === 'event') {
        handleEditEvent(index, 'category', existingCategory.name);
      } else if (type === 'todo') {
        handleEditTodo(index, 'category', existingCategory.name);
      } else if (type === 'goal') {
        handleEditGoal(index, 'category', existingCategory.name);
      }
      showToast(`"${existingCategory.name}" category selected`, 'info');
      setShowNewCategoryInput(null);
      setNewCategoryName('');
      setNewCategoryColor('#6366f1');
      setShowColorPalette(false);
      return;
    }

    console.log('[handleCreateCategory] Creating category:', { type, index, name: categoryName, color: newCategoryColor });
    console.log('[handleCreateCategory] activeMessageId:', activeMessageId);

    setIsCreatingCategory(true);
    try {
      const newCategory = await addCategory(categoryName, newCategoryColor);
      console.log('[handleCreateCategory] Created category:', newCategory);

      // Set created category to the item
      if (type === 'event') {
        console.log('[handleCreateCategory] Calling handleEditEvent for index:', index);
        handleEditEvent(index, 'category', newCategory.name);
      } else if (type === 'todo') {
        console.log('[handleCreateCategory] Calling handleEditTodo for index:', index);
        handleEditTodo(index, 'category', newCategory.name);
      } else if (type === 'goal') {
        console.log('[handleCreateCategory] Calling handleEditGoal for index:', index);
        handleEditGoal(index, 'category', newCategory.name);
      }

      showToast(`"${newCategory.name}" category created`, 'success');
      setShowNewCategoryInput(null);
      setNewCategoryName('');
      setNewCategoryColor('#6366f1');
      setShowColorPalette(false);
    } catch (error) {
      console.error('Failed to create category:', error);
      showToast('Failed to create category', 'error');
    } finally {
      setIsCreatingCategory(false);
    }
  };

  // Render category select component
  const renderCategorySelect = (
    type: 'event' | 'todo' | 'goal',
    index: number,
    currentValue: string | undefined,
    onChange: (value: string) => void,
    disabled: boolean
  ) => {
    const isAddingNew = showNewCategoryInput?.type === type && showNewCategoryInput?.index === index;

    if (isAddingNew) {
      return (
        <div style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: '6px',
          width: '100%',
          flexWrap: 'nowrap',
          height: '36px'
        }}>
          <input
            type="text"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="Category name"
            style={{
              flex: '1 1 auto',
              minWidth: '80px',
              height: '36px',
              padding: '8px 12px',
              fontSize: '14px',
              border: '1px solid var(--primary)',
              borderRadius: '6px',
              outline: 'none',
              boxSizing: 'border-box'
            }}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleCreateCategory(type, index);
              } else if (e.key === 'Escape') {
                setShowNewCategoryInput(null);
                setNewCategoryName('');
                setNewCategoryColor('#6366f1');
                setShowColorPalette(false);
              }
            }}
            disabled={isCreatingCategory}
          />
          {/* Color selection button */}
          <button
            type="button"
            style={{
              width: '36px',
              height: '36px',
              minWidth: '36px',
              padding: '4px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              cursor: 'pointer',
              backgroundColor: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxSizing: 'border-box'
            }}
            onClick={() => setShowColorPalette(!showColorPalette)}
            disabled={isCreatingCategory}
            title="Select color"
          >
            <span style={{
              width: '22px',
              height: '22px',
              borderRadius: '4px',
              backgroundColor: newCategoryColor,
              display: 'block'
            }} />
          </button>
          {/* Confirm Button */}
          <button
            style={{
              width: '36px',
              height: '36px',
              minWidth: '36px',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              backgroundColor: '#10b981',
              color: 'white',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxSizing: 'border-box'
            }}
            onClick={() => handleCreateCategory(type, index)}
            disabled={isCreatingCategory || !newCategoryName.trim()}
          >
            {isCreatingCategory ? '·' : '✓'}
          </button>
          {/* Cancel Button */}
          <button
            style={{
              width: '36px',
              height: '36px',
              minWidth: '36px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              cursor: 'pointer',
              backgroundColor: '#f3f4f6',
              color: '#6b7280',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxSizing: 'border-box'
            }}
            onClick={() => {
              setShowNewCategoryInput(null);
              setNewCategoryName('');
              setNewCategoryColor('#6366f1');
              setShowColorPalette(false);
            }}
            disabled={isCreatingCategory}
          >
            ✕
          </button>
          {/* Color palette dropdown */}
          {showColorPalette && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: '4px',
              padding: '8px',
              backgroundColor: 'white',
              border: '1px solid #ddd',
              borderRadius: '6px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              display: 'flex',
              gap: '6px',
              flexWrap: 'wrap',
              zIndex: 100,
              width: 'max-content'
            }}>
              {colorPalette.map((color) => (
                <button
                  key={color}
                  type="button"
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '4px',
                    backgroundColor: color,
                    border: newCategoryColor === color ? '2px solid #333' : '2px solid transparent',
                    cursor: 'pointer',
                    padding: 0,
                    outline: 'none',
                    boxShadow: newCategoryColor === color ? '0 0 0 2px white, 0 0 0 4px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.1)'
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setNewCategoryColor(color);
                    setShowColorPalette(false);
                  }}
                  disabled={isCreatingCategory}
                  title={color}
                />
              ))}
            </div>
          )}
        </div>
      );
    }

    const selectedCategory = categories.find(cat => cat.name === currentValue);

    return (
      <div className="category-select-wrapper">
        <div
          className="category-select-current"
          style={{ borderLeftColor: selectedCategory?.color || 'transparent' }}
        >
          {selectedCategory && (
            <span
              className="category-color-box"
              style={{ backgroundColor: selectedCategory.color }}
            />
          )}
          <select
            value={currentValue || ''}
            onChange={(e) => {
              console.log('[renderCategorySelect] onChange:', { type, index, value: e.target.value });
              if (e.target.value === '__new__') {
                setShowNewCategoryInput({ type, index });
                setNewCategoryName('');
              } else {
                console.log('[renderCategorySelect] Calling onChange callback with:', e.target.value);
                onChange(e.target.value);
              }
            }}
            disabled={disabled}
          >
            <option value="">Select</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.name}>{cat.name}</option>
            ))}
            <option value="__new__">+ Add new category</option>
          </select>
        </div>
      </div>
    );
  };

  // Render event card (inline)
  const renderEventCard = (event: PendingEvent, index: number, isActive: boolean) => {
    const eventWithEdits = getEventWithEdits(index, event);
    const decision = eventDecisions[index];
    const conflicts = checkTimeConflict(eventWithEdits);

    if (!isActive) {
      // Inactive state - simple display
      return (
        <div key={index} className={`event-card-inline ${decision || ''}`}>
          <div className="event-card-inline-info">
            <span className="event-card-inline-title">{eventWithEdits.title}</span>
            <span className="event-card-inline-datetime">{formatShortDateTime(eventWithEdits.datetime)}</span>
            {eventWithEdits.category && (
              <span className="event-card-inline-category">{eventWithEdits.category}</span>
            )}
            {eventWithEdits.location && (
              <span className="event-card-inline-location">{eventWithEdits.location}</span>
            )}
          </div>
          {decision && (
            <span className={`event-decision-badge ${decision}`}>
              {decision === 'confirmed' ? '✓ Add' : '✗ Reject'}
            </span>
          )}
        </div>
      );
    }

    // Active state - editable
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
            <label>Title</label>
            <input
              type="text"
              value={eventWithEdits.title}
              onChange={(e) => handleEditEvent(index, 'title', e.target.value)}
              disabled={decision === 'rejected'}
            />
          </div>

          <div className="event-card-row-group datetime-group">
            <div className="event-card-row">
              <label>Date</label>
              <DatePicker
                value={getDateFromDatetime(eventWithEdits.datetime)}
                onChange={(date) => {
                  const time = getTimeFromDatetime(eventWithEdits.datetime) || '15:00';
                  handleEditEvent(index, 'datetime', combineDatetime(date, time));
                }}
              />
            </div>
            <div className="event-card-row">
              <label>Time</label>
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
              <label>Duration</label>
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
                    <option key={h} value={h}>{h} hours</option>
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
                    <option key={m} value={m}>{m} min</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="event-card-row half">
              <label>Category</label>
              {renderCategorySelect(
                'event',
                index,
                eventWithEdits.category,
                (value) => handleEditEvent(index, 'category', value),
                decision === 'rejected'
              )}
            </div>
          </div>

          <div className="event-card-row">
            <label>Location</label>
            <input
              type="text"
              value={eventWithEdits.location || ''}
              onChange={(e) => handleEditEvent(index, 'location', e.target.value)}
              placeholder="Location (optional)"
              disabled={decision === 'rejected'}
            />
          </div>

          {conflicts.length > 0 && (
            <div className="event-conflict-warning-inline">
              ⚠️ Conflicting events: {conflicts.map(c => c.title).join(', ')}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render TODO card
  const renderTodoCard = (todo: PendingTodo, index: number, isActive: boolean) => {
    const todoWithEdits = editingTodos[index] || todo;
    const decision = todoDecisions[index];

    if (!isActive) {
      return (
        <div key={index} className={`todo-card-inline ${decision || ''}`}>
          <div className="todo-card-inline-info">
            <span className="todo-card-inline-title">{todoWithEdits.title}</span>
            <span className="todo-card-inline-duration">{todoWithEdits.duration} min</span>
            {todoWithEdits.category && (
              <span className="todo-card-inline-category">{todoWithEdits.category}</span>
            )}
            {todoWithEdits.priority && (
              <span className={`todo-card-inline-priority ${todoWithEdits.priority}`}>
                {todoWithEdits.priority === 'high' ? 'High' : todoWithEdits.priority === 'medium' ? 'Medium' : 'Low'}
              </span>
            )}
          </div>
          {decision && (
            <span className={`item-decision-badge ${decision}`}>
              {decision === 'confirmed' ? '✓ Add' : '✗ Reject'}
            </span>
          )}
        </div>
      );
    }

    return (
      <div key={index} className={`todo-card-editable ${decision || ''}`}>
        <div className="item-card-header">
          <span className="item-card-number">{index + 1}</span>
          <div className="item-card-quick-actions">
            <button
              className={`quick-action-btn confirm ${decision === 'confirmed' ? 'active' : ''}`}
              onClick={() => handleTodoDecision(index, 'confirmed')}
              disabled={isSaving}
            >
              ✓
            </button>
            <button
              className={`quick-action-btn reject ${decision === 'rejected' ? 'active' : ''}`}
              onClick={() => handleTodoDecision(index, 'rejected')}
              disabled={isSaving}
            >
              ✗
            </button>
          </div>
        </div>

        <div className="item-card-body">
          <div className="item-card-row">
            <label>Title</label>
            <input
              type="text"
              value={todoWithEdits.title}
              onChange={(e) => handleEditTodo(index, 'title', e.target.value)}
              disabled={decision === 'rejected'}
            />
          </div>

          <div className="item-card-row-group">
            <div className="item-card-row">
              <label>Duration</label>
              <div className="duration-inputs">
                <select
                  value={getDurationHours(todoWithEdits.duration)}
                  onChange={(e) => {
                    const hours = parseInt(e.target.value);
                    const minutes = getDurationMinutes(todoWithEdits.duration);
                    handleEditTodo(index, 'duration', combineDuration(hours, minutes));
                  }}
                  disabled={decision === 'rejected'}
                >
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(h => (
                    <option key={h} value={h}>{h} hours</option>
                  ))}
                </select>
                <select
                  value={getDurationMinutes(todoWithEdits.duration)}
                  onChange={(e) => {
                    const minutes = parseInt(e.target.value);
                    const hours = getDurationHours(todoWithEdits.duration);
                    handleEditTodo(index, 'duration', combineDuration(hours, minutes));
                  }}
                  disabled={decision === 'rejected'}
                >
                  {[0, 10, 15, 20, 30, 40, 45, 50].map(m => (
                    <option key={m} value={m}>{m} min</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="item-card-row">
              <label>Priority</label>
              <select
                value={todoWithEdits.priority || 'medium'}
                onChange={(e) => handleEditTodo(index, 'priority', e.target.value)}
                disabled={decision === 'rejected'}
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          <div className="item-card-row">
            <label>Category</label>
            {renderCategorySelect(
              'todo',
              index,
              todoWithEdits.category,
              (value) => handleEditTodo(index, 'category', value),
              decision === 'rejected'
            )}
          </div>

          <div className="item-card-row">
            <label>Description</label>
            <input
              type="text"
              value={todoWithEdits.description || ''}
              onChange={(e) => handleEditTodo(index, 'description', e.target.value)}
              placeholder="Description (optional)"
              disabled={decision === 'rejected'}
            />
          </div>
        </div>
      </div>
    );
  };

  // Render Goal card
  const renderGoalCard = (goal: PendingGoal, index: number, isActive: boolean) => {
    const goalWithEdits = editingGoals[index] || goal;
    const decision = goalDecisions[index];

    if (!isActive) {
      return (
        <div key={index} className={`goal-card-inline ${decision || ''}`}>
          <div className="goal-card-inline-info">
            <span className="goal-card-inline-title">{goalWithEdits.title}</span>
            {goalWithEdits.target_date && (
              <span className="goal-card-inline-date">~{goalWithEdits.target_date}</span>
            )}
            {goalWithEdits.priority && (
              <span className={`goal-card-inline-priority ${goalWithEdits.priority}`}>
                {goalWithEdits.priority === 'high' ? 'High' : goalWithEdits.priority === 'medium' ? 'Medium' : 'Low'}
              </span>
            )}
          </div>
          {decision && (
            <span className={`item-decision-badge ${decision}`}>
              {decision === 'confirmed' ? '✓ Add' : '✗ Reject'}
            </span>
          )}
        </div>
      );
    }

    return (
      <div key={index} className={`goal-card-editable ${decision || ''}`}>
        <div className="item-card-header">
          <span className="item-card-number">{index + 1}</span>
          <div className="item-card-quick-actions">
            <button
              className={`quick-action-btn confirm ${decision === 'confirmed' ? 'active' : ''}`}
              onClick={() => handleGoalDecision(index, 'confirmed')}
              disabled={isSaving}
            >
              ✓
            </button>
            <button
              className={`quick-action-btn reject ${decision === 'rejected' ? 'active' : ''}`}
              onClick={() => handleGoalDecision(index, 'rejected')}
              disabled={isSaving}
            >
              ✗
            </button>
          </div>
        </div>

        <div className="item-card-body">
          <div className="item-card-row">
            <label>Goal</label>
            <input
              type="text"
              value={goalWithEdits.title}
              onChange={(e) => handleEditGoal(index, 'title', e.target.value)}
              disabled={decision === 'rejected'}
            />
          </div>

          <div className="item-card-row-group">
            <div className="item-card-row">
              <label>Target Date</label>
              <DatePicker
                value={goalWithEdits.target_date || ''}
                onChange={(date) => handleEditGoal(index, 'target_date', date)}
              />
            </div>

            <div className="item-card-row">
              <label>Priority</label>
              <select
                value={goalWithEdits.priority || 'medium'}
                onChange={(e) => handleEditGoal(index, 'priority', e.target.value)}
                disabled={decision === 'rejected'}
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          <div className="item-card-row">
            <label>Category</label>
            {renderCategorySelect(
              'goal',
              index,
              goalWithEdits.category,
              (value) => handleEditGoal(index, 'category', value),
              decision === 'rejected'
            )}
          </div>

          <div className="item-card-row">
            <label>Description</label>
            <input
              type="text"
              value={goalWithEdits.description || ''}
              onChange={(e) => handleEditGoal(index, 'description', e.target.value)}
              placeholder="Goal description (optional)"
              disabled={decision === 'rejected'}
            />
          </div>

          {/* Display sub-tasks */}
          {goalWithEdits.decomposed_todos && goalWithEdits.decomposed_todos.length > 0 && (
            <div className="goal-decomposed-todos">
              <label>Sub-tasks ({goalWithEdits.decomposed_todos.length})</label>
              <div className="decomposed-todo-list">
                {goalWithEdits.decomposed_todos.map((todo, idx) => (
                  <div key={idx} className="decomposed-todo-item">
                    <span className="decomposed-todo-order">{idx + 1}</span>
                    <span className="decomposed-todo-title">{todo.title}</span>
                    <span className="decomposed-todo-duration">{todo.duration} min</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Carousel navigation helper
  const CARDS_PER_PAGE = 3;
  const MAX_PAGES = 3; // 3 pages x 3 cards = 9 items max

  // Place cards: 2 per page, 3 pages max = 6 items
  const PLACE_CARDS_PER_PAGE = 2;
  const PLACE_MAX_PAGES = 3;

  const getCarouselIndex = (key: string) => carouselIndices[key] || 0;

  const handleCarouselNav = (key: string, direction: 'prev' | 'next', totalItems: number, cardsPerPage: number = CARDS_PER_PAGE) => {
    const maxPages = Math.ceil(totalItems / cardsPerPage);
    setCarouselIndices(prev => {
      const current = prev[key] || 0;
      if (direction === 'next') {
        return { ...prev, [key]: Math.min(current + 1, maxPages - 1) };
      } else {
        return { ...prev, [key]: Math.max(current - 1, 0) };
      }
    });
  };

  // Render carousel with navigation
  const renderCarousel = (
    key: string,
    items: any[],
    renderCard: (item: any, idx: number, globalIdx: number) => React.ReactNode,
    cardsPerPage: number = CARDS_PER_PAGE,
    maxPages: number = MAX_PAGES
  ) => {
    const currentPage = getCarouselIndex(key);
    const maxItems = cardsPerPage * maxPages;
    const limitedItems = items.slice(0, maxItems);
    const totalPages = Math.ceil(limitedItems.length / cardsPerPage);
    const startIdx = currentPage * cardsPerPage;
    const visibleItems = limitedItems.slice(startIdx, startIdx + cardsPerPage);
    const hasPrev = currentPage > 0;
    const hasNext = currentPage < totalPages - 1;

    return (
      <div className="mcp-carousel-container">
        <button
          className={`mcp-carousel-btn mcp-carousel-prev ${!hasPrev ? 'disabled' : ''}`}
          onClick={() => hasPrev && handleCarouselNav(key, 'prev', limitedItems.length, cardsPerPage)}
          disabled={!hasPrev}
        >
          ‹
        </button>
        <div className={`mcp-carousel-cards ${cardsPerPage === 2 ? 'two-cards' : ''}`}>
          {visibleItems.map((item, idx) => renderCard(item, idx, startIdx + idx))}
        </div>
        <button
          className={`mcp-carousel-btn mcp-carousel-next ${!hasNext ? 'disabled' : ''}`}
          onClick={() => hasNext && handleCarouselNav(key, 'next', limitedItems.length, cardsPerPage)}
          disabled={!hasNext}
        >
          ›
        </button>
        {totalPages > 1 && (
          <div className="mcp-carousel-dots">
            {Array.from({ length: totalPages }).map((_, i) => (
              <span
                key={i}
                className={`mcp-carousel-dot ${i === currentPage ? 'active' : ''}`}
                onClick={() => setCarouselIndices(prev => ({ ...prev, [key]: i }))}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  // Render MCP data ("Acting AI" results)
  const renderMCPData = (mcpData: MCPResponseData) => {
    const hasRestaurants = mcpData.restaurants && mcpData.restaurants.length > 0;
    const hasPlaces = mcpData.places && mcpData.places.length > 0;
    const hasProducts = mcpData.products && mcpData.products.length > 0;
    const hasGifts = mcpData.gifts && mcpData.gifts.length > 0;
    const hasNews = mcpData.news && mcpData.news.length > 0;
    const hasAvailableSlots = mcpData.availableSlots && mcpData.availableSlots.length > 0;

    if (!hasRestaurants && !hasPlaces && !hasProducts && !hasGifts && !hasNews && !hasAvailableSlots) {
      return null;
    }

    const placeItems = mcpData.restaurants || mcpData.places || [];
    const productItems = mcpData.gifts || mcpData.products || [];

    return (
      <div className="mcp-data-container">
        {/* Restaurant/Place recommendations */}
        {(hasRestaurants || hasPlaces) && (
          <div className="mcp-section places-section">
            {renderCarousel('places', placeItems, (place: MCPPlaceResult, idx: number, globalIdx: number) => (
              <div key={place.id || globalIdx} className="mcp-card mcp-place-card">
                {place.photos && place.photos[0] ? (
                  <div className="mcp-card-image">
                    <img src={place.photos[0]} alt={place.name} />
                  </div>
                ) : (
                  <div className="mcp-card-image mcp-card-image-placeholder">
                    <span>🍽️</span>
                  </div>
                )}
                <div className="mcp-card-content">
                  <div className="mcp-card-title">{place.name}</div>
                  {place.category && (
                    <div className="mcp-card-category">{place.category}</div>
                  )}
                  <div className="mcp-card-details">
                    {place.rating && <span className="mcp-rating">⭐ {place.rating}</span>}
                    {place.reviewCount && <span className="mcp-reviews">({place.reviewCount})</span>}
                    {place.priceLevel && <span className="mcp-price-level">{place.priceLevel}</span>}
                  </div>
                  <div className="mcp-card-address">{place.address}</div>
                  {place.openNow !== undefined && (
                    <span className={`mcp-place-status ${place.openNow ? 'open' : 'closed'}`}>
                      {place.openNow ? 'Open' : 'Closed'}
                    </span>
                  )}
                </div>
              </div>
            ), PLACE_CARDS_PER_PAGE, PLACE_MAX_PAGES)}
          </div>
        )}

        {/* Product/Gift recommendations */}
        {(hasProducts || hasGifts) && (
          <div className="mcp-section products-section">
            <h4 className="mcp-section-title">
              {hasGifts ? '🎁 Gift Recommendations' : '🛒 Product Recommendations'}
            </h4>
            {renderCarousel('products', productItems, (product: MCPProductResult, idx: number, globalIdx: number) => {
              const imageUrl = product.imageUrl || product.image;
              const productLink = product.productUrl || product.link;
              const sellerName = product.seller || product.mall;

              return (
                <a
                  key={product.id || globalIdx}
                  href={productLink || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mcp-card mcp-product-card"
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  {imageUrl && (
                    <div className="mcp-card-image">
                      <img src={imageUrl} alt={product.title} />
                      {product.discountRate && product.discountRate > 0 && (
                        <span className="mcp-discount-badge">-{product.discountRate}%</span>
                      )}
                    </div>
                  )}
                  <div className="mcp-card-content">
                    <div className="mcp-card-title" title={product.title}>
                      {product.title.length > 40 ? product.title.substring(0, 40) + '...' : product.title}
                    </div>
                    <div className="mcp-card-price">
                      <span className="mcp-current-price">
                        ${product.price.toLocaleString()}
                      </span>
                      {product.originalPrice && product.originalPrice > product.price && (
                        <span className="mcp-original-price">
                          ${product.originalPrice.toLocaleString()}
                        </span>
                      )}
                    </div>
                    {product.rating && (
                      <div className="mcp-card-rating">
                        ⭐ {product.rating}
                        {product.reviewCount && <span className="mcp-review-count">({product.reviewCount})</span>}
                      </div>
                    )}
                    {sellerName && (
                      <div className="mcp-card-seller">
                        🏪 {sellerName}
                        {product.isFreeShipping && <span className="mcp-free-shipping">Free Shipping</span>}
                      </div>
                    )}
                  </div>
                </a>
              );
            })}
          </div>
        )}

        {/* News */}
        {hasNews && (
          <div className="mcp-section news-section">
            <h4 className="mcp-section-title">📰 News</h4>
            <div className="mcp-cards-slider mcp-news-slider">
              {mcpData.news!.map((article, idx) => (
                <a
                  key={article.id || idx}
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mcp-card mcp-news-card"
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  {article.imageUrl && (
                    <div className="mcp-card-image mcp-news-image">
                      <img src={article.imageUrl} alt={article.title} />
                    </div>
                  )}
                  <div className="mcp-card-content">
                    <div className="mcp-card-title mcp-news-title">
                      {article.title.length > 60 ? article.title.substring(0, 60) + '...' : article.title}
                    </div>
                    {article.description && (
                      <div className="mcp-news-description">
                        {article.description.length > 80 ? article.description.substring(0, 80) + '...' : article.description}
                      </div>
                    )}
                    <div className="mcp-news-meta">
                      <span className="mcp-news-source">{article.source}</span>
                      {article.publishedAt && (
                        <span className="mcp-news-date">
                          {new Date(article.publishedAt).toLocaleDateString('en-US')}
                        </span>
                      )}
                    </div>

                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Group available time slots */}
        {hasAvailableSlots && (
          <div className="mcp-section schedule-section">
            <h4 className="mcp-section-title">📅 Available Times</h4>
            <div className="mcp-slots-list">
              {mcpData.availableSlots!.slice(0, 5).map((slot, idx) => (
                <div
                  key={idx}
                  className={`mcp-slot-card ${slot.allAvailable ? 'all-available' : 'partial'}`}
                >
                  <div className="mcp-slot-date">{slot.date}</div>
                  <div className="mcp-slot-time">{slot.startTime} - {slot.endTime}</div>
                  {slot.allAvailable ? (
                    <span className="mcp-slot-status available">✓ All available</span>
                  ) : (
                    <span className="mcp-slot-status partial">
                      ⚠️ {slot.unavailableMembers?.length || 0} unavailable
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Completed actions display */}
        {mcpData.actions_taken && mcpData.actions_taken.length > 0 && (
          <div className="mcp-section actions-section">
            <h4 className="mcp-section-title">✅ Actions Completed</h4>
            <div className="mcp-actions-list">
              {mcpData.actions_taken.map((action, idx) => (
                <div
                  key={idx}
                  className={`mcp-action-item ${action.success ? 'success' : 'failed'}`}
                >
                  <span className="mcp-action-icon">{action.success ? '✓' : '✗'}</span>
                  <span className="mcp-action-name">{action.action}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render completed results message
  const renderCompletedResults = () => {
    if (!completedResults) return null;

    const { type, confirmedCount, rejectedCount, items } = completedResults;
    const typeLabels = { event: 'event', todo: 'todo', goal: 'goal' };
    const typeLabel = typeLabels[type];

    return (
      <div className="chat-message assistant">
        <div className="message-bubble result-message">
          {confirmedCount > 0 ? (
            <>
              <div className="result-title">{confirmedCount} {typeLabel}{confirmedCount > 1 ? 's' : ''} added!</div>
              {type === 'event' && items && (
                <div className="result-list">
                  {items.map((event: PendingEvent, idx: number) => (
                    <div key={idx} className="result-item">
                      <span className="result-item-title">{event.title}</span>
                      <span className="result-item-datetime">{formatShortDateTime(event.datetime)}</span>
                      {event.category && <span className="result-item-category">{event.category}</span>}
                      {event.location && <span className="result-item-location">{event.location}</span>}
                    </div>
                  ))}
                </div>
              )}
              {type === 'todo' && items && (
                <div className="result-list">
                  {items.map((todo: PendingTodo, idx: number) => (
                    <div key={idx} className="result-item">
                      <span className="result-item-title">{todo.title}</span>
                      <span className="result-item-duration">{todo.duration} min</span>
                    </div>
                  ))}
                </div>
              )}
              {type === 'goal' && items && (
                <div className="result-list">
                  {items.map((goal: PendingGoal, idx: number) => (
                    <div key={idx} className="result-item">
                      <span className="result-item-title">{goal.title}</span>
                      {goal.target_date && <span className="result-item-date">~{goal.target_date}</span>}
                      {goal.decomposed_todos && goal.decomposed_todos.length > 0 && (
                        <span className="result-item-todos">{goal.decomposed_todos.length} tasks</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="result-title">No {typeLabel}s added.</div>
          )}
          {rejectedCount > 0 && (
            <div className="result-rejected">{rejectedCount} {typeLabel}{rejectedCount > 1 ? 's' : ''} rejected.</div>
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
          <h3>Conversations</h3>
          <button className="new-chat-btn" onClick={handleNewConversation}>
            + New Chat
          </button>
        </div>
        <div className="conversation-list">
          {conversations.map(conv => (
            <div
              key={conv.id}
              className={`conversation-item ${currentConversationId === conv.id ? 'active' : ''}`}
              onClick={() => loadConversation(conv.id)}
            >
              <div className="conversation-title">{conv.title || 'New Conversation'}</div>
              <div className="conversation-date">
                {new Date(conv.updated_at).toLocaleDateString('en-US')}
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
            <div className="no-conversations">No conversations yet</div>
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
              <p>Tell me what you'd like to add or manage.</p>
              <div className="chat-welcome-examples">
                <div className="chat-welcome-example">"Plan my workout for this week"</div>
                <div className="chat-welcome-example">"Team meeting tomorrow at 3 PM"</div>
                <div className="chat-welcome-example">"Suggest study schedule for next week"</div>
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

                {/* MCP data display ("Acting AI" results) */}
                {msg.mcp_data && renderMCPData(msg.mcp_data)}

                {/* Event confirmation UI - displayed right below message */}
                {msg.pending_events && msg.pending_events.length > 0 && msg.id === activeMessageId && activeItemType === 'event' && (
                  <div className="item-confirmation-inline">
                    <div className="item-cards-container">
                      {msg.pending_events.map((event, index) =>
                        renderEventCard(event, index, true)
                      )}
                    </div>

                    {allEventsProcessed(msg.pending_events) && (
                      <div className="item-final-actions">
                        <button
                          className="btn-final-confirm"
                          onClick={() => handleFinalConfirmEvents(msg.pending_events!)}
                          disabled={isSaving}
                        >
                          {isSaving ? 'Saving...' : 'Confirm'}
                        </button>
                      </div>
                    )}

                    {!allEventsProcessed(msg.pending_events) && (
                      <div className="item-pending-hint">
                        Please select ✓(Add) or ✗(Reject) for each event
                      </div>
                    )}
                  </div>
                )}

                {/* TODO confirmation UI */}
                {msg.pending_todos && msg.pending_todos.length > 0 && msg.id === activeMessageId && activeItemType === 'todo' && (
                  <div className="item-confirmation-inline">
                    <div className="item-cards-container">
                      {msg.pending_todos.map((todo, index) =>
                        renderTodoCard(todo, index, true)
                      )}
                    </div>

                    {allTodosProcessed(msg.pending_todos) && (
                      <div className="item-final-actions">
                        <button
                          className="btn-final-confirm"
                          onClick={() => handleFinalConfirmTodos(msg.pending_todos!)}
                          disabled={isSaving}
                        >
                          {isSaving ? 'Saving...' : 'Confirm'}
                        </button>
                      </div>
                    )}

                    {!allTodosProcessed(msg.pending_todos) && (
                      <div className="item-pending-hint">
                        Please select ✓(Add) or ✗(Reject) for each todo
                      </div>
                    )}
                  </div>
                )}

                {/* Goal confirmation UI */}
                {msg.pending_goals && msg.pending_goals.length > 0 && msg.id === activeMessageId && activeItemType === 'goal' && (
                  <div className="item-confirmation-inline">
                    <div className="item-cards-container">
                      {msg.pending_goals.map((goal, index) =>
                        renderGoalCard(goal, index, true)
                      )}
                    </div>

                    {allGoalsProcessed(msg.pending_goals) && (
                      <div className="item-final-actions">
                        <button
                          className="btn-final-confirm"
                          onClick={() => handleFinalConfirmGoals(msg.pending_goals!)}
                          disabled={isSaving}
                        >
                          {isSaving ? 'Saving...' : 'Confirm'}
                        </button>
                      </div>
                    )}

                    {!allGoalsProcessed(msg.pending_goals) && (
                      <div className="item-pending-hint">
                        Please select ✓(Add) or ✗(Reject) for each goal
                      </div>
                    )}
                  </div>
                )}

                {/* Result message - displayed below corresponding message */}
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
              [Goal] {selectedGoal.title}
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
              title="Select Goal"
            >
              +
            </button>
            <input
              type="text"
              className="chat-input"
              placeholder="Ask me anything... (events, todos, goals, briefing)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
            />
            <button
              className="chat-mic-btn"
              onClick={() => showToast('Voice input coming soon!', 'info')}
              title="Voice input (coming soon)"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </button>
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
                <h3 className="modal-title">Select Goal</h3>
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
                  <span>General Chat</span>
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
