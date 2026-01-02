import { Router, Response } from 'express';
import { createAgentLoop } from '../agents/index.js';
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
  createMessage
} from '../services/database.js';
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

// DBEvent를 LegacyEvent로 변환하는 헬퍼 함수
function dbEventToEvent(dbEvent: DBEvent): LegacyEvent {
  return dbEventToLegacy(dbEvent);
}

// LegacyEvent를 DBEvent로 변환
function eventToDbEvent(event: Partial<LegacyEvent>): Partial<DBEvent> {
  return legacyToDbEvent(event);
}

const router = Router();

/**
 * POST /api/chat
 * AI 비서와 대화
 */
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { message, conversation_id, mode = 'auto' } = req.body;
    const userId = req.userId!;

    if (!message) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    // 대화 세션 가져오기 또는 생성
    let conversation: Conversation;
    if (conversation_id) {
      const existing = await getConversationById(conversation_id);
      if (!existing) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }
      conversation = existing;
    } else {
      // 새 대화 생성 (첫 메시지 기반 제목)
      const title = message.length > 30 ? message.substring(0, 30) + '...' : message;
      conversation = await createConversation(userId, title);
    }

    // 사용자 메시지 저장
    await createMessage({
      conversation_id: conversation.id,
      role: 'user',
      content: message
    });

    // 사용자 데이터 로드
    const [dbEvents, todos, goals, categories] = await Promise.all([
      getEventsByUser(userId),
      getTodosByUser(userId),
      getGoalsByUser(userId),
      getCategoriesByUser(userId)
    ]);

    // DBEvent를 LegacyEvent로 변환
    const events: LegacyEvent[] = dbEvents.map(dbEventToEvent);

    // 이전 대화 기록 로드 (최근 20개)
    const dbMessages = await getMessagesByConversation(conversation.id);
    const history: ChatMessage[] = dbMessages.slice(-20).map(m => ({
      role: m.role,
      content: m.content
    }));

    // Orchestrator 컨텍스트 생성
    const context: OrchestratorContext = {
      user_id: userId,
      events,
      todos: todos as Todo[],
      goals,
      categories,
      conversation_history: history
    };

    // Agent Loop로 메시지 처리 (Function Calling 사용)
    const agent = createAgentLoop(context);
    const response = await agent.processMessage(message, mode);

    // 응답에서 pending 항목들 추출
    const pendingEvents = response.events_to_create || [];
    const pendingTodos = response.todos_to_create || [];
    const pendingGoals = response.goals_to_create || [];

    // AI 응답 메시지 저장 (pending 항목들 포함)
    const pendingData: any = {};
    if (pendingEvents.length > 0) pendingData.pending_events = pendingEvents;
    if (pendingTodos.length > 0) pendingData.pending_todos = pendingTodos;
    if (pendingGoals.length > 0) pendingData.pending_goals = pendingGoals;

    const assistantMessage = await createMessage({
      conversation_id: conversation.id,
      role: 'assistant',
      content: response.message,
      pending_events: Object.keys(pendingData).length > 0 ? pendingData : null
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
      suggestions: response.suggestions
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

/**
 * 카테고리 이름으로 가장 적합한 카테고리 ID 찾기
 */
function findCategoryId(categories: { id: string; name: string }[], categoryName?: string): string | undefined {
  if (!categoryName || !categories.length) {
    // 기본 카테고리 반환
    const defaultCat = categories.find(c => c.name === '기본');
    return defaultCat?.id;
  }

  // 정확히 매칭
  const exactMatch = categories.find(c => c.name === categoryName);
  if (exactMatch) return exactMatch.id;

  // 부분 매칭 (카테고리 이름이 검색어를 포함하거나 검색어가 카테고리 이름을 포함)
  const partialMatch = categories.find(c =>
    c.name.includes(categoryName) || categoryName.includes(c.name)
  );
  if (partialMatch) return partialMatch.id;

  // 키워드 기반 매칭
  const categoryKeywords: { [key: string]: string[] } = {
    '운동': ['운동', '건강', '헬스', '조깅', '요가', '체육'],
    '업무': ['업무', '회의', '미팅', '출근', '프로젝트', '발표', '일'],
    '공부': ['공부', '학습', '수업', '강의', '시험', '자격증', '독서'],
    '약속': ['약속', '친구', '데이트', '모임', '파티', '만남'],
    '개인': ['개인', '취미', '휴식', '영화', '쇼핑', '여행']
  };

  for (const category of categories) {
    const keywords = categoryKeywords[category.name];
    if (keywords && keywords.some(keyword => categoryName.includes(keyword))) {
      return category.id;
    }
  }

  // 기본 카테고리 반환
  const defaultCat = categories.find(c => c.name === '기본');
  return defaultCat?.id;
}

/**
 * POST /api/chat/save-result
 * 일정 확정 결과 메시지를 대화 기록에 저장
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
 * POST /api/chat/confirm-events
 * 확인된 일정들을 저장
 */
router.post('/confirm-events', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { events } = req.body;
    const userId = req.userId!;

    if (!events || !Array.isArray(events)) {
      res.status(400).json({ error: 'Events array is required' });
      return;
    }

    // 사용자의 카테고리 목록 가져오기
    const categories = await getCategoriesByUser(userId);

    const createdEvents: LegacyEvent[] = [];

    for (const event of events) {
      // AI가 추천한 카테고리 이름으로 category_id 찾기
      const categoryId = findCategoryId(categories, event.category);

      const dbEvent = eventToDbEvent({
        ...event,
        user_id: userId,
        category_id: categoryId
      } as Partial<LegacyEvent>);
      const created = await createEvent(dbEvent);
      createdEvents.push(dbEventToEvent(created));
    }

    res.json({
      message: `${createdEvents.length}개의 일정이 저장되었습니다.`,
      events: createdEvents
    });
  } catch (error) {
    console.error('Confirm events error:', error);
    res.status(500).json({ error: 'Failed to save events' });
  }
});

/**
 * POST /api/chat/confirm-todos
 * 확인된 TODO들을 저장
 */
router.post('/confirm-todos', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { todos } = req.body;
    const userId = req.userId!;

    if (!todos || !Array.isArray(todos)) {
      res.status(400).json({ error: 'Todos array is required' });
      return;
    }

    // 사용자의 카테고리 목록 가져오기
    const categories = await getCategoriesByUser(userId);

    const createdTodos: Todo[] = [];

    for (const todo of todos) {
      // 카테고리 이름으로 category_id 찾기
      // const categoryId = findCategoryId(categories, todo.category);

      const todoData: Partial<Todo> = {
        user_id: userId,
        // category_id: categoryId,  // Todo 타입에는 category_id가 없음
        title: todo.title,
        description: todo.description || undefined,
        priority: todo.priority || 'medium',
        estimated_time: todo.duration || todo.estimated_time || 60,
        completed_time: 0,
        is_completed: false,
        is_hard_deadline: false,
        is_divisible: true
      };

      // deadline 설정
      if (todo.deadline) {
        todoData.deadline = todo.deadline;
      }

      const created = await createTodo(todoData);
      createdTodos.push(created);
    }

    res.json({
      message: `${createdTodos.length}개의 할 일이 저장되었습니다.`,
      todos: createdTodos
    });
  } catch (error) {
    console.error('Confirm todos error:', error);
    res.status(500).json({ error: 'Failed to save todos' });
  }
});

/**
 * POST /api/chat/confirm-goals
 * 확인된 Goal들을 저장
 */
router.post('/confirm-goals', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { goals } = req.body;
    const userId = req.userId!;

    if (!goals || !Array.isArray(goals)) {
      res.status(400).json({ error: 'Goals array is required' });
      return;
    }

    // 카테고리 목록 가져오기
    const categories = await getCategoriesByUser(userId);

    const createdGoals: Goal[] = [];

    for (const goal of goals) {
      // 카테고리 이름으로 ID 찾기
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

      // Goal에 연결된 TODO들도 생성
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
      message: `${createdGoals.length}개의 목표가 저장되었습니다.`,
      goals: createdGoals
    });
  } catch (error) {
    console.error('Confirm goals error:', error);
    res.status(500).json({ error: 'Failed to save goals' });
  }
});

/**
 * GET /api/chat/conversations
 * 대화 목록 조회
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
 * 특정 대화 조회 (메시지 포함)
 */
router.get('/conversations/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const conversation = await getConversationById(id);

    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    const messages = await getMessagesByConversation(id);

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
 * 새 대화 생성
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
 * 대화 제목 수정
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
 * 대화 삭제
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
