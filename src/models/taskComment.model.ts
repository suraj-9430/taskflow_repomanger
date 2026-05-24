import mongoose, { Document, Schema } from 'mongoose';

export interface ITaskComment extends Document {
  taskId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

const taskCommentSchema = new Schema<ITaskComment>(
  {
    taskId: {
      type: Schema.Types.ObjectId,
      ref: 'Task',
      required: [true, 'Task ID is required'],
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Sender ID is required'],
    },
    content: {
      type: String,
      required: [true, 'Comment content is required'],
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for faster lookups
taskCommentSchema.index({ taskId: 1, createdAt: 1 });

const TaskComment = mongoose.model<ITaskComment>('TaskComment', taskCommentSchema);

export default TaskComment;
