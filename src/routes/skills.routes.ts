import { Router } from 'express';
import {
  getMySkills,
  getEmployeeSkills,
  updateMySkills,
  suggestEmployeeForTask,
  getSkillGapAnalysis,
  getLearningRecommendations,
} from '../controllers/skills.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

router.use(protect);

// GET /api/skills/my-skills
router.get('/my-skills', getMySkills);

// GET /api/skills/employee/:employeeId
router.get('/employee/:employeeId', getEmployeeSkills);

// PUT /api/skills/my-skills
router.put('/my-skills', updateMySkills);

// POST /api/skills/suggest-employee
router.post('/suggest-employee', suggestEmployeeForTask);

// GET /api/skills/gap-analysis
router.get('/gap-analysis', getSkillGapAnalysis);

// GET /api/skills/learning-recommendations
router.get('/learning-recommendations', getLearningRecommendations);

export default router;
