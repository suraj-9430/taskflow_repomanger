import { Router } from 'express';
import {
  applyLeave,
  getMyLeaves,
  getPendingLeaves,
  approveLeave,
  rejectLeave,
  getLeaveBalance,
  getAllLeaves
} from '../controllers/leave.controller';
import { protect, authorize } from '../middleware/auth.middleware';

const router = Router();

// Protect all routes
router.use(protect);

// Employee routes
router.post('/apply', applyLeave);
router.get('/my-leaves', getMyLeaves);
router.get('/balance', getLeaveBalance);

// Admin/Manager routes
router.get('/all', authorize('admin', 'manager'), getAllLeaves);
router.get('/pending', authorize('admin', 'manager'), getPendingLeaves);
router.put('/:id/approve', authorize('admin', 'manager'), approveLeave);
router.put('/:id/reject', authorize('admin', 'manager'), rejectLeave);

export default router;
