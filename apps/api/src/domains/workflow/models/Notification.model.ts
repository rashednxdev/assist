import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface INotification extends Document {
  recipient_id: Types.ObjectId;
  run_id: Types.ObjectId;
  step_id?: Types.ObjectId;
  type: 'handoff' | 'reminder' | 'alert' | 'info';
  title: string;
  message: string;
  is_read: boolean;
  read_at?: Date;
  created_at: Date;
}

const schema = new Schema<INotification>(
  {
    recipient_id: { type: Schema.Types.ObjectId, required: true },
    run_id: { type: Schema.Types.ObjectId, required: true },
    step_id: { type: Schema.Types.ObjectId },
    type: { type: String, enum: ['handoff', 'reminder', 'alert', 'info'], required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    is_read: { type: Boolean, default: false },
    read_at: { type: Date },
    created_at: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

schema.index({ recipient_id: 1, is_read: 1, created_at: -1 });
schema.index({ created_at: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const Notification = mongoose.model<INotification>('Notification', schema, 'notifications');
