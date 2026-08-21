import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface ILiveStreamInvite extends Document {
  live_stream_id: Types.ObjectId;
  user_id: Types.ObjectId;
  invited_by: Types.ObjectId;
  created_at: Date;
  updated_at: Date;
}

const schema = new Schema<ILiveStreamInvite>(
  {
    live_stream_id: { type: Schema.Types.ObjectId, required: true, ref: 'LiveStream' },
    user_id: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    invited_by: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

schema.index({ live_stream_id: 1, user_id: 1 }, { unique: true });
schema.index({ user_id: 1 });

export const LiveStreamInvite = mongoose.model<ILiveStreamInvite>(
  'LiveStreamInvite',
  schema,
  'live_stream_invites',
);
