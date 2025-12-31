import { Router, Response } from 'express';
import { createOrchestrator } from '../agents/index.js';
import {
  getEventsByUser,
  getTodosByUser,
  getGoalsByUser,
  getCategoriesByUser,
  createEvent,
  createTodo
} from '../services/database.js';
import { AuthRequest, authenticate } from '../middleware/auth.js';
import { ChatMessage, OrchestratorContext, Event, Todo } from '../types/index.js';

const router = Router();

// 세션별 대화 기록 저장 (실제 환경에서는 Redis 사용 권장)
const conversationHistory: Map<string, ChatMessage[]> = new Map();

/**
 * POST /api/chat
 * AI 비서와 대화
 */
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { message, auto_save = true } = req.body;
    const userId = req.userId!;

    if (!message) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    // 사용자 데이터 로드
    const [events, todos, goals, categories] = await Promise.all([
      getEventsByUser(userId),
      getTodosByUser(userId),
      getGoalsByUser(userId),
      getCategoriesByUser(userId)
    ]);

    // 대화 기록 가져오기
    const history = conversationHistory.get(userId) || [];

    // Orchestrator 컨텍스트 생성
    const context: OrchestratorContext = {
      user_id: userId,
      events: events as Event[],
      todos: todos as Todo[],
      goals,
      categories,
      conversation_history: history
    };

    // Orchestrator로 메시지 처리
    const orchestrator = createOrchestrator(context);
    const response = await orchestrator.processMessage(message);

    // 대화 기록 업데이트
    history.push(
      { role: 'user', content: message },
      { role: 'assistant', content: response.message }
    );
    // 최근 20개만 유지
    if (history.length > 40) {
      history.splice(0, history.length - 40);
    }
    conversationHistory.set(userId, history);

    // 자동 저장이 활성화되어 있고, 생성할 항목이 있으면 저장
    if (auto_save) {
      if (response.events_to_create && response.events_to_create.length > 0) {
        for (const event of response.events_to_create) {
          await createEvent(event as any);
        }
      }

      if (response.todos_to_create && response.todos_to_create.length > 0) {
        for (const todo of response.todos_to_create) {
          await createTodo(todo as any);
        }
      }
    }

    res.json({
      message: response.message,
      events: response.events_to_create,
      todos: response.todos_to_create,
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
 * GET /api/chat/history
 * 대화 기록 조회
 */
router.get('/history', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const history = conversationHistory.get(userId) || [];

    res.json({ history });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ error: 'Failed to get chat history' });
  }
});

/**
 * DELETE /api/chat/history
 * 대화 기록 초기화
 */
router.delete('/history', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    conversationHistory.delete(userId);

    res.json({ message: 'Chat history cleared' });
  } catch (error) {
    console.error('Clear history error:', error);
    res.status(500).json({ error: 'Failed to clear chat history' });
  }
});

export default router;
