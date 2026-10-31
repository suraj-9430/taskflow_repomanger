import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import taskRoutes from './task.routes';
import userRoutes from './user.routes';
import Task from '../models/task.model';
import User from '../models/user.model';

jest.mock('../models/task.model');
jest.mock('../models/user.model');
jest.mock('../models/project.model');
jest.mock('../utils/rabbitmq', () => ({
  publishToQueue: jest.fn().mockResolvedValue(true),
}));

describe('Phase 1 Security Baseline Tests', () => {
  let app: express.Express;

  const adminUser = { id: 'admin_123', role: 'admin' };
  const managerUser = { id: 'mgr_456', role: 'manager' };
  const employeeUser = { id: 'emp_789', role: 'employee' };

  const adminToken = jwt.sign({ user: adminUser }, config.jwt.secret, { expiresIn: '15m' });
  const managerToken = jwt.sign({ user: managerUser }, config.jwt.secret, { expiresIn: '15m' });
  const employeeToken = jwt.sign({ user: employeeUser }, config.jwt.secret, { expiresIn: '15m' });

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/tasks', taskRoutes);
    app.use('/api/users', userRoutes);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Server-Side Role Enforcement (PDF Section 5)', () => {
    it('should reject standard employee attempting to view entire user directory (GET /api/users)', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('not authorized');
    });

    it('should allow manager to view user directory (GET /api/users)', async () => {
      (User.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue([{ userId: '101', firstName: 'Jane' }]),
      });

      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should allow employees to access scoped employee directory (GET /api/users/employees)', async () => {
      (User.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockResolvedValue([
            { userId: '102', firstName: 'Alice', designation: 'Engineer', empStatus: 'active' },
          ]),
        }),
      });

      const res = await request(app)
        .get('/api/users/employees')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data[0].designation).toBe('Engineer');
    });

    it('should reject non-admin attempting to alter roles (PUT /api/users/:id)', async () => {
      const res = await request(app)
        .put('/api/users/emp_789')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ role: 'admin' });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('not authorized');
    });

    it('should allow admin to update user roles (PUT /api/users/:id)', async () => {
      (User.findOneAndUpdate as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue({
          userId: 'emp_789',
          role: 'manager',
          empStatus: 'active',
        }),
      });

      const res = await request(app)
        .put('/api/users/emp_789')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'manager' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.role).toBe('manager');
    });
  });

  describe('2. Derived Identity from Authenticated Session (PDF Section 3)', () => {
    it('should ignore client-supplied createdBy and derive it from token on task creation', async () => {
      const mockSavedTask = {
        _id: 'task_mock_1',
        title: 'Security Audit Task',
        projectId: 'proj_1',
        createdBy: employeeUser.id, // Must match the authenticated caller
        status: 'To Do',
      };

      (Task.prototype.save as jest.Mock) = jest.fn().mockResolvedValue(mockSavedTask);
      (Task.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue(mockSavedTask),
          }),
        }),
      });

      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          title: 'Security Audit Task',
          projectId: '507f1f77bcf86cd799439011',
          createdBy: 'forged_admin_id_that_should_be_ignored', // Attacker attempt
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      // Verify Mongoose model instantiated with employeeUser.id, not forged ID
      expect((Task as any).mock.calls[0][0].createdBy).toBe(employeeUser.id);
    });
  });

  describe('3. Object-Level Authorization & IDOR Protection (PDF Section 4)', () => {
    it('should block employee from modifying a task assigned to someone else', async () => {
      (Task.findById as jest.Mock).mockResolvedValue({
        _id: 'task_other_user',
        assignedTo: 'different_user_id',
        status: 'To Do',
      });

      const res = await request(app)
        .put('/api/tasks/task_other_user')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ status: 'Completed' });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('Employees can only update tasks assigned to them');
    });

    it('should prevent employee from modifying restricted fields (assignedTo, priority)', async () => {
      (Task.findById as jest.Mock).mockResolvedValue({
        _id: 'task_self',
        assignedTo: employeeUser.id,
        status: 'To Do',
      });

      const res = await request(app)
        .put('/api/tasks/task_self')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ assignedTo: 'reassigned_user_id', status: 'In Progress' });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('Employees cannot modify: assignedTo');
    });

    it('should block employee from deleting tasks (DELETE /api/tasks/:id)', async () => {
      const res = await request(app)
        .delete('/api/tasks/any_task_id')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('not authorized');
    });

    it('should block employee from bulk task updates (PUT /api/tasks/bulk)', async () => {
      const res = await request(app)
        .put('/api/tasks/bulk')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ taskIds: ['t1', 't2'], updates: { status: 'Completed' } });

      expect(res.status).toBe(403);
    });
  });

  describe('4. Input Validation & Update Allowlists (PDF Section 6)', () => {
    it('should reject invalid task status values with 400 Bad Request', async () => {
      (Task.findById as jest.Mock).mockResolvedValue({
        _id: 'task_admin',
        assignedTo: 'any_user',
        status: 'To Do',
      });

      const res = await request(app)
        .put('/api/tasks/task_admin')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'ArbitraryIllegalStatus' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid task status');
    });
  });
});
