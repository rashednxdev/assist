import mongoose, { Schema, type Document, type Types } from 'mongoose';
import { linkRefSchema, type ICommunityLinkRef } from './CommunityThread.model.js';

export interface ICommunityAnswer extends Document {
  thread_id: Types.ObjectId;
  author_id: Types.ObjectId;
  body: string;
  links: ICommunityLinkRef[];
  vote_score: number;
  is_accepted: boolean;
  is_hidden: boolean;
  is_deleted: boolean;
  moderation_note?: string;
  edited_at?: Date;
  created_at: Date;
  updated_at: Date;
}

const schema = new Schema<ICommunityAnswer>(
  {
    thread_id: { type: Schema.Types.ObjectId, ref: 'CommunityThread', required: true },
    author_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true },
    links: { type: [linkRefSchema], default: [] },
    vote_score: { type: Number, default: 0 },
    is_accepted: { type: Boolean, default: false },
    is_hidden: { type: Boolean, default: false },
    is_deleted: { type: Boolean, default: false },
    moderation_note: { type: String },
    edited_at: { type: Date },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

schema.index({ thread_id: 1, is_deleted: 1, created_at: 1 });
schema.index({ author_id: 1, created_at: -1 });

export const CommunityAnswer = mongoose.model<ICommunityAnswer>('CommunityAnswer', schema, 'community_answers');
