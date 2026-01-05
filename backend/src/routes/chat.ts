import { Router, Response } from 'express';
import OpenAI from 'openai';
import { createAgentLoop, createMCPAgentLoop, getMCPOrchestrator } from '../agents/index.js';
import {
  getEventsByUser,
  getTodosByUser,
  getGoalsByUser,
  getCategoriesByUser,
  createEvent,
  createTodo,
  createGoal,
  getConversationsByUser,
  getConversationById,
  createConversation,
  updateConversation,
  deleteConversation,
  getMessagesByConversation,
  createMessage,
  getExternalServiceConfig
} from '../services/database.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});
import { AuthRequest, authenticate } from '../middleware/auth.js';
import {
  ChatMessage,
  OrchestratorContext,
  LegacyEvent,
  Todo,
  Goal,
  DBEvent,
  Conversation,
  dbEventToLegacy,
  legacyToDbEvent
} from '../types/index.js';

// Helper function to convert DBEvent to LegacyEvent
function dbEventToEvent(dbEvent: DBEvent): LegacyEvent {
  return dbEventToLegacy(dbEvent);
}

// Convert LegacyEvent to DBEvent
function eventToDbEvent(event: Partial<LegacyEvent>): Partial<DBEvent> {
  return legacyToDbEvent(event);
}

const router = Router();

/**
 * POST /api/chat
 * Chat with AI assistant
 */
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { message, conversation_id, mode = 'auto' } = req.body;
    const userId = req.userId!;

    if (!message) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    // Get or create conversation session
    let conversation: Conversation;
    if (conversation_id) {
      const existing = await getConversationById(conversation_id);
      if (!existing) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }
      conversation = existing;
    } else {
      // Create new conversation (title based on first message)
      const title = message.length > 30 ? message.substring(0, 30) + '...' : message;
      conversation = await createConversation(userId, title);
    }

    // Save user message
    await createMessage({
      conversation_id: conversation.id,
      role: 'user',
      content: message
    });

    // Load user data and calendar tokens
    const [dbEvents, todos, goals, categories, calendarService] = await Promise.all([
      getEventsByUser(userId),
      getTodosByUser(userId),
      getGoalsByUser(userId),
      getCategoriesByUser(userId),
      getExternalServiceConfig(userId, 'google_calendar').catch(() => null)
    ]);

    // Convert DBEvent to LegacyEvent
    const events: LegacyEvent[] = dbEvents.map(dbEventToEvent);

    // Load previous conversation history (last 20 messages)
    const dbMessages = await getMessagesByConversation(conversation.id);
    const history: ChatMessage[] = dbMessages.slice(-20).map(m => ({
      role: m.role,
      content: m.content
    }));

    // Create Orchestrator context
    const context: OrchestratorContext = {
      user_id: userId,
      events,
      todos: todos as Todo[],
      goals,
      categories,
      conversation_history: history
    };

    // Agent selection: MCP mode or basic mode
    // mode: 'auto' | 'mcp' | 'basic'
    // - 'mcp': Use MCP integrated agent (supports location recommendations, group schedules, shopping, etc.)
    // - 'basic': Use legacy agent
    // - 'auto': Use MCP agent by default (supports more features)
    const useMCP = mode !== 'basic';

    let response;
    if (useMCP) {
      // MCP integrated agent ("Talking AI" → "Acting AI")
      console.log('[Chat API] Using MCP Agent Loop');

      // Prepare MCP config with calendar tokens if available
      const mcpConfig: { googleCalendarTokens?: { access_token: string; refresh_token?: string } } = {};
      if (calendarService?.is_enabled && calendarService?.config) {
        mcpConfig.googleCalendarTokens = {
          access_token: calendarService.config.access_token,
          refresh_token: calendarService.config.refresh_token
        };
        console.log('[Chat API] Google Calendar tokens loaded for user');
      }

      const mcpAgent = createMCPAgentLoop(context, undefined, mcpConfig);
      response = await mcpAgent.processMessage(message, mode);
    } else {
      // Legacy agent
      console.log('[Chat API] Using Basic Agent Loop');
      const agent = createAgentLoop(context);
      response = await agent.processMessage(message, mode);
    }

    console.log('[Chat API] Agent response:', JSON.stringify(response, null, 2));

    // Extract pending items from response
    const pendingEvents = response.events_to_create || [];
    const pendingTodos = response.todos_to_create || [];
    const pendingGoals = response.goals_to_create || [];

    console.log('[Chat API] Pending goals count:', pendingGoals.length);
    if (pendingGoals.length > 0) {
      console.log('[Chat API] Pending goals:', JSON.stringify(pendingGoals, null, 2));
    }

    // Save AI response message (including pending items and MCP data)
    const pendingData: any = {};
    if (pendingEvents.length > 0) pendingData.pending_events = pendingEvents;
    if (pendingTodos.length > 0) pendingData.pending_todos = pendingTodos;
    if (pendingGoals.length > 0) pendingData.pending_goals = pendingGoals;

    const mcpData = (response as any).mcp_data;

    const assistantMessage = await createMessage({
      conversation_id: conversation.id,
      role: 'assistant',
      content: response.message,
      pending_events: Object.keys(pendingData).length > 0 ? pendingData : null,
      mcp_data: mcpData || null
    });

    res.json({
      conversation_id: conversation.id,
      message_id: assistantMessage.id,
      message: response.message,
      pending_events: pendingEvents,
      pending_todos: pendingTodos,
      pending_goals: pendingGoals,
      scheduled_items: response.todos_to_schedule,
      needs_user_input: response.needs_user_input,
      suggestions: response.suggestions,
      // MCP data (location recommendations, product search results, etc.)
      mcp_data: (response as any).mcp_data
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

/**
 * Find the most appropriate category ID by category name
 */
function findCategoryId(categories: { id: string; name: string }[], categoryName?: string): string | undefined {
  if (!categoryName || !categories.length) {
    // Return default category
    const defaultCat = categories.find(c => c.name === 'Default' || c.name === '기본');
    return defaultCat?.id;
  }

  // Exact match
  const exactMatch = categories.find(c => c.name === categoryName);
  if (exactMatch) return exactMatch.id;

  // Partial match (category name contains search term or search term contains category name)
  const partialMatch = categories.find(c =>
    c.name.includes(categoryName) || categoryName.includes(c.name)
  );
  if (partialMatch) return partialMatch.id;

  // Keyword-based matching
  const categoryKeywords: { [key: string]: string[] } = {
    'Exercise': ['exercise', 'health', 'fitness', 'gym', 'workout', 'yoga', 'sports', '운동', '건강', '헬스', '조깅', '요가', '체육'],
    'Work': ['work', 'meeting', 'office', 'project', 'presentation', 'business', '업무', '회의', '미팅', '출근', '프로젝트', '발표', '일'],
    'Study': ['study', 'learning', 'class', 'lecture', 'exam', 'certification', 'reading', '공부', '학습', '수업', '강의', '시험', '자격증', '독서'],
    'Social': ['appointment', 'friend', 'date', 'gathering', 'party', 'meeting', '약속', '친구', '데이트', '모임', '파티', '만남'],
    'Personal': ['personal', 'hobby', 'rest', 'movie', 'shopping', 'travel', '개인', '취미', '휴식', '영화', '쇼핑', '여행']
  };

  for (const category of categories) {
    const keywords = categoryKeywords[category.name];
    if (keywords && keywords.some(keyword => categoryName.includes(keyword))) {
      return category.id;
    }
  }

  // Return default category
  const defaultCat = categories.find(c => c.name === 'Default' || c.name === '기본');
  return defaultCat?.id;
}

/**
 * POST /api/chat/save-result
 * Save schedule confirmation result message to conversation history
 */
router.post('/save-result', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { conversation_id, content } = req.body;

    if (!conversation_id || !content) {
      res.status(400).json({ error: 'conversation_id and content are required' });
      return;
    }

    const message = await createMessage({
      conversation_id,
      role: 'assistant',
      content
    });

    res.json({ message_id: message.id });
  } catch (error) {
    console.error('Save result error:', error);
    res.status(500).json({ error: 'Failed to save result message' });
  }
});

/**
 * Generate contextual follow-up suggestions based on confirmed events
 */
async function generateFollowUpSuggestions(
  events: any[],
  userId: string
): Promise<{ message: string; mcp_data?: any } | null> {
  if (events.length === 0) return null;

  // Analyze event context for potential recommendations
  const eventInfo = events[0]; // Use first event for context
  const eventTime = eventInfo.start_time || eventInfo.datetime?.split('T')[1]?.slice(0, 5);
  const eventDate = eventInfo.datetime?.split('T')[0] || eventInfo.event_date;
  const eventTitle = eventInfo.title?.toLowerCase() || '';
  const eventLocation = eventInfo.location || '';
  const eventCategory = eventInfo.category?.toLowerCase() || '';

  // Determine event type and time of day
  const hour = eventTime ? parseInt(eventTime.split(':')[0]) : 12;
  const isMealTime = (hour >= 11 && hour <= 14) || (hour >= 17 && hour <= 21);
  const isEvening = hour >= 17;
  const isSocialEvent = ['약속', 'appointment', 'dinner', 'lunch', 'meeting', '미팅', '모임', '저녁', '점심', 'date', '데이트']
    .some(keyword => eventTitle.includes(keyword) || eventCategory.includes(keyword));

  // If no location and it's a social/meal event, suggest place recommendations
  if (isSocialEvent && !eventLocation) {
    try {
      // Use AI to generate contextual suggestions
      const suggestionPrompt = `An event was just confirmed:
- Title: ${eventInfo.title}
- Date: ${eventDate}
- Time: ${eventTime || 'not specified'}
- Category: ${eventInfo.category || 'General'}

Based on this event, generate a brief, helpful follow-up suggestion. Consider:
1. If it's a meal-related appointment without a location, suggest finding a restaurant
2. If it's an evening social event, suggest activities after
3. If it's a meeting, suggest preparation tips

Respond in a friendly, concise manner (1-2 sentences). Language should match the event title (Korean if Korean, English if English).
If you have a location-based suggestion, include the area/neighborhood if mentioned in the title.

Format: Just the suggestion message, no JSON.`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: suggestionPrompt }],
        temperature: 0.7,
        max_tokens: 150
      });

      const suggestion = response.choices[0]?.message?.content;

      if (suggestion) {
        // If it seems like a place recommendation is needed, try to get places
        const needsPlaceRecommendation = suggestion.includes('restaurant') || suggestion.includes('맛집') ||
          suggestion.includes('장소') || suggestion.includes('place') || suggestion.includes('카페') ||
          isMealTime;

        if (needsPlaceRecommendation) {
          // Extract area from event title if possible
          const areaMatch = eventTitle.match(/(강남|홍대|이태원|신촌|명동|종로|압구정|청담|한남|성수|연남|망원|합정|건대|잠실|여의도|판교)/);
          const area = areaMatch ? areaMatch[1] : '강남'; // Default to 강남 if no area found

          try {
            const mcpOrchestrator = getMCPOrchestrator(userId);
            const placeResult = await mcpOrchestrator.executeTool({
              name: 'maps_recommend_restaurants',
              arguments: {
                area: area,
                cuisine: isEvening ? undefined : undefined,
                minRating: 4.0,
                limit: 6
              }
            });

            if (placeResult.success && placeResult.data?.restaurants?.length > 0) {
              return {
                message: `✅ Event saved!\n\n💡 ${suggestion}\n\n🍽️ Here are some recommendations near ${area}:`,
                mcp_data: { restaurants: placeResult.data.restaurants }
              };
            }
          } catch (mcpError) {
            console.log('[confirm-events] MCP place recommendation failed:', mcpError);
          }
        }

        return {
          message: `✅ Event saved!\n\n💡 ${suggestion}`
        };
      }
    } catch (error) {
      console.log('[confirm-events] Follow-up suggestion generation failed:', error);
    }
  }

  // If location exists or not a social event, check for post-event suggestions
  if (isEvening && isSocialEvent) {
    try {
      const afterEventPrompt = `An evening social event was confirmed:
- Title: ${eventInfo.title}
- Date: ${eventDate}
- Time: ${eventTime}
- Location: ${eventLocation || 'Not specified'}

Suggest a brief follow-up activity (dessert, cafe, entertainment) in 1 sentence.
Match the language of the event title (Korean if Korean, English if English).`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: afterEventPrompt }],
        temperature: 0.7,
        max_tokens: 100
      });

      const suggestion = response.choices[0]?.message?.content;
      if (suggestion) {
        return {
          message: `✅ Event saved!\n\n💡 ${suggestion}`
        };
      }
    } catch (error) {
      console.log('[confirm-events] After-event suggestion failed:', error);
    }
  }

  return null;
}

/**
 * POST /api/chat/confirm-events
 * Save confirmed events
 */
router.post('/confirm-events', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { events } = req.body;
    const userId = req.userId!;

    console.log('[confirm-events] Received events:', JSON.stringify(events, null, 2));

    if (!events || !Array.isArray(events)) {
      res.status(400).json({ error: 'Events array is required' });
      return;
    }

    // Get user's category list
    const categories = await getCategoriesByUser(userId);
    console.log('[confirm-events] User categories:', categories.map(c => ({ id: c.id, name: c.name })));

    const createdEvents: LegacyEvent[] = [];

    for (const event of events) {
      console.log('[confirm-events] Processing event:', { title: event.title, category: event.category });
      // Find category_id by AI-recommended category name
      const categoryId = findCategoryId(categories, event.category);
      console.log('[confirm-events] Found categoryId:', categoryId, 'for category name:', event.category);

      const dbEvent = eventToDbEvent({
        ...event,
        user_id: userId,
        category_id: categoryId
      } as Partial<LegacyEvent>);
      console.log('[confirm-events] dbEvent to create:', dbEvent);
      const created = await createEvent(dbEvent);
      createdEvents.push(dbEventToEvent(created));
    }

    // Generate contextual follow-up suggestions
    const followUp = await generateFollowUpSuggestions(events, userId);

    res.json({
      message: followUp?.message || `${createdEvents.length} event(s) saved successfully.`,
      events: createdEvents,
      // Include MCP data if place recommendations were generated
      mcp_data: followUp?.mcp_data || null,
      has_follow_up: !!followUp
    });
  } catch (error) {
    console.error('Confirm events error:', error);
    res.status(500).json({ error: 'Failed to save events' });
  }
});

/**
 * POST /api/chat/confirm-todos
 * Save confirmed TODOs
 */
router.post('/confirm-todos', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { todos } = req.body;
    const userId = req.userId!;

    if (!todos || !Array.isArray(todos)) {
      res.status(400).json({ error: 'Todos array is required' });
      return;
    }

    // Get user's category list
    const categories = await getCategoriesByUser(userId);

    const createdTodos: Todo[] = [];

    for (const todo of todos) {
      // Find category_id by category name
      // const categoryId = findCategoryId(categories, todo.category);

      const todoData: Partial<Todo> = {
        user_id: userId,
        // category_id: categoryId,  // Todo type doesn't have category_id
        title: todo.title,
        description: todo.description || undefined,
        priority: todo.priority || 'medium',
        estimated_time: todo.duration || todo.estimated_time || 60,
        completed_time: 0,
        is_completed: false,
        is_hard_deadline: false,
        is_divisible: true
      };

      // Set deadline
      if (todo.deadline) {
        todoData.deadline = todo.deadline;
      }

      const created = await createTodo(todoData);
      createdTodos.push(created);
    }

    res.json({
      message: `${createdTodos.length} todo(s) saved successfully.`,
      todos: createdTodos
    });
  } catch (error) {
    console.error('Confirm todos error:', error);
    res.status(500).json({ error: 'Failed to save todos' });
  }
});

/**
 * POST /api/chat/confirm-goals
 * Save confirmed Goals
 */
router.post('/confirm-goals', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { goals } = req.body;
    const userId = req.userId!;

    if (!goals || !Array.isArray(goals)) {
      res.status(400).json({ error: 'Goals array is required' });
      return;
    }

    // Get category list
    const categories = await getCategoriesByUser(userId);

    const createdGoals: Goal[] = [];

    for (const goal of goals) {
      // Find ID by category name
      const categoryId = findCategoryId(categories, goal.category);

      const goalData: Partial<Goal> = {
        user_id: userId,
        category_id: categoryId,
        title: goal.title,
        description: goal.description || undefined,
        target_date: goal.target_date || new Date().toISOString().split('T')[0],
        priority: goal.priority || 'medium',
        status: 'planning',
        total_estimated_time: 0,
        completed_time: 0
      };

      const created = await createGoal(goalData);
      createdGoals.push(created);

      // Also create TODOs linked to Goal
      if (goal.decomposed_todos && goal.decomposed_todos.length > 0) {
        for (const todo of goal.decomposed_todos) {
          const todoData: Partial<Todo> = {
            user_id: userId,
            goal_id: created.id,
            title: todo.title,
            description: todo.description || undefined,
            priority: todo.priority || 'medium',
            estimated_time: todo.duration || 60,
            completed_time: 0,
            is_completed: false,
            is_hard_deadline: false,
            is_divisible: true
          };
          await createTodo(todoData);
        }
      }
    }

    res.json({
      message: `${createdGoals.length} goal(s) saved successfully.`,
      goals: createdGoals
    });
  } catch (error) {
    console.error('Confirm goals error:', error);
    res.status(500).json({ error: 'Failed to save goals' });
  }
});

/**
 * GET /api/chat/conversations
 * Get conversation list
 */
router.get('/conversations', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const conversations = await getConversationsByUser(userId);

    res.json({ conversations });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: 'Failed to get conversations' });
  }
});

/**
 * GET /api/chat/conversations/:id
 * Get specific conversation (including messages)
 */
router.get('/conversations/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const conversation = await getConversationById(id);

    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    const rawMessages = await getMessagesByConversation(id);

    // Extract mcp_data from pending_events and add it as a separate field
    const messages = rawMessages.map((msg: any) => {
      const mcpData = msg.pending_events?.mcp_data;
      return {
        ...msg,
        mcp_data: mcpData || null
      };
    });

    res.json({
      conversation,
      messages
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({ error: 'Failed to get conversation' });
  }
});

/**
 * POST /api/chat/conversations
 * Create new conversation
 */
router.post('/conversations', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { title } = req.body;

    const conversation = await createConversation(userId, title);

    res.json({ conversation });
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

/**
 * PUT /api/chat/conversations/:id
 * Update conversation title
 */
router.put('/conversations/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { title } = req.body;

    const conversation = await updateConversation(id, { title });

    res.json({ conversation });
  } catch (error) {
    console.error('Update conversation error:', error);
    res.status(500).json({ error: 'Failed to update conversation' });
  }
});

/**
 * DELETE /api/chat/conversations/:id
 * Delete conversation
 */
router.delete('/conversations/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await deleteConversation(id);

    res.json({ message: 'Conversation deleted' });
  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

export default router;
