import mongoose, { Document, Schema } from 'mongoose';

export interface IProcessedEvent extends Document {
  eventId: string;
  eventType: string;
  status: 'processing' | 'completed' | 'failed';
  retryCount: number;
  metadata?: Record<string, any>;
  errorMessage?: string;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const processedEventSchema = new Schema<IProcessedEvent>(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['processing', 'completed', 'failed'],
      default: 'processing',
      required: true,
    },
    retryCount: {
      type: Number,
      default: 0,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
    errorMessage: {
      type: String,
    },
    processedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Expire processed event idempotency records after 7 days automatically
processedEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

const ProcessedEvent = mongoose.model<IProcessedEvent>('ProcessedEvent', processedEventSchema);

export default ProcessedEvent;
