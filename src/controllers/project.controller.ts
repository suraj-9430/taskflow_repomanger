import { Response } from 'express';
import Project from '../models/project.model';
import { publishToQueue } from '../utils/rabbitmq';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/auth.middleware';

const VALID_STATUSES = ['In Progress', 'Completed', 'On Hold'];
const VALID_PRIORITIES = ['Low', 'Medium', 'High'];

// ─────────────────────────────────────────────
// GET /api/projects  — fetch projects scoped to caller role
// ─────────────────────────────────────────────
export const getAllProjects = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search, status, priority, assigneeId, deadlineFrom, deadlineTo } = req.query;
    const query: any = {};
    const userId = req.user?.id;
    const userRole = req.user?.role;

    // Scope for standard employees: only show projects they are assigned to
    if (userRole === 'employee' && userId) {
      query.assignees = userId;
    }

    if (search && typeof search === 'string') {
      const sanitized = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { projectName: { $regex: sanitized, $options: 'i' } },
        { description: { $regex: sanitized, $options: 'i' } },
        { projectId: { $regex: sanitized, $options: 'i' } },
      ];
    }

    if (status && typeof status === 'string' && status !== 'all' && VALID_STATUSES.includes(status)) {
      query.status = status;
    }

    if (priority && typeof priority === 'string' && priority !== 'all' && VALID_PRIORITIES.includes(priority)) {
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

// ─────────────────────────────────────────────
// PUT /api/projects/bulk  — management bulk update
// ─────────────────────────────────────────────
export const bulkUpdateProjects = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userRole = req.user?.role;
    if (userRole === 'employee') {
      res.status(403).json({ success: false, message: 'Employees are not authorized to perform bulk project updates' });
      return;
    }

    const { projectIds, updates } = req.body;

    if (!Array.isArray(projectIds) || projectIds.length === 0 || !updates || typeof updates !== 'object') {
      res.status(400).json({ success: false, message: 'projectIds and updates are required' });
      return;
    }

    const allowedUpdates = ['status', 'priority', 'deadline', 'progress'];
    const sanitizedUpdates: any = {};
    for (const key of allowedUpdates) {
      if (updates[key] !== undefined && updates[key] !== '') {
        sanitizedUpdates[key] = updates[key];
      }
    }

    if (sanitizedUpdates.status && !VALID_STATUSES.includes(sanitizedUpdates.status)) {
      res.status(400).json({ success: false, message: 'Invalid project status' });
      return;
    }

    if (sanitizedUpdates.priority && !VALID_PRIORITIES.includes(sanitizedUpdates.priority)) {
      res.status(400).json({ success: false, message: 'Invalid project priority' });
      return;
    }

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

// ─────────────────────────────────────────────
// DELETE /api/projects/bulk  — management bulk delete
// ─────────────────────────────────────────────
export const bulkDeleteProjects = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userRole = req.user?.role;
    if (userRole !== 'admin') {
      res.status(403).json({ success: false, message: 'Only administrators can perform bulk project deletions' });
      return;
    }

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
// GET /api/projects/:id  — fetch single project
// ─────────────────────────────────────────────
export const getProjectById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('assignees', 'firstName lastName email designation')
      .populate('createdBy', 'firstName lastName email');

    if (!project) {
      res.status(404).json({ success: false, message: 'Project not found' });
      return;
    }

    const userId = req.user?.id;
    const userRole = req.user?.role;

    // Check project assignment for employees
    if (userRole === 'employee' && userId) {
      const isAssignee = project.assignees.some((a: any) => a._id?.toString() === userId || a.toString() === userId);
      if (!isAssignee) {
        res.status(403).json({ success: false, message: 'You do not have access to view this project' });
        return;
      }
    }

    res.status(200).json({ success: true, data: project });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch project', error: error.message });
  }
};

// ─────────────────────────────────────────────
// POST /api/projects  — create project with trusted session identity
// ─────────────────────────────────────────────
export const createProject = async (req: AuthRequest, res: Response): Promise<void> => {
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
    } = req.body;

    // Trusted identity derived directly from authenticated session
    const createdBy = req.user?.id;

    if (!createdBy) {
      res.status(401).json({ success: false, message: 'User context missing from token' });
      return;
    }

    if (!projectName || !description || !startDate || !deadline) {
      res.status(400).json({ success: false, message: 'Missing required fields' });
      return;
    }

    if (status && !VALID_STATUSES.includes(status)) {
      res.status(400).json({ success: false, message: 'Invalid project status' });
      return;
    }

    if (priority && !VALID_PRIORITIES.includes(priority)) {
      res.status(400).json({ success: false, message: 'Invalid project priority' });
      return;
    }

    const project = new Project({
      projectName: projectName.trim(),
      description: description.trim(),
      startDate,
      deadline,
      status: status || 'In Progress',
      priority: priority || 'Medium',
      progress: progress ?? 0,
      assignees: assignees || [],
      createdBy, // Token-derived identity
    });

    await project.save();

    const populated = await Project.findById(project._id)
      .populate('assignees', 'firstName lastName email designation')
      .populate('createdBy', 'firstName lastName email');

    // Fire background notification job
    if (assignees && assignees.length > 0) {
      await publishToQueue('project_assigned_queue', {
        projectId: project._id,
        projectName: project.projectName,
        assignees: project.assignees,
      });
    }

    res.status(201).json({ success: true, message: 'Project created successfully', data: populated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to create project', error: error.message });
  }
};

// ─────────────────────────────────────────────
// PUT /api/projects/:id  — update project with field allowlist
// ─────────────────────────────────────────────
export const updateProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const allowedFields = ['projectName', 'description', 'startDate', 'deadline', 'status', 'priority', 'progress', 'assignees'];
    const updateData: any = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    if (updateData.status && !VALID_STATUSES.includes(updateData.status)) {
      res.status(400).json({ success: false, message: 'Invalid project status' });
      return;
    }

    if (updateData.priority && !VALID_PRIORITIES.includes(updateData.priority)) {
      res.status(400).json({ success: false, message: 'Invalid project priority' });
      return;
    }

    const updated = await Project.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    )
      .populate('assignees', 'firstName lastName email designation')
      .populate('createdBy', 'firstName lastName email');

    if (!updated) {
      res.status(404).json({ success: false, message: 'Project not found' });
      return;
    }

    res.status(200).json({ success: true, message: 'Project updated successfully', data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to update project', error: error.message });
  }
};

// ─────────────────────────────────────────────
// DELETE /api/projects/:id  — delete project
// ─────────────────────────────────────────────
export const deleteProject = async (req: AuthRequest, res: Response): Promise<void> => {
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
