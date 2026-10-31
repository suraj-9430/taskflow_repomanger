import express from 'express';
import request from 'supertest';
import userRoutes from './user.routes';
import { redisClient, RedisUnavailableError } from '../config/redis';
import { handleMessageWithIdempotency } from '../workers/email.worker';
import User from '../models/user.model';
import ProcessedEvent from '../models/processedEvent.model';

jest.mock('../models/user.model');
jest.mock('../models/processedEvent.model');
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test_msg_id' }),
  }),
}));

describe('Phase 2 Reliability & Messaging Tests (PDF Section 9, 11, 12)', () => {
  let app: express.Express;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/users', userRoutes);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Keyed HMAC OTP & Atomic Attempt Limits (PDF Section 9)', () => {
    it('should generate an OTP and store a keyed HMAC in Redis with 10 min TTL', async () => {
      const email = 'user@example.com';
      (User.findOne as jest.Mock).mockResolvedValue({ _id: 'u1', email });

      const setExSpy = jest.spyOn(redisClient, 'setEx').mockResolvedValue('OK');
      const delSpy = jest.spyOn(redisClient, 'del').mockResolvedValue(1);

      const res = await request(app)
        .post('/api/users/forgot-password')
        .send({ email });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify Redis key namespacing and TTL
      expect(setExSpy).toHaveBeenCalledWith(
        `otp:pwd_reset:${email}`,
        600,
        expect.any(String), // HMAC string
        true // requireAuthoritative flag
      );
      expect(delSpy).toHaveBeenCalledWith(`otp_attempts:pwd_reset:${email}`);
    });

    it('should fail safely with HTTP 503 when Redis is unavailable during OTP generation', async () => {
      const email = 'user@example.com';
      (User.findOne as jest.Mock).mockResolvedValue({ _id: 'u1', email });

      jest.spyOn(redisClient, 'setEx').mockRejectedValue(new RedisUnavailableError());

      const res = await request(app)
        .post('/api/users/forgot-password')
        .send({ email });

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('temporarily unavailable');
    });

    it('should lock out and invalidate OTP when exceeding 3 failed attempts (HTTP 429)', async () => {
      const email = 'user@example.com';

      // 4th attempt
      jest.spyOn(redisClient, 'incr').mockResolvedValue(4);
      jest.spyOn(redisClient, 'expire').mockResolvedValue(true);
      const delSpy = jest.spyOn(redisClient, 'del').mockResolvedValue(1);

      const res = await request(app)
        .post('/api/users/reset-password')
        .send({ email, otp: '123456', newPassword: 'NewPassword123' });

      expect(res.status).toBe(429);
      expect(res.body.message).toContain('Too many invalid attempts');
      expect(delSpy).toHaveBeenCalledWith(`otp:pwd_reset:${email}`);
    });

    it('should fail with HTTP 503 when Redis is down during password reset', async () => {
      const email = 'user@example.com';
      jest.spyOn(redisClient, 'incr').mockRejectedValue(new RedisUnavailableError());

      const res = await request(app)
        .post('/api/users/reset-password')
        .send({ email, otp: '123456', newPassword: 'NewPassword123' });

      expect(res.status).toBe(503);
      expect(res.body.message).toContain('temporarily unavailable');
    });
  });

  describe('2. Idempotent Background Processing (PDF Section 12)', () => {
    it('should acknowledge duplicate event without re-executing email side effect', async () => {
      const fakeMsg: any = {
        content: Buffer.from(JSON.stringify({
          eventId: 'evt_dup_123',
          eventType: 'task_assigned_queue',
          retryCount: 0,
          payload: { taskTitle: 'Task 1' },
        })),
        properties: {},
      };

      // Mock finding event already marked completed in MongoDB
      (ProcessedEvent.findOne as jest.Mock).mockResolvedValue({
        eventId: 'evt_dup_123',
        status: 'completed',
      });

      const mockHandler = jest.fn();
      const mockChannel: any = {
        ack: jest.fn(),
        nack: jest.fn(),
      };

      const { setWorkerChannel } = require('../workers/email.worker');
      setWorkerChannel(mockChannel);

      // Invoke consumer
      await handleMessageWithIdempotency(fakeMsg, 'task_assigned_queue', mockHandler);

      // Handler should NOT be called because it was already completed
      expect(mockHandler).not.toHaveBeenCalled();
      expect(mockChannel.ack).toHaveBeenCalledWith(fakeMsg);
    });
  });
});
