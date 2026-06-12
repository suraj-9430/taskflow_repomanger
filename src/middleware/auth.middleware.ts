import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Extend Request to carry decoded user info
export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
}

// ─────────────────────────────────────────────
// Middleware: protect  — verifies Bearer token
// ─────────────────────────────────────────────
export const protect = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    let token: string | undefined;

    console.log('Protect Middleware - Cookies:', req.cookies, 'Auth Header:', req.headers.authorization);

    // 1️⃣  Check Authorization: Bearer <token>
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    // 2️⃣  Fallback: token in cookie (if you later use httpOnly cookies)
    if (!token && req.cookies?.token) {
      token = req.cookies.token;
    }

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Access denied. No token provided. Please login.',
      });
      return;
    }

    const secret = process.env.JWT_SECRET || 'fallback_secret_key_change_me';
    const decoded = jwt.verify(token, secret) as { user: { id: string; role: string } };

    // Attach user info to the request for downstream use
    req.user = decoded.user;
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      res.status(401).json({
        success: false,
        message: 'Session expired. Please login again.',
      });
    } else {
      res.status(401).json({
        success: false,
        message: 'Invalid token. Please login again.',
      });
    }
  }
};

// ─────────────────────────────────────────────
// Middleware: authorize  — role-based guard
// Usage: authorize('admin', 'manager')
// ─────────────────────────────────────────────
export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: `Role '${req.user?.role}' is not authorized to access this resource.`,
      });
      return;
    }
    next();
  };
};
