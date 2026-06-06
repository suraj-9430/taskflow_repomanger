import mongoose, { Schema, Document } from 'mongoose';

export interface IApproval extends Document {
  type: 'Leave' | 'Attendance' | 'Expense' | 'Task Closure' | 'Overtime' | 'Shift Swap' | 'Document';
  requester: mongoose.Types.ObjectId;
  details: {
    amount?: number;
    description?: string;
    documentUrl?: string;
    targetDate?: Date;
    taskId?: mongoose.Types.ObjectId;
    shiftSwapWith?: mongoose.Types.ObjectId;
    hoursRequested?: number;
  };
  status: 'Pending' | 'Approved' | 'Rejected';
  approver?: mongoose.Types.ObjectId;
  remarks?: string;
  appliedAt: Date;
}

const ApprovalSchema = new Schema<IApproval>({
  type: {
    type: String,
    enum: ['Leave', 'Attendance', 'Expense', 'Task Closure', 'Overtime', 'Shift Swap', 'Document'],
    required: true
  },
  requester: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  details: {
    amount: Number,
    description: String,
    documentUrl: String,
    targetDate: Date,
    taskId: { type: Schema.Types.ObjectId, ref: 'Task' },
    shiftSwapWith: { type: Schema.Types.ObjectId, ref: 'User' },
    hoursRequested: Number
  },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Pending'
  },
  approver: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  remarks: String,
  appliedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

export default mongoose.model<IApproval>('Approval', ApprovalSchema);
