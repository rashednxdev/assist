import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IUserActivityLog extends Document {
  user_id: Types.ObjectId;
  action: string;
  description?: string;
  ip_address: string;
  user_agent?: string;
  metadata?: Record<string, unknown>;
  created_at: Date;
}

const schema = new Schema<IUserActivityLog>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true },
    description: { type: String },
    ip_address: { type: String, required: true },
    user_agent: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } },
);

schema.index({ user_id: 1, created_at: -1 });

export const UserActivityLog = mongoose.model<IUserActivityLog>(
  'UserActivityLog',
  schema,
  'user_activity_log',
);

export async function logUserActivity(params: {
  userId: string;
  action: string;
  description?: string;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}) {
  await UserActivityLog.create({
    user_id: new mongoose.Types.ObjectId(params.userId),
    action: params.action,
    description: params.description,
    ip_address: params.ip ?? '0.0.0.0',
    user_agent: params.userAgent,
    metadata: params.metadata,
  });
}
