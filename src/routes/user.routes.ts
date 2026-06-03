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
  forgotPassword,
  resetPassword,
  updateUser,
  getCurrentProfile,
  updateCurrentProfile,
} from '../controllers/user.controller';
import { protect } from '../middleware/auth.middleware';
import { authLimiter } from '../middleware/rateLimiter';

const router = Router();

// GET /api/users - Get all users
router.get('/', getAllUsers);
router.get('/fetchuserlimit', fetchuserlimit);
router.get('/countuserbyrole', countuserbyrole);
router.get('/countactiveusers', countactiveuser);

// GET /api/users/employees - Get employees only (role=employee)
router.get('/employees', getEmployees);

// Profile routes (private)
router.get('/profile', protect, getCurrentProfile);
router.put('/profile', protect, updateCurrentProfile);


// // GET /api/users/:id - Get user by ID
router.get('/:id', getUserById);

// // POST /api/users - Create new user
router.post('/', createUser);

// POST /api/users/login - Login user
router.post('/login', authLimiter, loginUser);

// POST /api/users/logout - Logout user
router.post('/logout', logoutUser);

// POST /api/users/forgot-password - Send OTP
router.post('/forgot-password', authLimiter, forgotPassword);

// POST /api/users/reset-password - Reset password with OTP
router.post('/reset-password', authLimiter, resetPassword);

// PUT /api/users/:id - Update user
router.put('/:id', updateUser);

// // DELETE /api/users/:id - Delete user
// router.delete('/:id', deleteUser);

export default router;
