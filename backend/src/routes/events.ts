import { Router, Response } from 'express';
import {
  getEventsByUser,
  createEvent,
  updateEvent,
  deleteEvent
} from '../services/database.js';
import { AuthRequest, authenticate } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/events
 * 일정 목록 조회
 */
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { start_date, end_date } = req.query;

    const events = await getEventsByUser(
      userId,
      start_date as string | undefined,
      end_date as string | undefined
    );

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

    const event = await createEvent({
      user_id: userId,
      title,
      datetime,
      duration: duration || 60,
      type: type || 'personal',
      location,
      description,
      category_id,
      is_completed: false
    });

    res.status(201).json({ event });
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
    const updates = req.body;

    // 수정 불가 필드 제거
    delete updates.id;
    delete updates.user_id;
    delete updates.created_at;

    const event = await updateEvent(id, updates);
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

    const event = await updateEvent(id, {
      is_completed: is_completed !== false,
      completed_at: is_completed !== false ? new Date().toISOString() : undefined
    });

    res.json({ event });
  } catch (error) {
    console.error('Complete event error:', error);
    res.status(500).json({ error: 'Failed to update event completion' });
  }
});

export default router;
