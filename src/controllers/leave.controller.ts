import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import Leave from '../models/leave.model';
import User from '../models/user.model';
import Notification from '../models/notification.model';
import { emitToUser } from '../utils/socket';

// @desc    Apply for leave
// @route   POST /api/leaves
// @access  Private (Employee/Manager)
export const applyLeave = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { leaveType, startDate, endDate, reason } = req.body;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    if (!leaveType || !startDate || !endDate || !reason) {
      res.status(400).json({ success: false, message: 'Please provide all required fields' });
      return;
    }

    // Calculate days requested
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (end < start) {
      res.status(400).json({ success: false, message: 'End date cannot be before start date' });
      return;
    }

    const timeDiff = end.getTime() - start.getTime();
    const daysRequested = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1; // +1 to include both start and end days

    // Check user balance
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const currentBalance = user.leaveBalance[leaveType as 'sick' | 'casual' | 'earned'];
    if (currentBalance < daysRequested) {
      res.status(400).json({ 
        success: false, 
        message: `Insufficient ${leaveType} leave balance. You have ${currentBalance} days, but requested ${daysRequested} days.`
      });
      return;
    }

    // Deduct balance immediately (can be restored if rejected)
    user.leaveBalance[leaveType as 'sick' | 'casual' | 'earned'] -= daysRequested;
    await user.save();

    const leave = await Leave.create({
      userId,
      leaveType,
      startDate,
      endDate,
      reason,
      status: 'Pending',
    });

    res.status(201).json({
      success: true,
      data: leave,
      message: 'Leave application submitted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error applying for leave',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// @desc    Get user's leaves
// @route   GET /api/leaves/my-leaves
// @access  Private
export const getMyLeaves = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const leaves = await Leave.find({ userId }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: leaves,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching leaves',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// @desc    Get pending leaves for approval
// @route   GET /api/leaves/pending
// @access  Private (Admin/Manager)
export const getPendingLeaves = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const leaves = await Leave.find({ status: 'Pending' })
      .populate('userId', 'firstName lastName email designation')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: leaves,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching pending leaves',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// @desc    Approve leave
// @route   PUT /api/leaves/:id/approve
// @access  Private (Admin/Manager)
export const approveLeave = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const leaveId = req.params.id;
    
    const leave = await Leave.findById(leaveId);
    if (!leave) {
      res.status(404).json({ success: false, message: 'Leave request not found' });
      return;
    }

    if (leave.status !== 'Pending') {
      res.status(400).json({ success: false, message: 'Leave request is already processed' });
      return;
    }

    leave.status = 'Approved';
    await leave.save();

    // Create notification
    const notification = await Notification.create({
      userId: leave.userId,
      title: 'Leave Approved',
      message: `Your ${leave.leaveType} leave request from ${new Date(leave.startDate).toLocaleDateString()} to ${new Date(leave.endDate).toLocaleDateString()} has been approved.`,
      type: 'system',
      isRead: false,
    });
    emitToUser(leave.userId.toString(), 'new_notification', notification);

    res.status(200).json({
      success: true,
      data: leave,
      message: 'Leave approved successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error approving leave',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// @desc    Reject leave
// @route   PUT /api/leaves/:id/reject
// @access  Private (Admin/Manager)
export const rejectLeave = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const leaveId = req.params.id;
    
    const leave = await Leave.findById(leaveId);
    if (!leave) {
      res.status(404).json({ success: false, message: 'Leave request not found' });
      return;
    }

    if (leave.status !== 'Pending') {
      res.status(400).json({ success: false, message: 'Leave request is already processed' });
      return;
    }

    leave.status = 'Rejected';
    await leave.save();

    // Restore balance
    const start = new Date(leave.startDate);
    const end = new Date(leave.endDate);
    const timeDiff = end.getTime() - start.getTime();
    const daysRequested = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;

    const user = await User.findById(leave.userId);
    if (user) {
      user.leaveBalance[leave.leaveType as 'sick' | 'casual' | 'earned'] += daysRequested;
      await user.save();
    }

    // Create notification
    const notification = await Notification.create({
      userId: leave.userId,
      title: 'Leave Rejected',
      message: `Your ${leave.leaveType} leave request from ${new Date(leave.startDate).toLocaleDateString()} to ${new Date(leave.endDate).toLocaleDateString()} was rejected. Your balance has been restored.`,
      type: 'alert',
      isRead: false,
    });
    emitToUser(leave.userId.toString(), 'new_notification', notification);

    res.status(200).json({
      success: true,
      data: leave,
      message: 'Leave rejected successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error rejecting leave',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// @desc    Get leave balance for current user
// @route   GET /api/leaves/balance
// @access  Private
export const getLeaveBalance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const user = await User.findById(userId).select('leaveBalance');
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    res.status(200).json({
      success: true,
      data: user.leaveBalance,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching leave balance',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// @desc    Get all leaves (all employees)
// @route   GET /api/leaves/all
// @access  Private (Admin/Manager)
export const getAllLeaves = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, userId } = req.query;

    const filter: any = {};
    if (status && status !== 'all') {
      filter.status = status;
    }
    if (userId) {
      filter.userId = userId;
    }

    const leaves = await Leave.find(filter)
      .populate('userId', 'firstName lastName email designation role')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: leaves,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching all leaves',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
