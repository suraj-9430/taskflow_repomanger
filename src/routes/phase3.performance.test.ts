import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import taskRoutes from './task.routes';
import projectRoutes from './project.routes';
import Task from '../models/task.model';
import Project from '../models/project.model';
import * as cacheModule from '../utils/cache';

jest.mock('../models/task.model');
jest.mock('../models/project.model');
jest.mock('../utils/rabbitmq', () => ({
  publishToQueue: jest.fn().mockResolvedValue(true),
}));

describe('Phase 3 Performance & Consistency Tests (PDF Section 7, 8, 10)', () => {
  let app: express.Express;

  const adminUser = { id: 'admin_123', role: 'admin' };
  const adminToken = jwt.sign({ user: adminUser }, config.jwt.secret, { expiresIn: '15m' });

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/tasks', taskRoutes);
    app.use('/api/projects', projectRoutes);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Bounded Pagination on List APIs (PDF Section 7)', () => {
    it('should clamp oversized limit (e.g. limit=500) to maxLimit (100) and return metadata', async () => {
      const mockTasks = Array(10).fill({ _id: 't1', title: 'Sample Task' });

      (Task.countDocuments as jest.Mock).mockResolvedValue(250);
      (Task.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockReturnValue({
              sort: jest.fn().mockReturnValue({
                skip: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue(mockTasks),
                }),
              }),
            }),
          }),
        }),
      });

      const res = await request(app)
        .get('/api/tasks?page=1&limit=500')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.totalCount).toBe(250);
      expect(res.body.currentPage).toBe(1);
      expect(res.body.totalPages).toBe(3); // 250 / 100 = 3 pages
      expect(res.body.hasNextPage).toBe(true);
      expect(res.body.hasPrevPage).toBe(false);
    });

    it('should sanitize negative or malformed page numbers to page=1', async () => {
      (Task.countDocuments as jest.Mock).mockResolvedValue(10);
      (Task.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockReturnValue({
              sort: jest.fn().mockReturnValue({
                skip: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue([]),
                }),
              }),
            }),
          }),
        }),
      });

      const res = await request(app)
        .get('/api/tasks?page=-10&limit=abc')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.currentPage).toBe(1);
    });
  });

  describe('2. Cache Invalidation on Mutations (PDF Section 10)', () => {
    it('should invalidate task caches when a task is updated', async () => {
      const invalidateSpy = jest.spyOn(cacheModule, 'invalidateTag');

      (Task.findById as jest.Mock).mockResolvedValue({
        _id: 'task_update_1',
        title: 'Old Title',
        status: 'To Do',
      });

      (Task.findByIdAndUpdate as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue({
              _id: 'task_update_1',
              title: 'Updated Title',
              status: 'In Progress',
            }),
          }),
        }),
      });

      const res = await request(app)
        .put('/api/tasks/task_update_1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'In Progress' });

      expect(res.status).toBe(200);
      expect(invalidateSpy).toHaveBeenCalledWith('tasks');
    });

    it('should invalidate project caches when a project is created', async () => {
      const invalidateSpy = jest.spyOn(cacheModule, 'invalidateTag');

      const mockSavedProject = {
        _id: 'proj_new_1',
        projectName: 'New Proj',
        status: 'In Progress',
      };

      (Project.prototype.save as jest.Mock) = jest.fn().mockResolvedValue(mockSavedProject);
      (Project.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockSavedProject),
        }),
      });

      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          projectName: 'New Proj',
          description: 'Description of proj',
          startDate: new Date(),
          deadline: new Date(),
        });

      expect(res.status).toBe(201);
      expect(invalidateSpy).toHaveBeenCalledWith('projects');
    });
  });
});
