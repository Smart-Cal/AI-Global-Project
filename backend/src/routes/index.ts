import { Router } from 'express';
import authRoutes from './auth.js';
import chatRoutes from './chat.js';
import eventsRoutes from './events.js';
import todosRoutes from './todos.js';
import scheduleRoutes from './schedule.js';

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

export default router;
