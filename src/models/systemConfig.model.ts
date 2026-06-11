import mongoose, { Document, Schema } from 'mongoose';

export interface ISystemConfig extends Document {
  key: string;
  value: any;
}

const SystemConfigSchema = new Schema<ISystemConfig>({
  key: { type: String, required: true, unique: true },
  value: { type: Schema.Types.Mixed, required: true }
});

export default mongoose.model<ISystemConfig>('SystemConfig', SystemConfigSchema);
