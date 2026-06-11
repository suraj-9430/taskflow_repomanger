import express, { Response } from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import { protect, authorize, AuthRequest } from './auth.middleware';

describe('Auth Middleware', () => {
  const jwtSecret = process.env.JWT_SECRET || 'fallback_secret_key_change_me';
  let app: express.Express;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use(cookieParser());

    // Public dummy endpoint
    app.get('/public', (_req, res) => {
      res.status(200).json({ success: true, message: 'Public content' });
    });

    // Protected dummy endpoint
    app.get('/protected', protect, (req: AuthRequest, res: Response) => {
      res.status(200).json({ success: true, user: req.user });
    });

    // Admin-only dummy endpoint
    app.get('/admin', protect, authorize('admin'), (req: AuthRequest, res: Response) => {
      res.status(200).json({ success: true, role: req.user?.role });
    });
  });

  describe('protect middleware', () => {
    it('should block requests without a token', async () => {
      const response = await request(app).get('/protected');
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('No token provided');
    });

    it('should allow requests with a valid Bearer token', async () => {
      const payload = { user: { id: '12345', role: 'employee' } };
      const token = jwt.sign(payload, jwtSecret, { expiresIn: '15m' });

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user).toEqual(payload.user);
    });

    it('should allow requests with a valid token in cookies', async () => {
      const payload = { user: { id: '12345', role: 'employee' } };
      const token = jwt.sign(payload, jwtSecret, { expiresIn: '15m' });

      const response = await request(app)
        .get('/protected')
        .set('Cookie', [`token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user).toEqual(payload.user);
    });

    it('should reject expired tokens', async () => {
      const payload = { user: { id: '12345', role: 'employee' } };
      const token = jwt.sign(payload, jwtSecret, { expiresIn: '-1s' }); // Expired instantly

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('expired');
    });

    it('should reject malformed or invalid tokens', async () => {
      const response = await request(app)
        .get('/protected')
        .set('Authorization', 'Bearer invalid_token_value');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid token');
    });
  });

  describe('authorize guard', () => {
    it('should allow access if user has the correct role', async () => {
      const payload = { user: { id: 'admin123', role: 'admin' } };
      const token = jwt.sign(payload, jwtSecret, { expiresIn: '15m' });

      const response = await request(app)
        .get('/admin')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.role).toBe('admin');
    });

    it('should deny access if user does not have the correct role', async () => {
      const payload = { user: { id: 'emp123', role: 'employee' } };
      const token = jwt.sign(payload, jwtSecret, { expiresIn: '15m' });

      const response = await request(app)
        .get('/admin')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('is not authorized');
    });
  });
});
