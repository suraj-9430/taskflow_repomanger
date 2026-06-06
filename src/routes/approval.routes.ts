import { Router } from 'express';
import { createApprovalRequest, getApprovals, updateApprovalStatus } from '../controllers/approval.controller';
import { protect, authorize } from '../middleware/auth.middleware';

const router = Router();

router.use(protect);

router.post('/', createApprovalRequest);
router.get('/', getApprovals);
router.put('/:id', authorize('admin', 'manager'), updateApprovalStatus);

export default router;
