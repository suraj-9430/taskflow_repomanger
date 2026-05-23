import mongoose, { Document, Schema } from 'mongoose';

export interface IProject extends Document {
  projectId: string;
  projectName: string;
  description: string;
  startDate: Date;
  deadline: Date;
  status: 'In Progress' | 'Completed' | 'On Hold';
  priority: 'Low' | 'Medium' | 'High';
  progress: number;
  assignees: mongoose.Types.ObjectId[];
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema<IProject>(
  {
    projectId: {
      type: String,
      unique: true,
    },
    projectName: {
      type: String,
      required: [true, 'Project Name is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    startDate: {
      type: Date,
      required: [true, 'Start Date is required'],
    },
    deadline: {
      type: Date,
      required: [true, 'Deadline is required'],
    },
    status: {
      type: String,
      enum: ['In Progress', 'Completed', 'On Hold'],
      default: 'In Progress',
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High'],
      default: 'Medium',
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    assignees: [
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

projectSchema.pre('validate', async function (next) {
  if (this.isNew && !this.projectId) {
    const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.projectId = `PRJ-${new Date().getFullYear()}-${randomStr}`;
  }
  next();
});

const Project = mongoose.model<IProject>('Project', projectSchema);

export default Project;
