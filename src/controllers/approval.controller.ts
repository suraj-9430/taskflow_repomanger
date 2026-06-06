import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import Approval from '../models/approval.model';

export const createApprovalRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const requester = req.user?.id;
    if (!requester) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { type, details } = req.body;
    if (!type || !details) {
      res.status(400).json({ success: false, message: 'Missing type or details' });
      return;
    }

    const approval = new Approval({
      type,
      requester,
      details,
      status: 'Pending'
    });

    await approval.save();
    const populated = await Approval.findById(approval._id).populate('requester', 'firstName lastName email');

    res.status(201).json({ success: true, data: populated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getApprovals = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const role = req.user?.role;
    const userId = req.user?.id;

    let approvals;
    if (role === 'admin' || role === 'manager') {
      approvals = await Approval.find()
        .populate('requester', 'firstName lastName email designation')
        .sort({ createdAt: -1 });
    } else {
      approvals = await Approval.find({ requester: userId })
        .populate('requester', 'firstName lastName email designation')
        .sort({ createdAt: -1 });
    }

    res.status(200).json({ success: true, data: approvals });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateApprovalStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const approver = req.user?.id;
    const { id } = req.params;
    const { status, remarks } = req.body;

    if (!['Approved', 'Rejected'].includes(status)) {
      res.status(400).json({ success: false, message: 'Invalid status' });
      return;
    }

    const approval = await Approval.findByIdAndUpdate(
      id,
      { status, approver, remarks },
      { new: true }
    ).populate('requester', 'firstName lastName email');

    if (!approval) {
      res.status(404).json({ success: false, message: 'Approval request not found' });
      return;
    }

    res.status(200).json({ success: true, data: approval });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};
