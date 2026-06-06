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
import { protect } from '../middleware/auth.middleware';

const router = Router();

// All project routes require a valid JWT token
router.use(protect);

// GET  /api/projects
router.get('/', getAllProjects);
router.put('/bulk', bulkUpdateProjects);
router.delete('/bulk', bulkDeleteProjects);

// GET  /api/projects/:id
router.get('/:id', getProjectById);

// POST /api/projects
router.post('/', createProject);

// PUT  /api/projects/:id
router.put('/:id', updateProject);

// DELETE /api/projects/:id
router.delete('/:id', deleteProject);

export default router;
