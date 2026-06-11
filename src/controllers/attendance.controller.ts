import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import Attendance from '../models/attendance.model';
import SystemConfig from '../models/systemConfig.model';

// @desc    Log a check-in event (Office or Remote)
// @route   POST /api/attendance/clock-in
// @access  Private
export const clockIn = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { type, coordinates, distanceMeters } = req.body;

    // Remote Present check-ins require Admin approval
    const status = type === 'Remote Present' ? 'Pending' : 'Approved';

    const attendance = await Attendance.create({
      user: userId,
      type: type || 'Office Present',
      coordinates: coordinates || 'N/A',
      distanceMeters: distanceMeters !== undefined ? distanceMeters : 0,
      status,
      timestamp: new Date(),
    });

    res.status(201).json({
      success: true,
      data: attendance,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error logging clock-in',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// @desc    Log a check-out event
// @route   POST /api/attendance/clock-out
// @access  Private
export const clockOut = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { coordinates } = req.body;

    const attendance = await Attendance.create({
      user: userId,
      type: 'Clocked Out',
      coordinates: coordinates || 'N/A',
      distanceMeters: 0,
      timestamp: new Date(),
    });

    res.status(201).json({
      success: true,
      data: attendance,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error logging clock-out',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// @desc    Get current user's attendance log history
// @route   GET /api/attendance/history
// @access  Private
export const getMyAttendanceHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const history = await Attendance.find({ user: userId })
      .sort({ timestamp: -1 })
      .limit(20);

    res.status(200).json({
      success: true,
      data: history,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching history logs',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// @desc    Get all users' attendance logs (Admin Only)
// @route   GET /api/attendance/all
// @access  Private/Admin
export const getAllAttendance = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const list = await Attendance.find({})
      .populate('user', 'firstName lastName designation email role')
      .sort({ timestamp: -1 });

    res.status(200).json({
      success: true,
      data: list,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching all attendance records',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// @desc    Get specific user's attendance history
// @route   GET /api/attendance/user/:userId
// @access  Private
export const getUserAttendanceHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    // Ensure Admin can see any user, but Managers/Employees can only see their own
    if (req.user?.role !== 'admin' && req.user?.id !== userId) {
      res.status(403).json({ success: false, message: 'Access denied to this user\'s attendance logs.' });
      return;
    }

    const history = await Attendance.find({ user: userId })
      .sort({ timestamp: -1 });

    res.status(200).json({
      success: true,
      data: history,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching history logs for specific user',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// @desc    Get all pending remote check-in requests (Admin Only)
// @route   GET /api/attendance/pending
// @access  Private/Admin
export const getPendingApprovals = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const pending = await Attendance.find({ status: 'Pending' })
      .populate('user', 'firstName lastName designation email role')
      .sort({ timestamp: -1 });

    res.status(200).json({
      success: true,
      data: pending,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching pending approvals',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// @desc    Approve a specific pending check-in (Admin Only)
// @route   PUT /api/attendance/approve/:id
// @access  Private/Admin
export const approveAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const record = await Attendance.findByIdAndUpdate(id, { status: 'Approved' }, { new: true });
    if (!record) {
      res.status(404).json({ success: false, message: 'Attendance record not found' });
      return;
    }
    res.status(200).json({
      success: true,
      data: record,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error approving attendance record',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// @desc    Reject a specific pending check-in (Admin Only)
// @route   PUT /api/attendance/reject/:id
// @access  Private/Admin
export const rejectAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const record = await Attendance.findByIdAndUpdate(id, { status: 'Rejected' }, { new: true });
    if (!record) {
      res.status(404).json({ success: false, message: 'Attendance record not found' });
      return;
    }
    res.status(200).json({
      success: true,
      data: record,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error rejecting attendance record',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// @desc    Get Office Coordinates config
// @route   GET /api/attendance/office-coords
// @access  Private
export const getOfficeCoords = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const config = await SystemConfig.findOne({ key: 'office_coords' });
    if (!config) {
      res.status(200).json({ success: true, lat: 17.443500, lng: 78.385000 });
      return;
    }
    res.status(200).json({ success: true, ...config.value });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching office coordinates',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// @desc    Update Office Coordinates config
// @route   PUT /api/attendance/office-coords
// @access  Private/Admin
export const updateOfficeCoords = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { lat, lng } = req.body;
    if (lat === undefined || lng === undefined) {
      res.status(400).json({ success: false, message: 'Latitude and Longitude are required' });
      return;
    }

    await SystemConfig.findOneAndUpdate(
      { key: 'office_coords' },
      { value: { lat: Number(lat), lng: Number(lng) } },
      { upsert: true, new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Office coordinates updated successfully',
      lat: Number(lat),
      lng: Number(lng),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating office coordinates',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
