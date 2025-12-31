import { Router, Response } from 'express';
import {
  getEventsByUser,
  getTodosByUser,
  updateTodo
} from '../services/database.js';
import { scheduleTodos, calculateAvailableSlots } from '../agents/index.js';
import { AuthRequest, authenticate } from '../middleware/auth.js';
import { Event, Todo } from '../types/index.js';

const router = Router();

/**
 * POST /api/schedule/optimize
 * AI 일정 최적화 요청
 */
router.post('/optimize', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const {
      todo_ids,
      preferences
    } = req.body;

    // 사용자 데이터 로드
    const [events, allTodos] = await Promise.all([
      getEventsByUser(userId),
      getTodosByUser(userId)
    ]);

    // 최적화할 Todo 필터링
    let todosToSchedule = allTodos as Todo[];
    if (todo_ids && todo_ids.length > 0) {
      todosToSchedule = todosToSchedule.filter(t => todo_ids.includes(t.id));
    } else {
      // 미완료 + 시간 미배정 Todo만
      todosToSchedule = todosToSchedule.filter(t => !t.is_completed && !t.scheduled_at);
    }

    if (todosToSchedule.length === 0) {
      res.json({
        message: '스케줄링할 Todo가 없습니다.',
        scheduled_items: [],
        conflicts: [],
        suggestions: []
      });
      return;
    }

    // Scheduler Agent 호출
    // Note: DBEvent[] -> Event[] 변환 필요 (실제로는 헬퍼 함수 사용 권장)
    const result = await scheduleTodos(
      todosToSchedule,
      events as unknown as Event[],
      preferences
    );

    // 결과 저장 (선택적)
    const { auto_apply = false } = req.body;
    if (auto_apply) {
      for (const item of result.scheduled_items) {
        const todo = todosToSchedule.find(t => t.title === item.title);
        if (todo && todo.id) {
          await updateTodo(todo.id, { scheduled_at: item.scheduled_at });
        }
      }
    }

    res.json({
      message: `${result.scheduled_items.length}개 항목 스케줄링 완료`,
      scheduled_items: result.scheduled_items,
      conflicts: result.conflicts,
      suggestions: result.suggestions
    });
  } catch (error) {
    console.error('Schedule optimize error:', error);
    res.status(500).json({ error: 'Failed to optimize schedule' });
  }
});

/**
 * GET /api/schedule/available-slots
 * 가용 시간 슬롯 조회
 */
router.get('/available-slots', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const {
      days = '7',
      work_start = '9',
      work_end = '18'
    } = req.query;

    const events = await getEventsByUser(userId) as unknown as Event[];

    const slots = calculateAvailableSlots(
      events,
      parseInt(work_start as string),
      parseInt(work_end as string),
      parseInt(days as string)
    );

    res.json({ slots });
  } catch (error) {
    console.error('Get available slots error:', error);
    res.status(500).json({ error: 'Failed to get available slots' });
  }
});

/**
 * POST /api/schedule/apply
 * 스케줄링 결과 적용
 */
router.post('/apply', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { scheduled_items } = req.body;

    if (!scheduled_items || scheduled_items.length === 0) {
      res.status(400).json({ error: 'No scheduled items provided' });
      return;
    }

    const updated = [];
    for (const item of scheduled_items) {
      if (item.todo_id) {
        const todo = await updateTodo(item.todo_id, {
          scheduled_at: item.scheduled_at
        });
        updated.push(todo);
      }
    }

    res.json({
      message: `${updated.length}개 항목에 시간 적용 완료`,
      updated
    });
  } catch (error) {
    console.error('Apply schedule error:', error);
    res.status(500).json({ error: 'Failed to apply schedule' });
  }
});

export default router;
