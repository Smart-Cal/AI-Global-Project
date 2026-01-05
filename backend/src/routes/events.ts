import { Router, Response } from 'express';
import {
  getEventsByUser,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  completeEvent
} from '../services/database.js';
import { AuthRequest, authenticate } from '../middleware/auth.js';
import { Event, CreateEventRequest } from '../types/index.js';

const router = Router();

/**
 * GET /api/events
 * Get event list
 */
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { start_date, end_date, is_fixed, include_completed } = req.query;

    let events = await getEventsByUser(
      userId,
      start_date as string | undefined,
      end_date as string | undefined
    );

    // Filter by is_fixed
    if (is_fixed !== undefined) {
      const fixed = is_fixed === 'true';
      events = events.filter(e => e.is_fixed === fixed);
    }

    // Exclude completed events (default)
    if (include_completed !== 'true') {
      events = events.filter(e => !e.is_completed);
    }

    res.json({ events });
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ error: 'Failed to get events' });
  }
});

/**
 * GET /api/events/:id
 * Get single event
 */
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const event = await getEventById(id);

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
 * Create event
 */
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const {
      title,
      description,
      event_date,
      start_time,
      end_time,
      is_all_day,
      location,
      is_fixed,
      priority,
      category_id,
      related_todo_id
    }: CreateEventRequest = req.body;

    if (!title || !event_date) {
      res.status(400).json({ error: 'Title and event_date are required' });
      return;
    }

    const event = await createEvent({
      user_id: userId,
      title,
      description,
      event_date,
      start_time,
      end_time,
      is_all_day: is_all_day || false,
      location,
      is_fixed: is_fixed !== false, // Default true
      priority: priority || 3,
      category_id,
      related_todo_id,
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
 * Update event
 */
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Remove non-editable fields
    delete updates.id;
    delete updates.user_id;
    delete updates.created_at;
    delete updates.completed_at; // Only modifiable via separate API

    const event = await updateEvent(id, updates);
    res.json({ event });
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

/**
 * DELETE /api/events/:id
 * Delete event
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
 * Complete event (also updates linked Todo and Goal progress)
 */
router.patch('/:id/complete', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { is_completed } = req.body;

    let event: Event;

    if (is_completed === false) {
      // Cancel completion
      event = await updateEvent(id, {
        is_completed: false,
        completed_at: undefined
      });
    } else {
      // Mark as complete (includes Todo and Goal progress update)
      event = await completeEvent(id);
    }

    res.json({ event });
  } catch (error) {
    console.error('Complete event error:', error);
    res.status(500).json({ error: 'Failed to update event completion' });
  }
});

export default router;
