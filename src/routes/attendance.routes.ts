import { Router } from 'express';
import { 
  clockIn, 
  clockOut, 
  getMyAttendanceHistory, 
  getAllAttendance, 
  getUserAttendanceHistory,
  getPendingApprovals,
  approveAttendance,
  rejectAttendance,
  getOfficeCoords,
  updateOfficeCoords
} from '../controllers/attendance.controller';
import { protect, authorize } from '../middleware/auth.middleware';

const router = Router();

// Secure all attendance endpoints with JWT validation
router.use(protect);

router.post('/clock-in', clockIn);
router.post('/clock-out', clockOut);
router.get('/history', getMyAttendanceHistory);
router.get('/all', authorize('admin'), getAllAttendance);
router.get('/user/:userId', getUserAttendanceHistory);

// Office coordinates configuration endpoints
router.get('/office-coords', getOfficeCoords);
router.put('/office-coords', authorize('admin'), updateOfficeCoords);

// Admin Remote Work Approval routes
router.get('/pending', authorize('admin'), getPendingApprovals);
router.put('/approve/:id', authorize('admin'), approveAttendance);
router.put('/reject/:id', authorize('admin'), rejectAttendance);

export default router;
