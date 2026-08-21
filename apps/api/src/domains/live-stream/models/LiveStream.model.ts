import mongoose, { Schema, type Document, type Types } from 'mongoose';
import type { LiveStreamStatus } from '@ibas/shared-types';

export interface ILiveStream extends Document {
  topic: string;
  details?: string;
  scheduled_at: Date;
  status: LiveStreamStatus;
  /** Agora channel name — stable unique id for the session. */
  channel_name: string;
  host_user_id: Types.ObjectId;
  created_by: Types.ObjectId;
  is_active: boolean;
  started_at?: Date;
  ended_at?: Date;
  created_at: Date;
  updated_at: Date;
}

const schema = new Schema<ILiveStream>(
  {
    topic: { type: String, required: true, trim: true },
    details: { type: String, trim: true },
    scheduled_at: { type: Date, required: true },
    status: {
      type: String,
      enum: ['scheduled', 'live', 'paused', 'ended', 'cancelled'],
      default: 'scheduled',
    },
    channel_name: { type: String, required: true, unique: true },
    host_user_id: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    created_by: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    is_active: { type: Boolean, default: true },
    started_at: { type: Date },
    ended_at: { type: Date },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

schema.index({ scheduled_at: -1, is_active: 1 });
schema.index({ status: 1, is_active: 1 });

export const LiveStream = mongoose.model<ILiveStream>('LiveStream', schema, 'live_streams');
