import { Router } from 'express';
import {
  getAllTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  getTaskComments,
  createTaskComment,
  bulkUpdateTasks,
  bulkDeleteTasks,
} from '../controllers/task.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

// Apply auth middleware to all routes
router.use(protect);

router.route('/')
  .get(getAllTasks)
  .post(createTask);

router.put('/bulk', bulkUpdateTasks);
router.delete('/bulk', bulkDeleteTasks);

router.route('/:id')
  .get(getTaskById)
  .put(updateTask)
  .delete(deleteTask);

router.route('/:id/comments')
  .get(getTaskComments)
  .post(createTaskComment);

export default router;
