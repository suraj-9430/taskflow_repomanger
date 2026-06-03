import { Router } from 'express';
import { chatWithAI, breakdownTask } from '../controllers/ai.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

// All AI routes require a valid JWT token
router.use(protect);

// POST /api/ai/chat — Conversational AI chat with Gemini
router.post('/chat', chatWithAI);

// POST /api/ai/breakdown — Generate task subtask checklist
router.post('/breakdown', breakdownTask);

export default router;
