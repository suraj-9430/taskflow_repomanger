import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import Notification from '../models/notification.model';

// @desc    Get user notifications
// @route   GET /api/notifications
// @access  Private
export const getUserNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    let notifications = await Notification.find({ userId }).sort({ createdAt: -1 });

    if (notifications.length === 0) {
      const now = new Date();
      const initialNotifications = [
        {
          userId,
          title: 'Welcome to TaskFlow Pro!',
          message: 'Explore your dark-industrial dashboard, track project pipelines, and configure custom system preferences.',
          type: 'system',
          isRead: false,
          createdAt: new Date(now.getTime() - 5 * 60000) // 5 mins ago
        },
        {
          userId,
          title: 'New Task Assigned',
          message: 'You have been assigned to the task "Implement OAuth2 Authentication" in Project TaskFlow Pro.',
          type: 'task',
          isRead: false,
          createdAt: new Date(now.getTime() - 30 * 60000) // 30 mins ago
        },
        {
          userId,
          title: 'Project Deadline Approaching',
          message: 'The deadline for project "Trade Finance Platform" is approaching in 2 days. Please review pending tasks.',
          type: 'project',
          isRead: false,
          createdAt: new Date(now.getTime() - 120 * 60000) // 2 hours ago
        },
        {
          userId,
          title: 'Critical Server Alert',
          message: 'Database memory usage exceeded 85% during scheduled backups. System recovered successfully.',
          type: 'alert',
          isRead: true,
          createdAt: new Date(now.getTime() - 360 * 60000) // 6 hours ago
        }
      ];

      await Notification.insertMany(initialNotifications);
      notifications = await Notification.find({ userId }).sort({ createdAt: -1 });
    }

    res.status(200).json({
      success: true,
      count: notifications.length,
      data: notifications,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching notifications',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// @desc    Create a new notification (for testing/integration)
// @route   POST /api/notifications
// @access  Private
export const createNotification = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { title, message, type } = req.body;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    if (!title || !message) {
      res.status(400).json({ success: false, message: 'Please provide title and message' });
      return;
    }

    const notification = await Notification.create({
      userId,
      title,
      message,
      type: type || 'system',
      isRead: false,
    });

    res.status(201).json({
      success: true,
      data: notification,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating notification',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// @desc    Mark a specific notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
export const markAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const notificationId = req.params.id;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      res.status(404).json({ success: false, message: 'Notification not found' });
      return;
    }

    res.status(200).json({
      success: true,
      data: notification,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating notification status',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// @desc    Mark all user notifications as read
// @route   PUT /api/notifications/mark-all-read
// @access  Private
export const markAllRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    await Notification.updateMany({ userId, isRead: false }, { isRead: true });

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error marking all notifications as read',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// @desc    Delete a notification
// @route   DELETE /api/notifications/:id
// @access  Private
export const deleteNotification = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const notificationId = req.params.id;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const notification = await Notification.findOneAndDelete({ _id: notificationId, userId });

    if (!notification) {
      res.status(404).json({ success: false, message: 'Notification not found' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting notification',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
