import mongoose, { Document, Schema } from 'mongoose';

export interface IScheduleEvent extends Document {
  title: string;
  description?: string;
  eventType: 'meeting' | 'shift' | 'reminder' | 'review';
  startDate: Date;
  endDate: Date;
  allDay: boolean;
  audience: 'all' | 'admin' | 'manager' | 'employee';
  participants: mongoose.Types.ObjectId[];
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const scheduleEventSchema = new Schema<IScheduleEvent>(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    eventType: {
      type: String,
      enum: ['meeting', 'shift', 'reminder', 'review'],
      default: 'meeting',
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
    },
    allDay: {
      type: Boolean,
      default: false,
    },
    audience: {
      type: String,
      enum: ['all', 'admin', 'manager', 'employee'],
      default: 'all',
    },
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

scheduleEventSchema.index({ startDate: 1, endDate: 1 });

const ScheduleEvent = mongoose.model<IScheduleEvent>('ScheduleEvent', scheduleEventSchema);

export default ScheduleEvent;
