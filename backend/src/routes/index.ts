import { Router } from 'express';
import authRoutes from './auth.js';
import chatRoutes from './chat.js';
import eventsRoutes from './events.js';
import todosRoutes from './todos.js';
import scheduleRoutes from './schedule.js';
import categoriesRoutes from './categories.js';
import goalsRoutes from './goals.js';
import groupsRoutes from './groups.js';
import briefingRoutes from './briefing.js';

const router = Router();

// Health check
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
router.use('/auth', authRoutes);
router.use('/chat', chatRoutes);
router.use('/events', eventsRoutes);
router.use('/todos', todosRoutes);
router.use('/schedule', scheduleRoutes);
router.use('/categories', categoriesRoutes);
router.use('/goals', goalsRoutes);
router.use('/groups', groupsRoutes);
router.use('/briefing', briefingRoutes);

export default router;
