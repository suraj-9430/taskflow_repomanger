import request from 'supertest';
import app from '../app';

describe('Phase 5: Operational Probes & Health Checks', () => {
  describe('GET /health/live', () => {
    it('returns HTTP 200 live status immediately', async () => {
      const res = await request(app).get('/health/live');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('live');
      expect(res.body.timestamp).toBeDefined();
    });
  });

  describe('GET /health/ready', () => {
    it('returns service dependencies health status', async () => {
      const res = await request(app).get('/health/ready');

      // Depending on test runner MongoDB connection, returns 200 or 503 with service breakdown
      expect([200, 503]).toContain(res.status);
      expect(res.body).toHaveProperty('services');
      expect(res.body.services).toHaveProperty('mongodb');
      expect(res.body.services).toHaveProperty('redis');
      expect(res.body.services).toHaveProperty('rabbitmq');
    });
  });

  describe('GET /health (Legacy Compatibility)', () => {
    it('returns HTTP 200 for backward compatibility', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });

  describe('Distributed Request Tracing on Non-Existent Routes', () => {
    it('attaches correlation ID on 404 responses', async () => {
      const res = await request(app).get('/non-existent-probe-route');

      expect(res.status).toBe(404);
      expect(res.headers['x-request-id']).toBeDefined();
    });
  });
});
