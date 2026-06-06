import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.middleware';
import {
  createScheduleEvent,
  deleteScheduleEvent,
  getCalendarEvents,
  updateScheduleEvent,
} from '../controllers/calendar.controller';

const router = Router();

router.use(protect);

router.get('/events', getCalendarEvents);
router.post('/events', authorize('admin', 'manager'), createScheduleEvent);
router.put('/events/:id', authorize('admin', 'manager'), updateScheduleEvent);
router.delete('/events/:id', authorize('admin', 'manager'), deleteScheduleEvent);

export default router;
