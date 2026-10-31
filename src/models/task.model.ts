import mongoose, { Document, Schema } from 'mongoose';

export interface ITask extends Document {
  taskId: string;
  title: string;
  description: string;
  projectId: mongoose.Types.ObjectId;
  assignedTo: mongoose.Types.ObjectId;
  status: 'To Do' | 'In Progress' | 'Completed';
  priority: 'Low' | 'Medium' | 'High';
  dueDate: Date;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const taskSchema = new Schema<ITask>(
  {
    taskId: {
      type: String,
      unique: true,
    },
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Project is required'],
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    status: {
      type: String,
      enum: ['To Do', 'In Progress', 'Completed'],
      default: 'To Do',
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High'],
      default: 'Medium',
    },
    dueDate: {
      type: Date,
    },
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

// Compound indexes optimized for query and sort patterns (PDF Section 8)
taskSchema.index({ projectId: 1, status: 1, dueDate: 1 });
taskSchema.index({ assignedTo: 1, status: 1, createdAt: -1 });
taskSchema.index({ createdAt: -1, _id: -1 });

taskSchema.pre('validate', async function (next) {
  if (this.isNew && !this.taskId) {
    const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.taskId = `TSK-${new Date().getFullYear()}-${randomStr}`;
  }
  next();
});

const Task = mongoose.model<ITask>('Task', taskSchema);

export default Task;
