import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface ILiveStreamGuestMessage extends Document {
  live_stream_id: Types.ObjectId;
  from_user_id: Types.ObjectId;
  body: string;
  created_at: Date;
}

const schema = new Schema<ILiveStreamGuestMessage>(
  {
    live_stream_id: { type: Schema.Types.ObjectId, required: true, ref: 'LiveStream' },
    from_user_id: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    body: { type: String, required: true, trim: true, maxlength: 500 },
    created_at: { type: Date, required: true, default: Date.now },
  },
  { timestamps: false },
);

schema.index({ live_stream_id: 1, created_at: -1 });
schema.index({ live_stream_id: 1, from_user_id: 1, created_at: -1 });

export const LiveStreamGuestMessage = mongoose.model<ILiveStreamGuestMessage>(
  'LiveStreamGuestMessage',
  schema,
  'live_stream_guest_messages',
);
