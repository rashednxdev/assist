import mongoose, { Schema, type Document, type Types } from 'mongoose';

/** One upvote per user per discussion or answer. */
export interface ICommunityVote extends Document {
  user_id: Types.ObjectId;
  target_type: 'thread' | 'answer';
  target_id: Types.ObjectId;
  thread_id: Types.ObjectId;
  created_at: Date;
}

const schema = new Schema<ICommunityVote>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    target_type: { type: String, enum: ['thread', 'answer'], required: true },
    target_id: { type: Schema.Types.ObjectId, required: true },
    thread_id: { type: Schema.Types.ObjectId, ref: 'CommunityThread', required: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } },
);

schema.index({ user_id: 1, target_type: 1, target_id: 1 }, { unique: true });
schema.index({ thread_id: 1, user_id: 1 });

export const CommunityVote = mongoose.model<ICommunityVote>('CommunityVote', schema, 'community_votes');
