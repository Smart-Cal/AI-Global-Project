import { Router, Response } from 'express';
import {
  getGoalsByUser,
  createGoal,
  updateGoal,
  deleteGoal
} from '../services/database.js';
import { AuthRequest, authenticate } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/goals
 * 목표 목록 조회
 */
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const goals = await getGoalsByUser(userId);
    res.json({ goals });
  } catch (error) {
    console.error('Get goals error:', error);
    res.status(500).json({ error: 'Failed to get goals' });
  }
});

/**
 * POST /api/goals
 * 목표 생성
 */
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { title, description, target_date, priority, category_id } = req.body;

    if (!title) {
      res.status(400).json({ error: 'Goal title is required' });
      return;
    }

    const goal = await createGoal({
      user_id: userId,
      title,
      description,
      target_date,
      priority: priority || 'medium',
      category_id,
      progress: 0,
      is_active: true
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

    const goal = await updateGoal(id, updates);
    res.json({ goal });
  } catch (error) {
    console.error('Update goal error:', error);
    res.status(500).json({ error: 'Failed to update goal' });
  }
});

/**
 * PATCH /api/goals/:id/progress
 * 목표 진행률 업데이트
 */
router.patch('/:id/progress', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { progress } = req.body;

    if (progress === undefined || progress < 0 || progress > 100) {
      res.status(400).json({ error: 'Invalid progress value (0-100)' });
      return;
    }

    const goal = await updateGoal(id, { progress });
    res.json({ goal });
  } catch (error) {
    console.error('Update goal progress error:', error);
    res.status(500).json({ error: 'Failed to update goal progress' });
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
