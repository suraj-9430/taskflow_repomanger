import { Request, Response } from 'express';
import Task from '../models/task.model';
import { publishToQueue } from '../utils/rabbitmq';
import TaskComment from '../models/taskComment.model';
import Notification from '../models/notification.model';

// ─────────────────────────────────────────────
// GET /api/tasks  — fetch all tasks
// ─────────────────────────────────────────────
export const getAllTasks = async (_req: Request, res: Response): Promise<void> => {
  try {
    const tasks = await Task.find()
      .populate('projectId', 'projectName')
      .populate('assignedTo', 'firstName lastName email designation')
      .populate('createdBy', 'firstName lastName email')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: tasks });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch tasks', error: error.message });
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

    res.status(201).json({ success: true, data: populated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to create comment', error: error.message });
  }
};
