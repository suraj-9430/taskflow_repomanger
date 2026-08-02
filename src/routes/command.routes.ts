import { Router } from 'express';
import { processNaturalLanguageCommand } from '../controllers/command.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

router.use(protect);

// POST /api/ai/command — Command Center Natural Language Action Execution
router.post('/command', processNaturalLanguageCommand);

export default router;
