import { Router, Response } from 'express';
import {
  getGoalsByUser,
  getGoalById,
  createGoal,
  updateGoal,
  deleteGoal,
  getTodosByGoal,
  recalculateGoalProgress
} from '../services/database.js';
import { AuthRequest, authenticate } from '../middleware/auth.js';
import { Goal, CreateGoalRequest } from '../types/index.js';

const router = Router();

/**
 * GET /api/goals
 * 목표 목록 조회
 */
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { status, active_only } = req.query;

    let goals = await getGoalsByUser(userId);

    // 상태 필터링
    if (status && typeof status === 'string') {
      goals = goals.filter(g => g.status === status);
    }

    // 활성 목표만 (completed, failed 제외)
    if (active_only === 'true') {
      goals = goals.filter(g => !['completed', 'failed'].includes(g.status));
    }

    res.json({ goals });
  } catch (error) {
    console.error('Get goals error:', error);
    res.status(500).json({ error: 'Failed to get goals' });
  }
});

/**
 * GET /api/goals/:id
 * 단일 목표 조회 (연결된 Todo 포함)
 */
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const goal = await getGoalById(id);

    if (!goal) {
      res.status(404).json({ error: 'Goal not found' });
      return;
    }

    // 연결된 Todo 목록도 함께 반환
    const todos = await getTodosByGoal(id);

    res.json({
      goal,
      todos,
      progress: goal.total_estimated_time > 0
        ? Math.round((goal.completed_time / goal.total_estimated_time) * 100)
        : 0
    });
  } catch (error) {
    console.error('Get goal error:', error);
    res.status(500).json({ error: 'Failed to get goal' });
  }
});

/**
 * POST /api/goals
 * 목표 생성
 */
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const {
      title,
      description,
      target_date,
      priority,
      category_id
    }: CreateGoalRequest = req.body;

    if (!title) {
      res.status(400).json({ error: 'Goal title is required' });
      return;
    }

    if (!target_date) {
      res.status(400).json({ error: 'Target date is required' });
      return;
    }

    const goal = await createGoal({
      user_id: userId,
      title,
      description,
      target_date,
      priority: priority || 'medium',
      category_id,
      status: 'planning',
      total_estimated_time: 0,
      completed_time: 0
    });

    res.status(201).json({ goal });
  } catch (error) {
    console.error('Create goal error:', error);
    res.status(500).json({ error: 'Failed to create goal' });
  }
});

/**
 * PUT /api/goals/:id
 * 목표 수정
 */
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // 수정 불가 필드 제거
    delete updates.id;
    delete updates.user_id;
    delete updates.created_at;
    delete updates.completed_time; // 자동 계산 필드

    const goal = await updateGoal(id, updates);
    res.json({ goal });
  } catch (error) {
    console.error('Update goal error:', error);
    res.status(500).json({ error: 'Failed to update goal' });
  }
});

/**
 * PATCH /api/goals/:id/status
 * 목표 상태 변경
 */
router.patch('/:id/status', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['planning', 'scheduled', 'in_progress', 'completed', 'failed'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
      return;
    }

    const goal = await updateGoal(id, { status });
    res.json({ goal });
  } catch (error) {
    console.error('Update goal status error:', error);
    res.status(500).json({ error: 'Failed to update goal status' });
  }
});

/**
 * POST /api/goals/:id/recalculate
 * 목표 진행률 재계산
 */
router.post('/:id/recalculate', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const goal = await recalculateGoalProgress(id);

    res.json({
      goal,
      progress: goal.total_estimated_time > 0
        ? Math.round((goal.completed_time / goal.total_estimated_time) * 100)
        : 0
    });
  } catch (error) {
    console.error('Recalculate goal progress error:', error);
    res.status(500).json({ error: 'Failed to recalculate goal progress' });
  }
});

/**
 * DELETE /api/goals/:id
 * 목표 삭제
 */
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await deleteGoal(id);
    res.json({ message: 'Goal deleted successfully' });
  } catch (error) {
    console.error('Delete goal error:', error);
    res.status(500).json({ error: 'Failed to delete goal' });
  }
});

export default router;
