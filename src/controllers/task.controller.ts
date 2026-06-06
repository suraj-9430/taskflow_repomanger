import { Request, Response } from 'express';
import Task from '../models/task.model';
import { publishToQueue } from '../utils/rabbitmq';
import TaskComment from '../models/taskComment.model';
import Notification from '../models/notification.model';
import { getIO } from '../utils/socket';
import mongoose from 'mongoose';

// ─────────────────────────────────────────────
// GET /api/tasks  — fetch all tasks
// ─────────────────────────────────────────────
export const getAllTasks = async (req: Request, res: Response): Promise<void> => {
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

    if (search && typeof search === 'string') {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { taskId: { $regex: search, $options: 'i' } },
      ];
    }

    if (status && typeof status === 'string' && status !== 'all') {
      query.status = status;
    }

    if (priority && typeof priority === 'string' && priority !== 'all') {
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

    const tasks = await Task.find(query)
      .populate('projectId', 'projectName')
      .populate('assignedTo', 'firstName lastName email designation')
      .populate('createdBy', 'firstName lastName email')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: tasks });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch tasks', error: error.message });
  }
};

export const bulkUpdateTasks = async (req: Request, res: Response): Promise<void> => {
  try {
    const { taskIds, updates } = req.body;

    if (!Array.isArray(taskIds) || taskIds.length === 0 || !updates || typeof updates !== 'object') {
      res.status(400).json({ success: false, message: 'taskIds and updates are required' });
      return;
    }

    const allowedUpdates = ['status', 'priority', 'assignedTo', 'projectId', 'dueDate'];
    const sanitizedUpdates = Object.fromEntries(
      Object.entries(updates).filter(([key, value]) => allowedUpdates.includes(key) && value !== undefined && value !== '')
    );

    if (Object.keys(sanitizedUpdates).length === 0) {
      res.status(400).json({ success: false, message: 'No valid bulk update fields were provided' });
      return;
    }

    await Task.updateMany({ _id: { $in: taskIds } }, { $set: sanitizedUpdates }, { runValidators: true });

    const tasks = await Task.find({ _id: { $in: taskIds } })
      .populate('projectId', 'projectName')
      .populate('assignedTo', 'firstName lastName email designation')
      .populate('createdBy', 'firstName lastName email')
      .sort({ updatedAt: -1 });

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

    res.status(200).json({
      success: true,
      message: `${tasks.length} tasks updated successfully`,
      data: tasks,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to bulk update tasks', error: error.message });
  }
};

export const bulkDeleteTasks = async (req: Request, res: Response): Promise<void> => {
  try {
    const { taskIds } = req.body;

    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      res.status(400).json({ success: false, message: 'taskIds are required' });
      return;
    }

    const result = await Task.deleteMany({ _id: { $in: taskIds } });

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
export const getTaskById = async (req: Request, res: Response): Promise<void> => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('projectId', 'projectName')
      .populate('assignedTo', 'firstName lastName email designation')
      .populate('createdBy', 'firstName lastName email');

    if (!task) {
      res.status(404).json({ success: false, message: 'Task not found' });
      return;
    }
    res.status(200).json({ success: true, data: task });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch task', error: error.message });
  }
};

// ─────────────────────────────────────────────
// POST /api/tasks  — create new task
// ─────────────────────────────────────────────
export const createTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      title,
      description,
      projectId,
      assignedTo,
      status,
      priority,
      dueDate,
      createdBy,
    } = req.body;

    if (!title || !projectId || !createdBy) {
      res.status(400).json({ success: false, message: 'Missing required fields' });
      return;
    }

    const task = new Task({
      title,
      description,
      projectId,
      assignedTo,
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

    // Fire event to RabbitMQ for email notification
    if (assignedTo) {
      await publishToQueue('task_assigned_queue', {
        taskId: task._id,
        taskTitle: task.title,
        assigneeId: assignedTo,
        projectId: task.projectId,
      });
    }

    res.status(201).json({ success: true, message: 'Task created successfully', data: populated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to create task', error: error.message });
  }
};

// ─────────────────────────────────────────────
// PUT /api/tasks/:id  — update task
// ─────────────────────────────────────────────
export const updateTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const existingTask = await Task.findById(req.params.id);
    if (!existingTask) {
      res.status(404).json({ success: false, message: 'Task not found' });
      return;
    }

    const isStatusChanged = req.body.status && existingTask.status !== req.body.status;
    const oldStatus = existingTask.status;

    const updated = await Task.findByIdAndUpdate(
      req.params.id,
      { ...req.body },
      { new: true, runValidators: true }
    )
      .populate('projectId', 'projectName')
      .populate('assignedTo', 'firstName lastName email designation')
      .populate('createdBy', 'firstName lastName email');

    if (!updated) {
      res.status(404).json({ success: false, message: 'Task not found' });
      return;
    }

    if (req.body.assignedTo) {
      await publishToQueue('task_assigned_queue', {
        taskId: updated._id,
        taskTitle: updated.title,
        assigneeId: req.body.assignedTo,
        projectId: updated.projectId,
      });
    }

    // Notify assigner if task status is updated
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

    res.status(200).json({ success: true, message: 'Task updated successfully', data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to update task', error: error.message });
  }
};

// ─────────────────────────────────────────────
// DELETE /api/tasks/:id
// ─────────────────────────────────────────────
export const deleteTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const deleted = await Task.findByIdAndDelete(req.params.id);
    if (!deleted) {
      res.status(404).json({ success: false, message: 'Task not found' });
      return;
    }
    res.status(200).json({ success: true, message: 'Task deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to delete task', error: error.message });
  }
};

// ─────────────────────────────────────────────
// GET /api/tasks/:id/comments
// ─────────────────────────────────────────────
export const getTaskComments = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const comments = await TaskComment.find({ taskId: id })
      .populate('senderId', 'firstName lastName email designation avatar role')
      .sort({ createdAt: 1 });
    res.status(200).json({ success: true, data: comments });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch comments', error: error.message });
  }
};

// ─────────────────────────────────────────────
// POST /api/tasks/:id/comments
// ─────────────────────────────────────────────
export const createTaskComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { senderId, content } = req.body;

    if (!senderId || !content) {
      res.status(400).json({ success: false, message: 'senderId and content are required' });
      return;
    }

    const comment = new TaskComment({
      taskId: id,
      senderId,
      content,
    });

    await comment.save();

    const populated = await TaskComment.findById(comment._id)
      .populate('senderId', 'firstName lastName email designation avatar role');

    // Automatically trigger notification for the other active user on the task
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

    // Emit Socket.IO event to all clients in the task's room
    try {
      const io = getIO();
      io.to(`task_${id}`).emit('new_comment', populated);
      console.log(`📡 Broadcasted new comment to room: task_${id}`);
    } catch (err: any) {
      console.warn('Socket emit warning (Socket may not be initialized yet):', err.message);
    }

    res.status(201).json({ success: true, data: populated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to create comment', error: error.message });
  }
};
