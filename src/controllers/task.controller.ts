import { Response } from 'express';
import Task from '../models/task.model';
import Project from '../models/project.model';
import { publishToQueue } from '../utils/rabbitmq';
import TaskComment from '../models/taskComment.model';
import Notification from '../models/notification.model';
import { getIO } from '../utils/socket';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/auth.middleware';
import { parsePagination, buildPaginatedResponse } from '../utils/pagination';
import { invalidateTag } from '../utils/cache';

const VALID_STATUSES = ['To Do', 'In Progress', 'Completed'];
const VALID_PRIORITIES = ['Low', 'Medium', 'High'];

// ─────────────────────────────────────────────
// GET /api/tasks  — fetch tasks scoped by role & bounded by pagination
// ─────────────────────────────────────────────
export const getAllTasks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      search,
      status,
      projectId,
      assignedTo,
      priority,
      dueFrom,
      dueTo,
    } = req.query;

    const query: any = {};
    const userId = req.user?.id;
    const userRole = req.user?.role;

    // Object-level scoping: Non-admin/manager callers only see tasks assigned to them or in projects they belong to
    if (userRole === 'employee' && userId) {
      const assignedProjects = await Project.find({ assignees: userId }).select('_id');
      const projectIds = assignedProjects.map(p => p._id);

      query.$or = [
        { assignedTo: userId },
        { projectId: { $in: projectIds } }
      ];
    }

    if (search && typeof search === 'string') {
      const sanitized = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchConditions = [
        { title: { $regex: sanitized, $options: 'i' } },
        { description: { $regex: sanitized, $options: 'i' } },
        { taskId: { $regex: sanitized, $options: 'i' } },
      ];
      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: searchConditions }];
        delete query.$or;
      } else {
        query.$or = searchConditions;
      }
    }

    if (status && typeof status === 'string' && status !== 'all' && VALID_STATUSES.includes(status)) {
      query.status = status;
    }

    if (priority && typeof priority === 'string' && priority !== 'all' && VALID_PRIORITIES.includes(priority)) {
      query.priority = priority;
    }

    if (projectId && typeof projectId === 'string' && projectId !== 'all' && mongoose.Types.ObjectId.isValid(projectId)) {
      query.projectId = projectId;
    }

    if (assignedTo && typeof assignedTo === 'string' && assignedTo !== 'all' && mongoose.Types.ObjectId.isValid(assignedTo)) {
      query.assignedTo = assignedTo;
    }

    if (dueFrom || dueTo) {
      query.dueDate = {};
      if (dueFrom && typeof dueFrom === 'string') {
        query.dueDate.$gte = new Date(dueFrom);
      }
      if (dueTo && typeof dueTo === 'string') {
        query.dueDate.$lte = new Date(dueTo);
      }
    }

    // PDF Section 7: Bounded pagination (default 20, max 100) with deterministic tie-breaker
    const pagination = parsePagination(req.query, 20, 100);

    const [totalCount, tasks] = await Promise.all([
      Task.countDocuments(query),
      Task.find(query)
        .populate('projectId', 'projectName')
        .populate('assignedTo', 'firstName lastName email designation')
        .populate('createdBy', 'firstName lastName email')
        .sort({ createdAt: -1, _id: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit),
    ]);

    const paginated = buildPaginatedResponse(tasks, totalCount, pagination);
    res.status(200).json(paginated);
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch tasks', error: error.message });
  }
};

// ─────────────────────────────────────────────
// PUT /api/tasks/bulk  — management bulk update
// ─────────────────────────────────────────────
export const bulkUpdateTasks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { taskIds, updates } = req.body;
    const userRole = req.user?.role;

    if (userRole === 'employee') {
      res.status(403).json({ success: false, message: 'Employees are not authorized to perform bulk task updates' });
      return;
    }

    if (!Array.isArray(taskIds) || taskIds.length === 0 || !updates || typeof updates !== 'object') {
      res.status(400).json({ success: false, message: 'taskIds and updates are required' });
      return;
    }

    const allowedUpdates = ['status', 'priority', 'assignedTo', 'projectId', 'dueDate'];
    const sanitizedUpdates: any = {};
    for (const key of allowedUpdates) {
      if (updates[key] !== undefined && updates[key] !== '') {
        sanitizedUpdates[key] = updates[key];
      }
    }

    if (sanitizedUpdates.status && !VALID_STATUSES.includes(sanitizedUpdates.status)) {
      res.status(400).json({ success: false, message: 'Invalid task status value' });
      return;
    }

    if (sanitizedUpdates.priority && !VALID_PRIORITIES.includes(sanitizedUpdates.priority)) {
      res.status(400).json({ success: false, message: 'Invalid task priority value' });
      return;
    }

    if (Object.keys(sanitizedUpdates).length === 0) {
      res.status(400).json({ success: false, message: 'No valid bulk update fields were provided' });
      return;
    }

    await Task.updateMany({ _id: { $in: taskIds } }, { $set: sanitizedUpdates }, { runValidators: true });

    const tasks = await Task.find({ _id: { $in: taskIds } })
      .populate('projectId', 'projectName')
      .populate('assignedTo', 'firstName lastName email designation')
      .populate('createdBy', 'firstName lastName email')
      .sort({ updatedAt: -1, _id: -1 });

    if (sanitizedUpdates.assignedTo) {
      await Promise.all(
        tasks.map((task) =>
          publishToQueue('task_assigned_queue', {
            taskId: task._id,
            taskTitle: task.title,
            assigneeId: sanitizedUpdates.assignedTo,
            projectId: task.projectId,
          })
        )
      );
    }

    // Invalidate caches for tasks
    await invalidateTag('tasks');

    res.status(200).json({
      success: true,
      message: `${tasks.length} tasks updated successfully`,
      data: tasks,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to bulk update tasks', error: error.message });
  }
};

// ─────────────────────────────────────────────
// DELETE /api/tasks/bulk  — management bulk delete
// ─────────────────────────────────────────────
export const bulkDeleteTasks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { taskIds } = req.body;
    const userRole = req.user?.role;

    if (userRole === 'employee') {
      res.status(403).json({ success: false, message: 'Employees are not authorized to perform bulk task deletions' });
      return;
    }

    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      res.status(400).json({ success: false, message: 'taskIds are required' });
      return;
    }

    const result = await Task.deleteMany({ _id: { $in: taskIds } });

    // Invalidate caches
    await invalidateTag('tasks');

    res.status(200).json({
      success: true,
      message: `${result.deletedCount || 0} tasks deleted successfully`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to bulk delete tasks', error: error.message });
  }
};

// ─────────────────────────────────────────────
// GET /api/tasks/:id
// ─────────────────────────────────────────────
export const getTaskById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('projectId', 'projectName assignees')
      .populate('assignedTo', 'firstName lastName email designation')
      .populate('createdBy', 'firstName lastName email');

    if (!task) {
      res.status(404).json({ success: false, message: 'Task not found' });
      return;
    }

    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (userRole === 'employee' && userId) {
      const isAssignee = task.assignedTo && (task.assignedTo as any)._id?.toString() === userId;
      const projectAssignees = (task.projectId as any)?.assignees?.map((a: any) => a.toString()) || [];
      const isInProject = projectAssignees.includes(userId);

      if (!isAssignee && !isInProject) {
        res.status(403).json({ success: false, message: 'You do not have access to view this task' });
        return;
      }
    }

    res.status(200).json({ success: true, data: task });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch task', error: error.message });
  }
};

// ─────────────────────────────────────────────
// POST /api/tasks
// ─────────────────────────────────────────────
export const createTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      title,
      description,
      projectId,
      assignedTo,
      status,
      priority,
      dueDate,
    } = req.body;

    const createdBy = req.user?.id;

    if (!createdBy) {
      res.status(401).json({ success: false, message: 'User context missing from authenticated session' });
      return;
    }

    if (!title || !projectId) {
      res.status(400).json({ success: false, message: 'Title and projectId are required' });
      return;
    }

    if (status && !VALID_STATUSES.includes(status)) {
      res.status(400).json({ success: false, message: 'Invalid task status' });
      return;
    }

    if (priority && !VALID_PRIORITIES.includes(priority)) {
      res.status(400).json({ success: false, message: 'Invalid task priority' });
      return;
    }

    const task = new Task({
      title: title.trim(),
      description: description?.trim() || '',
      projectId,
      assignedTo: assignedTo || undefined,
      status: status || 'To Do',
      priority: priority || 'Medium',
      dueDate,
      createdBy,
    });

    await task.save();

    const populated = await Task.findById(task._id)
      .populate('projectId', 'projectName')
      .populate('assignedTo', 'firstName lastName email designation')
      .populate('createdBy', 'firstName lastName email');

    if (assignedTo) {
      await publishToQueue('task_assigned_queue', {
        taskId: task._id,
        taskTitle: task.title,
        assigneeId: assignedTo,
        projectId: task.projectId,
      });
    }

    // Invalidate caches
    await invalidateTag('tasks');

    res.status(201).json({ success: true, message: 'Task created successfully', data: populated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to create task', error: error.message });
  }
};

// ─────────────────────────────────────────────
// PUT /api/tasks/:id
// ─────────────────────────────────────────────
export const updateTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const existingTask = await Task.findById(req.params.id);
    if (!existingTask) {
      res.status(404).json({ success: false, message: 'Task not found' });
      return;
    }

    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (userRole === 'employee') {
      const isAssigned = existingTask.assignedTo?.toString() === userId;
      if (!isAssigned) {
        res.status(403).json({ success: false, message: 'Employees can only update tasks assigned to them' });
        return;
      }

      const allowedEmployeeFields = ['status', 'description'];
      const attemptedFields = Object.keys(req.body);
      const unauthorizedFields = attemptedFields.filter(f => !allowedEmployeeFields.includes(f));
      if (unauthorizedFields.length > 0) {
        res.status(403).json({
          success: false,
          message: `Employees cannot modify: ${unauthorizedFields.join(', ')}`,
        });
        return;
      }
    }

    const allowedFields = ['title', 'description', 'status', 'priority', 'dueDate', 'assignedTo', 'projectId'];
    const updateData: any = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    if (updateData.status && !VALID_STATUSES.includes(updateData.status)) {
      res.status(400).json({ success: false, message: 'Invalid task status' });
      return;
    }

    if (updateData.priority && !VALID_PRIORITIES.includes(updateData.priority)) {
      res.status(400).json({ success: false, message: 'Invalid task priority' });
      return;
    }

    const isStatusChanged = updateData.status && existingTask.status !== updateData.status;
    const oldStatus = existingTask.status;

    const updated = await Task.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    )
      .populate('projectId', 'projectName')
      .populate('assignedTo', 'firstName lastName email designation')
      .populate('createdBy', 'firstName lastName email');

    if (!updated) {
      res.status(404).json({ success: false, message: 'Task not found' });
      return;
    }

    if (updateData.assignedTo && updateData.assignedTo !== existingTask.assignedTo?.toString()) {
      await publishToQueue('task_assigned_queue', {
        taskId: updated._id,
        taskTitle: updated.title,
        assigneeId: updateData.assignedTo,
        projectId: updated.projectId,
      });
    }

    if (isStatusChanged && updated.createdBy) {
      const assigneeName = updated.assignedTo
        ? `${(updated.assignedTo as any).firstName} ${(updated.assignedTo as any).lastName}`
        : 'An employee';

      await publishToQueue('task_status_updated_queue', {
        taskId: updated._id,
        taskTitle: updated.title,
        oldStatus,
        newStatus: updated.status,
        assigneeName,
        creatorEmail: (updated.createdBy as any).email,
        creatorName: (updated.createdBy as any).firstName,
      });
    }

    // Invalidate caches
    await invalidateTag('tasks');

    res.status(200).json({ success: true, message: 'Task updated successfully', data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to update task', error: error.message });
  }
};

// ─────────────────────────────────────────────
// DELETE /api/tasks/:id
// ─────────────────────────────────────────────
export const deleteTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userRole = req.user?.role;
    if (userRole === 'employee') {
      res.status(403).json({ success: false, message: 'Employees are not authorized to delete tasks' });
      return;
    }

    const deleted = await Task.findByIdAndDelete(req.params.id);
    if (!deleted) {
      res.status(404).json({ success: false, message: 'Task not found' });
      return;
    }

    // Invalidate caches
    await invalidateTag('tasks');

    res.status(200).json({ success: true, message: 'Task deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to delete task', error: error.message });
  }
};

// ─────────────────────────────────────────────
// GET /api/tasks/:id/comments
// ─────────────────────────────────────────────
export const getTaskComments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const comments = await TaskComment.find({ taskId: id })
      .populate('senderId', 'firstName lastName email designation avatar role')
      .sort({ createdAt: 1, _id: 1 });
    res.status(200).json({ success: true, data: comments });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch comments', error: error.message });
  }
};

// ─────────────────────────────────────────────
// POST /api/tasks/:id/comments
// ─────────────────────────────────────────────
export const createTaskComment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const senderId = req.user?.id;

    if (!senderId) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      res.status(400).json({ success: false, message: 'Comment content is required' });
      return;
    }

    const comment = new TaskComment({
      taskId: id,
      senderId,
      content: content.trim(),
    });

    await comment.save();

    const populated = await TaskComment.findById(comment._id)
      .populate('senderId', 'firstName lastName email designation avatar role');

    const task = await Task.findById(id);
    if (task) {
      const otherUserId = String(task.assignedTo) === String(senderId) ? task.createdBy : task.assignedTo;
      if (otherUserId && String(otherUserId) !== String(senderId)) {
        const senderName = populated && populated.senderId
          ? `${(populated.senderId as any).firstName} ${(populated.senderId as any).lastName}`
          : 'Someone';

        await Notification.create({
          userId: otherUserId,
          title: `New comment on: ${task.title}`,
          message: `${senderName} commented: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`,
          type: 'task',
          isRead: false,
        });
      }
    }

    try {
      const io = getIO();
      io.to(`task_${id}`).emit('new_comment', populated);
    } catch (err: any) {
      // socket fallback
    }

    res.status(201).json({ success: true, data: populated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to create comment', error: error.message });
  }
};
