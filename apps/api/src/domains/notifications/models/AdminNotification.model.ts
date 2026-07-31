import mongoose, { Schema, type Document, type Types } from 'mongoose';

/** A broadcast sent by an admin — the message content itself, not per-user delivery state. */
export interface IAdminNotification extends Document {
  title: string;
  message: string;
  target_type: 'all' | 'specific';
  target_user_ids?: Types.ObjectId[];
  created_by: Types.ObjectId;
  sent_at: Date;
  recipient_count: number;
  push_sent_count: number;
  push_failed_count: number;
}

const schema = new Schema<IAdminNotification>(
  {
    title: { type: String, required: true },
    message: { type: String, required: true },
    target_type: { type: String, enum: ['all', 'specific'], required: true },
    target_user_ids: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    created_by: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    sent_at: { type: Date, default: Date.now },
    recipient_count: { type: Number, default: 0 },
    push_sent_count: { type: Number, default: 0 },
    push_failed_count: { type: Number, default: 0 },
  },
  { timestamps: false },
);

schema.index({ sent_at: -1 });

export const AdminNotification = mongoose.model<IAdminNotification>(
  'AdminNotification',
  schema,
  'admin_notifications',
);
