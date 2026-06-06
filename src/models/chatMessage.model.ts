import mongoose, { Schema, Document } from 'mongoose';

export interface IChatMessage extends Document {
  channelType: 'project' | 'task';
  targetId: mongoose.Types.ObjectId;
  sender: mongoose.Types.ObjectId;
  content: string;
  mentions: mongoose.Types.ObjectId[];
  quickReply?: boolean;
  createdAt: Date;
}

const ChatMessageSchema = new Schema<IChatMessage>({
  channelType: {
    type: String,
    enum: ['project', 'task'],
    required: true
  },
  targetId: {
    type: Schema.Types.ObjectId,
    required: true
  },
  sender: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true
  },
  mentions: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  quickReply: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

export default mongoose.model<IChatMessage>('ChatMessage', ChatMessageSchema);
