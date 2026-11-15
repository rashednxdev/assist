import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface ILiveStreamGuest extends Document {
  live_stream_id: Types.ObjectId;
  user_id: Types.ObjectId;
  role: 'host' | 'audience' | 'support';
  /** Browser or app that currently holds this class. A second device is refused while this is fresh. */
  device_id?: string;
  joined_at: Date;
  last_seen_at: Date;
}

const schema = new Schema<ILiveStreamGuest>(
  {
    live_stream_id: { type: Schema.Types.ObjectId, required: true, ref: 'LiveStream' },
    user_id: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    role: { type: String, enum: ['host', 'audience', 'support'], required: true },
    device_id: { type: String, trim: true },
    joined_at: { type: Date, required: true, default: Date.now },
    last_seen_at: { type: Date, required: true, default: Date.now },
  },
  { timestamps: false },
);

schema.index({ live_stream_id: 1, user_id: 1 }, { unique: true });
schema.index({ live_stream_id: 1, last_seen_at: -1 });

export const LiveStreamGuest = mongoose.model<ILiveStreamGuest>(
  'LiveStreamGuest',
  schema,
  'live_stream_guests',
);
