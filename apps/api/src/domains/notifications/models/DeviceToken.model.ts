import mongoose, { Schema, type Document, type Types } from 'mongoose';

/** An Expo push token registered by a mobile device (Android only for now). */
export interface IDeviceToken extends Document {
  user_id: Types.ObjectId;
  device_id: string;
  expo_push_token: string;
  platform: 'android';
  is_active: boolean;
  last_seen_at: Date;
  created_at: Date;
}

const schema = new Schema<IDeviceToken>(
  {
    user_id: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    device_id: { type: String, required: true },
    expo_push_token: { type: String, required: true },
    platform: { type: String, enum: ['android'], required: true, default: 'android' },
    is_active: { type: Boolean, default: true },
    last_seen_at: { type: Date, default: Date.now },
    created_at: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

schema.index({ user_id: 1, is_active: 1 });
schema.index({ expo_push_token: 1 }, { unique: true });
schema.index({ device_id: 1 });

export const DeviceToken = mongoose.model<IDeviceToken>('DeviceToken', schema, 'device_tokens');
