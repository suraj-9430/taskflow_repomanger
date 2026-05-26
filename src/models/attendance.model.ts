import mongoose, { Document, Schema } from 'mongoose';

export interface IAttendance extends Document {
  user: mongoose.Types.ObjectId;
  timestamp: Date;
  type: 'Office Present' | 'Remote Present' | 'Clocked Out';
  coordinates: string;
  distanceMeters: number;
  status: 'Approved' | 'Pending' | 'Rejected';
  createdAt: Date;
  updatedAt: Date;
}

const attendanceSchema = new Schema<IAttendance>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    type: {
      type: String,
      enum: ['Office Present', 'Remote Present', 'Clocked Out'],
      required: [true, 'Attendance type is required'],
    },
    coordinates: {
      type: String,
      required: [true, 'Coordinates are required'],
    },
    distanceMeters: {
      type: Number,
      required: true,
      default: 0,
    },
    status: {
      type: String,
      enum: ['Approved', 'Pending', 'Rejected'],
      default: 'Approved',
    },
  },
  {
    timestamps: true,
  }
);

// Index for query performance on user history
attendanceSchema.index({ user: 1, timestamp: -1 });

const Attendance = mongoose.model<IAttendance>('Attendance', attendanceSchema);

export default Attendance;
