import mongoose, { Schema, type Document, type Types } from 'mongoose';

/** Followers get notified about new answers; also used as bookmarks. */
export interface ICommunityFollow extends Document {
  user_id: Types.ObjectId;
  thread_id: Types.ObjectId;
  created_at: Date;
}

const schema = new Schema<ICommunityFollow>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    thread_id: { type: Schema.Types.ObjectId, ref: 'CommunityThread', required: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } },
);

schema.index({ user_id: 1, thread_id: 1 }, { unique: true });
schema.index({ thread_id: 1 });

export const CommunityFollow = mongoose.model<ICommunityFollow>('CommunityFollow', schema, 'community_follows');
