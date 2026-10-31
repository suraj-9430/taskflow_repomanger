import { Router } from 'express';
import {
  chatWithAI,
  breakdownTask,
  generateDailyPlan,
  getProjectHealth,
  getExecutiveBrief,
  getWeeklyReport,
  askProjectHealthQA,
} from '../controllers/ai.controller';
import { protect } from '../middleware/auth.middleware';
import { aiLimiter } from '../middleware/rateLimiter';

const router = Router();

// All AI routes require a valid JWT token and are protected by dedicated rate limits
router.use(protect);
router.use(aiLimiter);

// POST /api/ai/chat — Conversational AI chat with Gemini
router.post('/chat', chatWithAI);

// POST /api/ai/breakdown — Generate task subtask checklist
router.post('/breakdown', breakdownTask);

// POST /api/ai/daily-plan — Generate manager's daily plan
router.post('/daily-plan', generateDailyPlan);

// GET /api/ai/project-health/:projectId? — Evaluate continuous AI Project Health Score
router.get('/project-health/:projectId?', getProjectHealth);

// GET /api/ai/executive-brief — Daily morning executive summary for managers
router.get('/executive-brief', getExecutiveBrief);

// GET /api/ai/weekly-report — Weekly project intelligence report
router.get('/weekly-report', getWeeklyReport);

// POST /api/ai/qa — Natural Language project intelligence Q&A
router.post('/qa', askProjectHealthQA);

export default router;
