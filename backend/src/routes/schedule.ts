import { Router, Response } from 'express';
import {
  getEventsByUser,
  getTodosByUser,
  getUserById,
  updateTodo
} from '../services/database.js';
import { scheduleTodos, calculateAvailableSlots } from '../agents/schedulerAgent.js';
import { AuthRequest, authenticate } from '../middleware/auth.js';
import { Event, Todo, Chronotype, ScheduleRequest } from '../types/index.js';

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
      date_range,
      preferences
    } = req.body;

    // 사용자 데이터 로드
    const [events, allTodos, user] = await Promise.all([
      getEventsByUser(userId),
      getTodosByUser(userId),
      getUserById(userId)
    ]);

    // 사용자 Chronotype (기본값: afternoon)
    const userChronotype: Chronotype = user?.chronotype || 'afternoon';

    // 최적화할 Todo 필터링
    let todosToSchedule = allTodos as Todo[];
    if (todo_ids && todo_ids.length > 0) {
      todosToSchedule = todosToSchedule.filter(t => todo_ids.includes(t.id));
    } else {
      // 미완료 Todo만
      todosToSchedule = todosToSchedule.filter(t => !t.is_completed);
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

    // 날짜 범위 설정 (기본: 오늘부터 7일)
    const today = new Date();
    const defaultStart = today.toISOString().split('T')[0];
    const defaultEnd = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Scheduler Agent 호출
    const scheduleRequest: ScheduleRequest = {
      todos: todosToSchedule,
      existing_events: events as Event[],
      user_chronotype: userChronotype,
      date_range: {
        start: date_range?.start || defaultStart,
        end: date_range?.end || defaultEnd
      }
    };

    const result = await scheduleTodos(scheduleRequest);

    res.json({
      message: `${result.scheduled_items.length}개 항목 스케줄링 완료`,
      scheduled_items: result.scheduled_items,
      unscheduled_todos: result.unscheduled_todos,
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
      start_date,
      end_date,
      work_start = '8',
      work_end = '22'
    } = req.query;

    const [events, user] = await Promise.all([
      getEventsByUser(userId),
      getUserById(userId)
    ]);

    const userChronotype: Chronotype = user?.chronotype || 'afternoon';

    // 날짜 범위 설정
    const today = new Date();
    const defaultStart = today.toISOString().split('T')[0];
    const defaultEnd = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const slots = calculateAvailableSlots(
      events as Event[],
      userChronotype,
      (start_date as string) || defaultStart,
      (end_date as string) || defaultEnd,
      parseInt(work_start as string),
      parseInt(work_end as string)
    );

    res.json({ slots });
  } catch (error) {
    console.error('Get available slots error:', error);
    res.status(500).json({ error: 'Failed to get available slots' });
  }
});

/**
 * POST /api/schedule/apply
 * 스케줄링 결과 적용 (Todo에 예약 시간 저장 - 현재는 Event 생성으로 대체 권장)
 */
router.post('/apply', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { scheduled_items } = req.body;

    if (!scheduled_items || scheduled_items.length === 0) {
      res.status(400).json({ error: 'No scheduled items provided' });
      return;
    }

    // Note: Todo에 직접 시간을 저장하는 대신,
    // Event를 생성하고 related_todo_id로 연결하는 것을 권장
    res.json({
      message: `${scheduled_items.length}개 항목 스케줄 확인`,
      scheduled_items,
      note: 'Event 생성은 /api/events POST 엔드포인트를 사용하세요'
    });
  } catch (error) {
    console.error('Apply schedule error:', error);
    res.status(500).json({ error: 'Failed to apply schedule' });
  }
});

export default router;
