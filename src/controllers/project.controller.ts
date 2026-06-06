import { Request, Response } from 'express';
import Project from '../models/project.model';
import { publishToQueue } from '../utils/rabbitmq';
import mongoose from 'mongoose';

// ─────────────────────────────────────────────
// GET /api/projects  — fetch all with assignee names
// ─────────────────────────────────────────────
export const getAllProjects = async (req: Request, res: Response): Promise<void> => {
  try {
    const { search, status, priority, assigneeId, deadlineFrom, deadlineTo } = req.query;
    const query: any = {};

    if (search && typeof search === 'string') {
      query.$or = [
        { projectName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { projectId: { $regex: search, $options: 'i' } },
      ];
    }

    if (status && typeof status === 'string' && status !== 'all') {
      query.status = status;
    }

    if (priority && typeof priority === 'string' && priority !== 'all') {
      query.priority = priority;
    }

    if (assigneeId && typeof assigneeId === 'string' && assigneeId !== 'all' && mongoose.Types.ObjectId.isValid(assigneeId)) {
      query.assignees = assigneeId;
    }

    if (deadlineFrom || deadlineTo) {
      query.deadline = {};
      if (deadlineFrom && typeof deadlineFrom === 'string') {
        query.deadline.$gte = new Date(deadlineFrom);
      }
      if (deadlineTo && typeof deadlineTo === 'string') {
        query.deadline.$lte = new Date(deadlineTo);
      }
    }

    const projects = await Project.find(query)
      .populate('assignees', 'firstName lastName email designation')
      .populate('createdBy', 'firstName lastName email')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: projects });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch projects', error: error.message });
  }
};

export const bulkUpdateProjects = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectIds, updates } = req.body;

    if (!Array.isArray(projectIds) || projectIds.length === 0 || !updates || typeof updates !== 'object') {
      res.status(400).json({ success: false, message: 'projectIds and updates are required' });
      return;
    }

    const allowedUpdates = ['status', 'priority', 'deadline', 'progress'];
    const sanitizedUpdates = Object.fromEntries(
      Object.entries(updates).filter(([key, value]) => allowedUpdates.includes(key) && value !== undefined && value !== '')
    );

    if (Object.keys(sanitizedUpdates).length === 0) {
      res.status(400).json({ success: false, message: 'No valid bulk update fields were provided' });
      return;
    }

    await Project.updateMany({ _id: { $in: projectIds } }, { $set: sanitizedUpdates }, { runValidators: true });

    const projects = await Project.find({ _id: { $in: projectIds } })
      .populate('assignees', 'firstName lastName email designation')
      .populate('createdBy', 'firstName lastName email')
      .sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      message: `${projects.length} projects updated successfully`,
      data: projects,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to bulk update projects', error: error.message });
  }
};

export const bulkDeleteProjects = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectIds } = req.body;

    if (!Array.isArray(projectIds) || projectIds.length === 0) {
      res.status(400).json({ success: false, message: 'projectIds are required' });
      return;
    }

    const result = await Project.deleteMany({ _id: { $in: projectIds } });

    res.status(200).json({
      success: true,
      message: `${result.deletedCount || 0} projects deleted successfully`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to bulk delete projects', error: error.message });
  }
};

// ─────────────────────────────────────────────
// GET /api/projects/:id
// ─────────────────────────────────────────────
export const getProjectById = async (req: Request, res: Response): Promise<void> => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('assignees', 'firstName lastName email designation')
      .populate('createdBy', 'firstName lastName email');

    if (!project) {
      res.status(404).json({ success: false, message: 'Project not found' });
      return;
    }
    res.status(200).json({ success: true, data: project });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch project', error: error.message });
  }
};

// ─────────────────────────────────────────────
// POST /api/projects  — create new project
// ─────────────────────────────────────────────
export const createProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      projectName,
      description,
      startDate,
      deadline,
      status,
      priority,
      progress,
      assignees,
      createdBy,    // frontend sends the logged-in user's _id
    } = req.body;

    if (!projectName || !description || !startDate || !deadline || !createdBy) {
      res.status(400).json({ success: false, message: 'Missing required fields' });
      return;
    }

    const project = new Project({
      projectName,
      description,
      startDate,
      deadline,
      status: status || 'In Progress',
      priority: priority || 'Medium',
      progress: progress ?? 0,
      assignees: assignees || [],
      createdBy,
    });

    await project.save();

    // re-fetch with populated fields to return rich data
    const populated = await Project.findById(project._id)
      .populate('assignees', 'firstName lastName email designation')
      .populate('createdBy', 'firstName lastName email');

    // Fire event to RabbitMQ for email notification
    if (assignees && assignees.length > 0) {
      await publishToQueue('project_assigned_queue', {
        projectId: project._id,
        projectName: project.projectName,
        assigneeIds: assignees,
      });
    }

    res.status(201).json({ success: true, message: 'Project created successfully', data: populated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to create project', error: error.message });
  }
};

// ─────────────────────────────────────────────
// PUT /api/projects/:id  — update project
// ─────────────────────────────────────────────
export const updateProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const updated = await Project.findByIdAndUpdate(
      req.params.id,
      { ...req.body },
      { new: true, runValidators: true }
    )
      .populate('assignees', 'firstName lastName email designation')
      .populate('createdBy', 'firstName lastName email');

    if (!updated) {
      res.status(404).json({ success: false, message: 'Project not found' });
      return;
    }

    // Check if there are assignees in the update payload to trigger an email
    // In a real scenario, you'd only want to email *new* assignees, but for this feature we can send to those in the payload.
    if (req.body.assignees && req.body.assignees.length > 0) {
      await publishToQueue('project_assigned_queue', {
        projectId: updated._id,
        projectName: updated.projectName,
        assigneeIds: req.body.assignees,
      });
    }

    res.status(200).json({ success: true, message: 'Project updated successfully', data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to update project', error: error.message });
  }
};

// ─────────────────────────────────────────────
// DELETE /api/projects/:id
// ─────────────────────────────────────────────
export const deleteProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const deleted = await Project.findByIdAndDelete(req.params.id);
    if (!deleted) {
      res.status(404).json({ success: false, message: 'Project not found' });
      return;
    }
    res.status(200).json({ success: true, message: 'Project deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to delete project', error: error.message });
  }
};
