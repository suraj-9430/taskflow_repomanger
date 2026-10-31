import { Router } from 'express';
import {
  countactiveuser,
  countuserbyrole,
  createUser,
  fetchuserlimit,
  getAllUsers,
  getEmployees,
  getUserById,
  loginUser,
  logoutUser,
  refreshUserToken,
  forgotPassword,
  resetPassword,
  updateUser,
  getCurrentProfile,
  updateCurrentProfile,
} from '../controllers/user.controller';
import { protect, authorize } from '../middleware/auth.middleware';
import { authLimiter } from '../middleware/rateLimiter';

const router = Router();

// Administrative and management user directory endpoints
router.get('/', protect, authorize('admin', 'manager'), getAllUsers);
router.get('/fetchuserlimit', protect, authorize('admin', 'manager'), fetchuserlimit);
router.get('/countuserbyrole', protect, authorize('admin', 'manager'), countuserbyrole);
router.get('/countactiveusers', protect, authorize('admin', 'manager'), countactiveuser);

// Scoped employee directory for project assignment (all authenticated users)
router.get('/employees', protect, getEmployees);

// Profile routes (caller updates their own verified profile)
router.get('/profile', protect, getCurrentProfile);
router.put('/profile', protect, updateCurrentProfile);

// Specific user lookup
router.get('/:id', protect, getUserById);

// Admin-only user provisioning
router.post('/', protect, authorize('admin'), createUser);

// POST /api/users/login - Login user
router.post('/login', authLimiter, loginUser);

// POST /api/users/refresh-token - Refresh token
router.post('/refresh-token', refreshUserToken);

// POST /api/users/logout - Logout user
router.post('/logout', logoutUser);

// POST /api/users/forgot-password - Send OTP
router.post('/forgot-password', authLimiter, forgotPassword);

// POST /api/users/reset-password - Reset password with OTP
router.post('/reset-password', authLimiter, resetPassword);

// Admin-only user modification (role/status elevation)
router.put('/:id', protect, authorize('admin'), updateUser);

// // DELETE /api/users/:id - Delete user
// router.delete('/:id', deleteUser);

export default router;
