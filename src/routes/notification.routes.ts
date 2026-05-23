import { Router } from 'express';
import {
  getUserNotifications,
  createNotification,
  markAsRead,
  markAllRead,
  deleteNotification,
} from '../controllers/notification.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

// Apply auth middleware to all routes
router.use(protect);

router.route('/')
  .get(getUserNotifications)
  .post(createNotification);

router.put('/mark-all-read', markAllRead);
router.put('/:id/read', markAsRead);
router.delete('/:id', deleteNotification);

export default router;
