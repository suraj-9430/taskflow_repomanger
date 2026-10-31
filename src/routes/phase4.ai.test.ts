import request from 'supertest';
import app from '../app';
import { validateStringArrayOutput } from '../controllers/ai.controller';
import jwt from 'jsonwebtoken';
import { config } from '../config';

describe('Phase 4: AI Hardening, Output Validation & Tracing', () => {
  let employeeToken: string;

  beforeAll(() => {
    employeeToken = jwt.sign(
      { id: '65f1a2b3c4d5e6f7a8b9c0d1', role: 'employee' },
      config.jwt.secret,
      { expiresIn: '1h' }
    );
  });

  describe('validateStringArrayOutput Schema Validator', () => {
    it('successfully parses and cleans markdown-wrapped JSON arrays', () => {
      const rawMarkdown = '```json\n["Write test", "Refactor controller", "Deploy"]\n```';
      const result = validateStringArrayOutput(rawMarkdown, 5);

      expect(result).toEqual(['Write test', 'Refactor controller', 'Deploy']);
    });

    it('enforces maximum item limits and truncates oversized strings', () => {
      const longString = 'A'.repeat(200);
      const rawJson = JSON.stringify(['Item 1', 'Item 2', 'Item 3', longString]);
      const result = validateStringArrayOutput(rawJson, 2);

      expect(result).toHaveLength(2);
      expect(result).toEqual(['Item 1', 'Item 2']);
    });

    it('rejects invalid JSON syntax', () => {
      expect(() => {
        validateStringArrayOutput('Not a json array');
      }).toThrow('AI output was not valid JSON');
    });

    it('rejects non-array outputs', () => {
      expect(() => {
        validateStringArrayOutput('{"status": "ok"}');
      }).toThrow('AI output must be a non-empty array');
    });
  });

  describe('AI Endpoints Resilient Fallback Handling', () => {
    it('returns labeled deterministic fallback when Gemini is unavailable for task breakdown', async () => {
      const res = await request(app)
        .post('/api/ai/breakdown')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ title: 'Build distributed tracer' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(3);
      // Confirms the response explicitly flags whether it came from fallback
      expect(res.body).toHaveProperty('isFallback');
    });

    it('returns labeled deterministic fallback when Gemini is unavailable for daily plan', async () => {
      const res = await request(app)
        .post('/api/ai/daily-plan')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          projects: [{ projectName: 'Core Engine' }],
          tasks: [{ title: 'Fix race conditions', priority: 'High', status: 'In Progress' }],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body).toHaveProperty('isFallback');
    });
  });

  describe('Correlation ID Middleware & Distributed Tracing', () => {
    it('automatically generates and sets an X-Request-Id header when missing', async () => {
      const res = await request(app).get('/health/live');

      expect(res.status).toBe(200);
      expect(res.headers['x-request-id']).toBeDefined();
      expect(typeof res.headers['x-request-id']).toBe('string');
      expect(res.headers['x-request-id'].length).toBeGreaterThan(10);
    });

    it('preserves and reflects client-provided valid X-Request-Id', async () => {
      const customTraceId = 'client-trace-12345678-abcd';
      const res = await request(app)
        .get('/health/live')
        .set('X-Request-Id', customTraceId);

      expect(res.status).toBe(200);
      expect(res.headers['x-request-id']).toBe(customTraceId);
    });
  });
});
