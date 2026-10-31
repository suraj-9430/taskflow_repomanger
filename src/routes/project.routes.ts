import { Router } from 'express';
import {
  getAllProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  bulkUpdateProjects,
  bulkDeleteProjects,
} from '../controllers/project.controller';
import { protect, authorize } from '../middleware/auth.middleware';

const router = Router();

// All project routes require a valid JWT token
router.use(protect);

// GET /api/projects - role-scoped project list
router.get('/', getAllProjects);

// Management bulk operations
router.put('/bulk', authorize('admin', 'manager'), bulkUpdateProjects);
router.delete('/bulk', authorize('admin'), bulkDeleteProjects);

// GET /api/projects/:id - single project lookup (scoped to assignees for employees)
router.get('/:id', getProjectById);

// POST /api/projects - restricted to admin and manager
router.post('/', authorize('admin', 'manager'), createProject);

// PUT /api/projects/:id - restricted to admin and manager
router.put('/:id', authorize('admin', 'manager'), updateProject);

// DELETE /api/projects/:id - restricted to admin
router.delete('/:id', authorize('admin'), deleteProject);

export default router;
