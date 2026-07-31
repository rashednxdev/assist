import mongoose, { Schema, type Document, type Types } from 'mongoose';

/** Per-user delivery/read marker for an AdminNotification — kept separate from the message
 * content itself so an "all users" broadcast doesn't duplicate title/message per recipient. */
export interface INotificationRecipient extends Document {
  notification_id: Types.ObjectId;
  user_id: Types.ObjectId;
  is_read: boolean;
  read_at?: Date;
  created_at: Date;
}

const schema = new Schema<INotificationRecipient>(
  {
    notification_id: { type: Schema.Types.ObjectId, required: true, ref: 'AdminNotification' },
    user_id: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    is_read: { type: Boolean, default: false },
    read_at: { type: Date },
    created_at: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

schema.index({ user_id: 1, is_read: 1, created_at: -1 });
schema.index({ notification_id: 1, user_id: 1 }, { unique: true });

export const NotificationRecipient = mongoose.model<INotificationRecipient>(
  'NotificationRecipient',
  schema,
  'notification_recipients',
);
