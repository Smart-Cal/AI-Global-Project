import { Router, Response } from 'express';
import {
  getCategoriesByUser,
  createCategory,
  updateCategory,
  deleteCategory,
  getOrCreateDefaultCategory
} from '../services/database.js';
import { AuthRequest, authenticate } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/categories
 * 카테고리 목록 조회
 */
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    // 기본 카테고리가 없으면 생성
    await getOrCreateDefaultCategory(userId);

    const categories = await getCategoriesByUser(userId);
    res.json({ categories });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Failed to get categories' });
  }
});

/**
 * POST /api/categories
 * 카테고리 생성
 */
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { name, color } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Category name is required' });
      return;
    }

    const category = await createCategory({
      user_id: userId,
      name,
      color: color || '#9CA3AF',
      is_default: false
    });

    res.status(201).json({ category });
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

/**
 * PUT /api/categories/:id
 * 카테고리 수정
 */
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, color } = req.body;

    const category = await updateCategory(id, { name, color });
    res.json({ category });
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

/**
 * DELETE /api/categories/:id
 * 카테고리 삭제
 */
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await deleteCategory(id);
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

export default router;
