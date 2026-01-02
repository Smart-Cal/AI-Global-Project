import { Router, Response } from 'express';
import {
  getEventsByUser,
  createEvent,
  updateEvent,
  deleteEvent
} from '../services/database.js';
import { AuthRequest, authenticate } from '../middleware/auth.js';
import { DBEvent, Event } from '../types/index.js';

const router = Router();

// DB Event를 API Event 형식으로 변환하는 헬퍼 함수
function dbEventToApiEvent(dbEvent: DBEvent): Event {
  const datetime = `${dbEvent.event_date}T${dbEvent.start_time || '09:00'}:00`;

  // start_time과 end_time으로 duration 계산
  let duration = 60;
  if (dbEvent.start_time && dbEvent.end_time) {
    const start = new Date(`2000-01-01T${dbEvent.start_time}`);
    const end = new Date(`2000-01-01T${dbEvent.end_time}`);
    duration = Math.round((end.getTime() - start.getTime()) / 60000);
    if (duration <= 0) duration = 60;
  }

  return {
    id: dbEvent.id,
    user_id: dbEvent.user_id,
    category_id: dbEvent.category_id,
    title: dbEvent.title,
    description: dbEvent.description,
    datetime,
    duration,
    type: 'personal',
    location: dbEvent.location,
    is_completed: dbEvent.is_completed,
    completed_at: dbEvent.completed_at,
    created_at: dbEvent.created_at,
  };
}

/**
 * GET /api/events
 * 일정 목록 조회
 */
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { start_date, end_date } = req.query;

    const dbEvents = await getEventsByUser(
      userId,
      start_date as string | undefined,
      end_date as string | undefined
    );

    // DB Event를 API Event 형식으로 변환
    const events = dbEvents.map(dbEventToApiEvent);

    res.json({ events });
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ error: 'Failed to get events' });
  }
});

/**
 * GET /api/events/:id
 * 단일 일정 조회
 */
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const events = await getEventsByUser(userId);
    const event = events.find(e => e.id === id);

    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    res.json({ event });
  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({ error: 'Failed to get event' });
  }
});

/**
 * POST /api/events
 * 일정 생성
 */
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { title, datetime, duration, type, location, description, category_id } = req.body;

    if (!title || !datetime) {
      res.status(400).json({ error: 'Title and datetime are required' });
      return;
    }

    // datetime을 event_date와 start_time으로 변환
    const dt = new Date(datetime);
    const event_date = dt.toISOString().split('T')[0];
    const start_time = dt.toTimeString().slice(0, 5);

    // duration으로 end_time 계산
    const endDt = new Date(dt.getTime() + (duration || 60) * 60000);
    const end_time = endDt.toTimeString().slice(0, 5);

    const dbEvent = await createEvent({
      user_id: userId,
      title,
      event_date,
      start_time,
      end_time,
      is_all_day: false,
      location,
      description,
      category_id,
      is_completed: false
    });

    // API 응답은 datetime 형식으로 변환하여 반환
    const responseEvent = {
      ...dbEvent,
      datetime: `${dbEvent.event_date}T${dbEvent.start_time || '09:00'}:00`,
      duration: duration || 60,
      type: type || 'personal'
    };

    res.status(201).json({ event: responseEvent });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

/**
 * PUT /api/events/:id
 * 일정 수정
 */
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { datetime, duration, title, description, location, category_id, is_completed } = req.body;

    // datetime을 event_date, start_time, end_time으로 변환
    const dbUpdates: Record<string, any> = {};

    if (title !== undefined) dbUpdates.title = title;
    if (description !== undefined) dbUpdates.description = description;
    if (location !== undefined) dbUpdates.location = location;
    if (category_id !== undefined) dbUpdates.category_id = category_id;
    if (is_completed !== undefined) dbUpdates.is_completed = is_completed;

    if (datetime) {
      const dt = new Date(datetime);
      dbUpdates.event_date = dt.toISOString().split('T')[0];
      dbUpdates.start_time = dt.toTimeString().slice(0, 5);

      // duration으로 end_time 계산
      if (duration) {
        const endDt = new Date(dt.getTime() + duration * 60000);
        dbUpdates.end_time = endDt.toTimeString().slice(0, 5);
      }
    }

    const dbEvent = await updateEvent(id, dbUpdates);

    // API 응답은 Event 형식으로 변환
    const event = dbEventToApiEvent(dbEvent as unknown as DBEvent);
    res.json({ event });
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

/**
 * DELETE /api/events/:id
 * 일정 삭제
 */
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await deleteEvent(id);
    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

/**
 * PATCH /api/events/:id/complete
 * 일정 완료 처리
 */
router.patch('/:id/complete', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { is_completed } = req.body;

    const dbEvent = await updateEvent(id, {
      is_completed: is_completed !== false,
      completed_at: is_completed !== false ? new Date().toISOString() : undefined
    });

    // API 응답은 Event 형식으로 변환
    const event = dbEventToApiEvent(dbEvent as unknown as DBEvent);
    res.json({ event });
  } catch (error) {
    console.error('Complete event error:', error);
    res.status(500).json({ error: 'Failed to update event completion' });
  }
});

export default router;
