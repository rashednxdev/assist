import mongoose, { Schema, type Document, type Types } from 'mongoose';
import type { CommunityReportReason } from '@ibas/shared-types';

export interface ICommunityReport extends Document {
  target_type: 'thread' | 'answer';
  target_id: Types.ObjectId;
  thread_id: Types.ObjectId;
  reporter_id: Types.ObjectId;
  reason: CommunityReportReason;
  note?: string;
  status: 'open' | 'resolved';
  resolution?: 'dismissed' | 'hidden';
  resolved_by?: Types.ObjectId;
  resolved_at?: Date;
  created_at: Date;
  updated_at: Date;
}

const schema = new Schema<ICommunityReport>(
  {
    target_type: { type: String, enum: ['thread', 'answer'], required: true },
    target_id: { type: Schema.Types.ObjectId, required: true },
    thread_id: { type: Schema.Types.ObjectId, ref: 'CommunityThread', required: true },
    reporter_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, enum: ['spam', 'abusive', 'off_topic', 'wrong_info', 'other'], required: true },
    note: { type: String },
    status: { type: String, enum: ['open', 'resolved'], default: 'open' },
    resolution: { type: String, enum: ['dismissed', 'hidden'] },
    resolved_by: { type: Schema.Types.ObjectId, ref: 'User' },
    resolved_at: { type: Date },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

schema.index({ status: 1, created_at: -1 });
schema.index({ target_type: 1, target_id: 1, reporter_id: 1 }, { unique: true });

export const CommunityReport = mongoose.model<ICommunityReport>('CommunityReport', schema, 'community_reports');
