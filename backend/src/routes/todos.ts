import { Router, Response } from 'express';
import {
  getTodosByUser,
  createTodo,
  updateTodo,
  deleteTodo,
  completeTodo
} from '../services/database.js';
import { AuthRequest, authenticate } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/todos
 * Todo 목록 조회
 */
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const todos = await getTodosByUser(userId);

    res.json({ todos });
  } catch (error) {
    console.error('Get todos error:', error);
    res.status(500).json({ error: 'Failed to get todos' });
  }
});

/**
 * GET /api/todos/:id
 * 단일 Todo 조회
 */
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const todos = await getTodosByUser(userId);
    const todo = todos.find(t => t.id === id);

    if (!todo) {
      res.status(404).json({ error: 'Todo not found' });
      return;
    }

    res.json({ todo });
  } catch (error) {
    console.error('Get todo error:', error);
    res.status(500).json({ error: 'Failed to get todo' });
  }
});

/**
 * POST /api/todos
 * Todo 생성
 */
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const {
      title,
      description,
      event_id,
      timing,
      deadline,
      scheduled_at,
      duration,
      priority
    } = req.body;

    if (!title) {
      res.status(400).json({ error: 'Title is required' });
      return;
    }

    const todo = await createTodo({
      user_id: userId,
      title,
      description,
      event_id,
      timing: timing || 'before',
      deadline,
      scheduled_at,
      duration: duration || 30,
      priority: priority || 'medium',
      is_completed: false
    });

    res.status(201).json({ todo });
  } catch (error) {
    console.error('Create todo error:', error);
    res.status(500).json({ error: 'Failed to create todo' });
  }
});

/**
 * PUT /api/todos/:id
 * Todo 수정
 */
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // 수정 불가 필드 제거
    delete updates.id;
    delete updates.user_id;
    delete updates.created_at;

    const todo = await updateTodo(id, updates);
    res.json({ todo });
  } catch (error) {
    console.error('Update todo error:', error);
    res.status(500).json({ error: 'Failed to update todo' });
  }
});

/**
 * DELETE /api/todos/:id
 * Todo 삭제
 */
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await deleteTodo(id);
    res.json({ message: 'Todo deleted successfully' });
  } catch (error) {
    console.error('Delete todo error:', error);
    res.status(500).json({ error: 'Failed to delete todo' });
  }
});

/**
 * PATCH /api/todos/:id/complete
 * Todo 완료 처리
 */
router.patch('/:id/complete', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { is_completed } = req.body;

    let todo;
    if (is_completed !== false) {
      todo = await completeTodo(id);
    } else {
      todo = await updateTodo(id, {
        is_completed: false,
        completed_at: undefined
      });
    }

    res.json({ todo });
  } catch (error) {
    console.error('Complete todo error:', error);
    res.status(500).json({ error: 'Failed to update todo completion' });
  }
});

export default router;
